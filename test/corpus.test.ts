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
  /** 9 at the Epic 2 freeze: 3 dialects × 3 hierarchies (AD-16). */
  accept: 3,
  /**
   * One per document-shaped rejection trigger and failure class (SM-4).
   *
   * The remaining classes are not shaped like a document: an unreadable source,
   * invalid JSON and a failed write are proved end to end, and the network
   * classes against the scenario harness (AD-23). SM-4's claim is the union.
   */
  reject: 16,
} as const

describe('the fixture corpus', () => {
  const corpus = discover()

  it('holds exactly the number of accept fixtures we expect', () => {
    expect(corpus.accept.length, corpus.accept.map((f) => f.id).join(', ')).toBe(EXPECTED.accept)
  })

  it('holds exactly the number of reject fixtures we expect', () => {
    expect(corpus.reject.length, corpus.reject.map((f) => f.id).join(', ')).toBe(EXPECTED.reject)
  })

  it('produces identical goldens for fixtures that differ only by dialect', () => {
    // The point of the shared catalogue: a dialect is an input shape, never a
    // mode. Two files saying the same thing in different notations must emit
    // exactly the same stylesheet.
    const byHierarchy = new Map<string, string[]>()
    for (const f of corpus.accept) {
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
    const ids = [...corpus.accept, ...corpus.reject].map((f) => f.id)
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
