import { describe, expect, it } from 'vitest'
import { customPropertyName } from '../src/emit/name.js'
import { FailureCode, TokenCssError } from '../src/index.js'

const SOURCE = 'design/tokens.json'
const name = (path: readonly string[]): string => customPropertyName(path, SOURCE)

/**
 * Every expectation in this file is a semver commitment. These names end up in
 * the stylesheets of everyone using the package; changing any of them is a
 * major version.
 */
describe('the naming rule', () => {
  it('joins path segments with dashes under a -- prefix', () => {
    expect(name(['color', 'brand', 'primary'])).toBe('--color-brand-primary')
  })

  it('handles a single segment', () => {
    expect(name(['spacing'])).toBe('--spacing')
  })

  it('is not bounded by nesting depth', () => {
    expect(name(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('--a-b-c-d-e-f')
  })

  it('lowercases, so camelCase and kebab-case sources agree', () => {
    expect(name(['colorBrand'])).toBe('--colorbrand')
    expect(name(['ColorBrand'])).toBe('--colorbrand')
  })

  it('lowercases locale-independently', () => {
    // Under a Turkish locale `toLocaleLowerCase` maps I to a dotless ı, which
    // is not in [a-z0-9] and would collapse to a dash. The emitted name must
    // not depend on the machine that ran the build.
    expect(name(['SIZE'])).toBe('--size')
  })

  it('collapses a run of non-alphanumerics to one dash, not several', () => {
    expect(name(['color brand'])).toBe('--color-brand')
    expect(name(['color   brand'])).toBe('--color-brand')
    expect(name(['color___brand'])).toBe('--color-brand')
    expect(name(['color.-_ brand'])).toBe('--color-brand')
  })

  it('trims dashes from the edges of each segment', () => {
    expect(name(['-color-', 'brand'])).toBe('--color-brand')
    expect(name(['!color!', '?brand?'])).toBe('--color-brand')
  })

  it('keeps a leading digit — custom-property names allow it', () => {
    expect(name(['spacing', '2xl'])).toBe('--spacing-2xl')
    expect(name(['4'])).toBe('--4')
  })
})

describe('Unicode is normalized before anything else', () => {
  it('produces the same name whether the source is composed or decomposed', () => {
    const composed = 'café' // é as one code point
    const decomposed = 'café' // e + combining acute
    expect(composed).not.toBe(decomposed)
    expect(name([composed])).toBe(name([decomposed]))
  })

  it('drops accented letters, because they are outside [a-z0-9]', () => {
    // Lossy on purpose. Two paths can collide as a result, which is the
    // collision pass's job to catch — never this function's job to paper over.
    expect(name(['café'])).toBe('--caf')
    expect(name(['año'])).toBe('--a-o')
  })

  it('handles a segment of non-Latin script by failing rather than guessing', () => {
    expect(() => name(['色'])).toThrow(TokenCssError)
  })
})

describe('a segment with nothing left is a failure, never a silent rename', () => {
  const expectFailure = (path: readonly string[], match: RegExp): void => {
    let caught: TokenCssError | undefined
    try {
      name(path)
    } catch (err) {
      caught = err as TokenCssError
    }
    expect(caught).toBeInstanceOf(TokenCssError)
    expect(caught!.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(caught!.source).toBe(SOURCE)
    expect(caught!.message).toMatch(match)
  }

  it('rejects a segment that is only punctuation', () => {
    expectFailure(['color', '!!!', 'primary'], /!!!/)
  })

  it('rejects an empty segment', () => {
    expectFailure(['color', '', 'primary'], /color\.\.primary/)
  })

  it('rejects a whitespace-only segment', () => {
    expectFailure(['color', '   ', 'primary'], /no letters or digits/)
  })

  it('rejects an empty path', () => {
    expectFailure([], /empty path/)
  })

  it('names the offending token so the developer can find it', () => {
    try {
      name(['color', '###', 'primary'])
    } catch (err) {
      expect((err as TokenCssError).tokenPaths).toEqual(['color.###.primary'])
    }
  })
})

describe('the rule is deterministic', () => {
  it('gives the same answer every time', () => {
    const path = ['Color Brand', 'Primary--Value', '2xl']
    const once = name(path)
    for (let i = 0; i < 50; i++) expect(name(path)).toBe(once)
  })

  it('does not mutate the path it was given', () => {
    const path = ['Color', 'Brand']
    name(path)
    expect(path).toEqual(['Color', 'Brand'])
  })
})
