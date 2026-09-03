import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { convertDocument } from '../src/pipeline.js'
import { TokenCssError } from '../src/index.js'
import { compareGolden, describeMismatch, discover, goldenUpdatesAllowed, writeGolden } from './support/corpus.js'

/**
 * The real corpus. Fixtures arrive over Epic 1 and Epic 2; the counts below
 * move with them, deliberately and in the same commit.
 *
 * The counts are the tripwire. Discovery walks directories with no registration
 * file, which is what keeps adding a fixture a one-folder change — and also what
 * makes a mistyped path vanish silently. Asserting an explicit number turns a
 * disappearing fixture into a failing build instead of a smaller green run.
 */
const EXPECTED = {
  /**
   * 9 at the Epic 2 freeze: 3 dialects × 3 hierarchies (AD-16). Plus the
   * fixtures outside it, which no other dialect can express: `object-values`
   * (FR-23), `array-values` (FR-26) and `composites` (FR-25).
   */
  accept: 12,
  /**
   * One per document-shaped rejection trigger and failure class (SM-4).
   *
   * The remaining classes are not shaped like a document: an unreadable source,
   * invalid JSON and a failed write are proved end to end, and the network
   * classes against the scenario harness (AD-23). SM-4's claim is the union.
   */
  reject: 17,
  /**
   * Partial conversions (FR-24): a document that converts while leaving tokens
   * out. Neither an accept nor a reject fixture can express one — the first
   * would assert bytes without the skip report, the second a failure that did
   * not happen.
   */
  partial: 3,
} as const

/**
 * Accept fixtures outside the dialect × hierarchy matrix.
 *
 * Each exercises something only DTCG expresses, so it has no legacy or Tokens
 * Studio counterpart and cannot take part in the byte-identical comparison the
 * matrix rests on.
 */
const OUTSIDE_MATRIX = ['dtcg/object-values', 'dtcg/array-values', 'dtcg/composites']

describe('the fixture corpus', () => {
  const corpus = discover()

  it('holds exactly the number of accept fixtures we expect', () => {
    expect(corpus.accept.length, corpus.accept.map((f) => f.id).join(', ')).toBe(EXPECTED.accept)
  })

  it('holds exactly the number of reject fixtures we expect', () => {
    expect(corpus.reject.length, corpus.reject.map((f) => f.id).join(', ')).toBe(EXPECTED.reject)
  })

  it('holds exactly the number of partial fixtures we expect', () => {
    expect(corpus.partial.length, corpus.partial.map((f) => f.id).join(', ')).toBe(EXPECTED.partial)
  })

  it('produces identical goldens for fixtures that differ only by dialect', () => {
    // The point of the shared catalogue: a dialect is an input shape, never a
    // mode. Two files saying the same thing in different notations must emit
    // exactly the same stylesheet.
    const byHierarchy = new Map<string, string[]>()
    for (const f of corpus.accept.filter((x) => !OUTSIDE_MATRIX.includes(x.id))) {
      const hierarchy = f.id.split('/')[1]!
      byHierarchy.set(hierarchy, [...(byHierarchy.get(hierarchy) ?? []), f.expectedCss])
    }
    for (const [hierarchy, goldens] of byHierarchy) {
      for (const golden of goldens) {
        expect(golden, `dialects disagree for ${hierarchy}`).toBe(goldens[0])
      }
    }
  })

  it('has no duplicate ids', () => {
    const ids = [...corpus.accept, ...corpus.reject, ...corpus.partial].map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names every accept fixture <dialect>/<hierarchy>', () => {
    for (const f of corpus.accept) expect(f.id).toMatch(/^[a-z-]+\/[a-z-]+$/)
  })
})

/**
 * SM-1. "Correct" is defined by these goldens, not by review.
 *
 * The conversion runs through the real pipeline stage order rather than a
 * sequence assembled here — a corpus that ordered the passes itself could stay
 * green while the pipeline ran them differently.
 */
describe('the accept matrix is complete and consistent', () => {
  const corpus = discover()
  const DIALECTS = ['dtcg', 'sd-legacy', 'tokens-studio']
  const HIERARCHIES = ['three-tier', 'cti', 'eightshapes']

  it('covers every dialect against every hierarchy', () => {
    const matrix = DIALECTS.flatMap((d) => HIERARCHIES.map((h) => `${d}/${h}`))
    // Plus the fixtures outside the matrix: the same catalogue written the way
    // the current DTCG spec writes colours and dimensions, and the scalars it
    // writes as arrays. Neither has a legacy or Tokens Studio counterpart,
    // because neither dialect has the concept.
    expect(corpus.accept.map((f) => f.id).sort()).toEqual([...matrix, ...OUTSIDE_MATRIX].sort())
  })

  it('says the same thing in all nine, however it is spelled or arranged', () => {
    // The claim the corpus rests on. Names differ by hierarchy and notation
    // differs by dialect, but the values and the shape of the alias graph are
    // one catalogue — otherwise a golden comparison would be comparing two
    // different documents and proving nothing.
    const shapeOf = (css: string): { values: string[]; references: number } => {
      const declarations = [...css.matchAll(/^ {2}--[\w-]+: (.+);$/gm)].map((m) => m[1]!)
      return {
        values: declarations.filter((v) => !v.startsWith('var(')).sort(),
        references: declarations.filter((v) => v.startsWith('var(')).length,
      }
    }

    const matrix = corpus.accept.filter((f) => !OUTSIDE_MATRIX.includes(f.id))
    const shapes = matrix.map((f) => shapeOf(f.expectedCss))
    for (const shape of shapes) expect(shape).toEqual(shapes[0])
  })

  it('gives each hierarchy its own names, so the corpus is not nine copies', () => {
    const perHierarchy = HIERARCHIES.map(
      (h) => corpus.accept.find((f) => f.id === `dtcg/${h}`)!.expectedCss,
    )
    expect(new Set(perHierarchy).size).toBe(HIERARCHIES.length)
  })

  it('keeps the derived dialects in step with their DTCG source', () => {
    // Three hand-written copies of one catalogue drift the first time somebody
    // edits one. DTCG is the source; the other two are generated.
    let code = 0
    try {
      execFileSync(process.execPath, ['scripts/derive-dialects.mjs', '--check'], { stdio: 'pipe' })
    } catch (err) {
      code = (err as { status: number }).status
    }
    expect(code, 'run: node scripts/derive-dialects.mjs').toBe(0)
  })
})

describe('every accept fixture converts to its golden', () => {
  const corpus = discover()

  it.each(corpus.accept.map((f) => [f.id, f] as const))('%s', (id, fixture) => {
    const { css } = convertDocument(fixture.input, `fixtures/accept/${id}/input.json`)

    if (goldenUpdatesAllowed()) {
      writeGolden(fixture, css)
      return
    }

    const mismatch = compareGolden(css, fixture.expectedCss)
    if (mismatch) throw new Error(describeMismatch(id, mismatch))
  })
})

describe('every reject fixture fails with its expected code', () => {
  const corpus = discover()

  it.each(corpus.reject.map((f) => [f.id, f] as const))('%s', (id, fixture) => {
    let caught: TokenCssError | undefined
    try {
      convertDocument(fixture.input, `fixtures/reject/${id}/input.json`)
    } catch (err) {
      caught = err as TokenCssError
    }
    expect(caught, 'expected this fixture to be refused').toBeInstanceOf(TokenCssError)
    expect(caught!.code).toBe(fixture.expected.code)
    if (fixture.expected.tokenPaths) {
      expect(caught!.tokenPaths).toEqual(fixture.expected.tokenPaths)
    }
  })
})

describe('every partial fixture converts to its golden and reports what it left out', () => {
  const corpus = discover()

  it.each(corpus.partial.map((f) => [f.id, f] as const))('%s', (id, fixture) => {
    const { css, skipped } = convertDocument(fixture.input, `fixtures/partial/${id}/input.json`)

    // Both halves, or the fixture proves half of what happened: a stylesheet
    // that is short and a report that says why it is short.
    expect(skipped.map((s) => ({ path: s.path, code: s.code }))).toEqual(
      fixture.expectedSkipped.map((s) => ({ path: s.path, code: s.code })),
    )

    if (goldenUpdatesAllowed()) {
      writeGolden(fixture, css)
      return
    }

    const mismatch = compareGolden(css, fixture.expectedCss)
    if (mismatch) throw new Error(describeMismatch(id, mismatch))
  })

  it('every skipped token is named in the golden it belongs to', () => {
    // The comment block is the half of the report humans see, so it is pinned
    // by the golden rather than trusted to exist.
    for (const fixture of corpus.partial) {
      for (const skip of fixture.expectedSkipped) {
        expect(fixture.expectedCss, fixture.id).toContain(`"${skip.path}"`)
      }
    }
  })

  it('no accept fixture carries a comment block', () => {
    // The claim that keeps this release a minor: a document that loses nothing
    // is byte-identical to what it produced before partial conversion existed.
    for (const fixture of corpus.accept) {
      expect(fixture.expectedCss.startsWith(':root {'), fixture.id).toBe(true)
    }
  })
})

describe('CI never rewrites its own expectations (AD-17)', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

  it('does not set UPDATE_GOLDEN to anything truthy', () => {
    const assignments = [...workflow.matchAll(/UPDATE_GOLDEN:\s*(.*)/g)].map((m) => m[1]!.trim())
    for (const value of assignments) {
      expect(value === "''" || value === '""', `UPDATE_GOLDEN: ${value}`).toBe(true)
    }
  })

  it('runs the suite on every supported Node line', () => {
    expect(workflow).toMatch(/node:\s*\['22',\s*'24',\s*'26'\]/)
  })
})
