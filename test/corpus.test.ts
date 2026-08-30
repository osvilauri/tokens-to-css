import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { discover } from './support/corpus.js'

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
  accept: 0,
  /** One per rejection trigger and per failure class (SM-4). */
  reject: 0,
} as const

describe('the fixture corpus', () => {
  const corpus = discover()

  it('holds exactly the number of accept fixtures we expect', () => {
    expect(corpus.accept.length, corpus.accept.map((f) => f.id).join(', ')).toBe(EXPECTED.accept)
  })

  it('holds exactly the number of reject fixtures we expect', () => {
    expect(corpus.reject.length, corpus.reject.map((f) => f.id).join(', ')).toBe(EXPECTED.reject)
  })

  it('has no duplicate ids', () => {
    const ids = [...corpus.accept, ...corpus.reject].map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.runIf(EXPECTED.accept > 0)('names every accept fixture <dialect>/<hierarchy>', () => {
    for (const f of corpus.accept) expect(f.id).toMatch(/^[a-z-]+\/[a-z-]+$/)
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
