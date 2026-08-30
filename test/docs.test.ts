import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIALECTS } from '../src/dialects/registry.js'
import { FailureCode } from '../src/index.js'

/**
 * Read with line wrapping flattened.
 *
 * Documentation is wrapped prose. A test that matched the raw text would be
 * dictating where a paragraph breaks, and would fail the next time someone
 * reflows one.
 */
const read = (name: string): string =>
  readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8')

const flat = (text: string): string => text.replace(/\s+/g, ' ')

const failures = read('failures.md')
const formats = read('formats.md')
const naming = read('naming.md')

/**
 * SM-3 asks that a developer can use this library from the documentation and
 * the fixtures alone. The final answer to that is a person trying it, but these
 * catch the cheap half: documentation that has quietly stopped describing the
 * code.
 */
describe('the failure reference covers every code', () => {
  it.each(Object.keys(FailureCode))('documents %s', (code) => {
    expect(failures).toContain(`\`${code}\``)
  })

  it('documents no code that does not exist', () => {
    const documented = [...failures.matchAll(/^\| `([A-Z_]+)`/gm)].map((m) => m[1]!)
    expect(documented.sort()).toEqual(Object.keys(FailureCode).sort())
  })

  it('says the codes are contract, so nobody treats one as a detail', () => {
    expect(failures).toMatch(/public contract/i)
    expect(failures).toMatch(/major release/i)
  })

  it('says nothing is written on a failure', () => {
    expect(flat(failures)).toMatch(/no stylesheet is produced/i)
  })
})

describe('the format reference covers every shape', () => {
  it.each(DIALECTS.map((d) => d.id))('documents the %s shape', (id) => {
    const names: Record<string, string> = {
      'tokens-studio': 'Tokens Studio',
      dtcg: 'DTCG',
      'sd-legacy': 'Style Dictionary legacy',
    }
    expect(formats).toContain(names[id])
  })

  it('states the detection order rather than leaving it implicit', () => {
    const order = ['## 1. Tokens Studio', '## 2. DTCG', '## 3. Style Dictionary legacy'].map((h) =>
      formats.indexOf(h),
    )
    for (const position of order) expect(position).toBeGreaterThan(-1)
    expect(order[0]).toBeLessThan(order[1]!)
    expect(order[1]).toBeLessThan(order[2]!)
    expect(flat(formats)).toMatch(/first that matches/i)
  })

  it('covers every failure class a rejection fixture proves', () => {
    const triggers = readdirSync(new URL('../fixtures/reject/', import.meta.url), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    const codes = new Set(
      triggers.map(
        (t) =>
          JSON.parse(
            readFileSync(new URL(`../fixtures/reject/${t}/expected.json`, import.meta.url), 'utf8'),
          ).code as string,
      ),
    )
    for (const code of codes) expect(failures, code).toContain(`\`${code}\``)
  })

  it('warns that a refusal stops the whole document', () => {
    expect(flat(formats)).toMatch(/stops the whole document/i)
  })

  it('says no unit is ever invented, which is the surprise people hit', () => {
    expect(flat(formats)).toMatch(/No unit is ever invented/i)
  })

  it('shows the object notation the current spec uses', () => {
    expect(formats).toContain('colorSpace')
    expect(formats).toContain('rgb(0 0 0)')
  })
})

describe('the naming rule is stated normatively', () => {
  it('gives the rule in order', () => {
    for (const step of ['NFC', 'ocale-independent', '[a-z0-9]', 'trimmed']) {
      expect(naming, step).toContain(step)
    }
  })

  it('marks it as public contract', () => {
    expect(naming).toMatch(/public contract/i)
    expect(naming).toMatch(/major release/i)
  })

  it('is honest that the rule is lossy, and what that costs', () => {
    expect(naming).toMatch(/lossy/i)
    expect(naming).toContain('--caf')
    expect(naming).toMatch(/NAME_COLLISION/)
  })

  it('states the emission order', () => {
    expect(flat(naming)).toMatch(/document order/i)
    expect(naming).toMatch(/byte-identical/i)
  })

  it('agrees with the emitter about a well-known name', () => {
    // The table in the docs is hand-written; this stops it drifting from the
    // rule it claims to describe.
    expect(naming).toContain('`--color-brand-primary`')
    expect(naming).toContain('`--spacing-2xl`')
  })
})

describe('the performance bar is ratified, not assumed', () => {
  const bench = readFileSync(new URL('../bench/run.mjs', import.meta.url), 'utf8')
  const prd = readFileSync(
    new URL(
      '../_bmad-output/planning-artifacts/prds/prd-tokens-to-css-2026-08-06/prd.md',
      import.meta.url,
    ),
    'utf8',
  )

  it('uses the same number in the benchmark and in the PRD', () => {
    // A bar that lives in two places drifts, and the copy nobody runs is the
    // one that stays wrong.
    const inCode = bench.match(/BENCH_BAR_MS \?\? (\d+)/)![1]!
    expect(inCode).toBe('300')
    expect(prd.replace(/\s+/g, ' ')).toContain(`under **${inCode} ms**`)
  })

  it('no longer calls SM-5 an assumption', () => {
    const metric = prd.slice(prd.indexOf('- **SM-5**'), prd.indexOf('**Counter-metrics'))
    expect(metric).not.toContain('[ASSUMPTION')
    expect(metric).toMatch(/Ratified 2026-08-30 from measurement/)
  })

  it('closed OQ-2 rather than leaving it open', () => {
    const questions = prd.slice(prd.indexOf('## 11. Open Questions'))
    expect(questions).toMatch(/~~\*\*OQ-2/)
    expect(questions).toMatch(/Closed 2026-08-30/)
  })

  it('records why it is judged on the best of three', () => {
    expect(bench.replace(/\s+/g, ' ')).toMatch(/never on a single sample/i)
    expect(bench.replace(/\s+/g, ' ')).toMatch(/flaky performance gate gets ignored/i)
  })
})
