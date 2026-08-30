import { describe, expect, it } from 'vitest'
import { assertScalar, isScalar, stringifyLiteral } from '../src/emit/literal.js'
import { FailureCode, TokenCssError } from '../src/index.js'

const SOURCE = 'design/tokens.json'
const scalar = (value: unknown): unknown => assertScalar(value, ['spacing', 'md'], SOURCE)

describe('a string is written verbatim', () => {
  it('keeps the value exactly as the token wrote it', () => {
    expect(stringifyLiteral('#5A4FCF')).toBe('#5A4FCF')
    expect(stringifyLiteral('1px solid red')).toBe('1px solid red')
    expect(stringifyLiteral('clamp(1rem, 2vw, 3rem)')).toBe('clamp(1rem, 2vw, 3rem)')
  })

  it('does not add quotes', () => {
    expect(stringifyLiteral('Helvetica Neue')).toBe('Helvetica Neue')
  })

  it('does not change case', () => {
    expect(stringifyLiteral('#AABBCC')).toBe('#AABBCC')
  })

  it('keeps whitespace, including a trailing space', () => {
    // Goldens are byte-exact. Tidying the input here would make the output
    // depend on this function's taste rather than on the token file.
    expect(stringifyLiteral(' 16px ')).toBe(' 16px ')
  })

  it('keeps an empty string as an empty string', () => {
    expect(stringifyLiteral('')).toBe('')
  })
})

describe('a number is written plainly, and nothing is inferred from it', () => {
  it('writes the digits and no unit', () => {
    // The single most likely place for two implementations to disagree:
    // one writes 16, the other decides spacing must be a length and writes 16px.
    expect(stringifyLiteral(16)).toBe('16')
  })

  it('keeps decimals as written, without rounding', () => {
    expect(stringifyLiteral(1.5)).toBe('1.5')
    expect(stringifyLiteral(0.0625)).toBe('0.0625')
  })

  it('keeps zero and negatives', () => {
    expect(stringifyLiteral(0)).toBe('0')
    expect(stringifyLiteral(-1)).toBe('-1')
  })

  it('does not rewrite exponent notation', () => {
    expect(stringifyLiteral(1e21)).toBe('1e+21')
  })
})

describe('anything that is not a scalar is refused (FR-20)', () => {
  const expectComposite = (value: unknown, described: RegExp): void => {
    let caught: TokenCssError | undefined
    try {
      scalar(value)
    } catch (err) {
      caught = err as TokenCssError
    }
    expect(caught, `${JSON.stringify(value)} should be refused`).toBeInstanceOf(TokenCssError)
    expect(caught!.code).toBe(FailureCode.COMPOSITE_VALUE)
    expect(caught!.source).toBe(SOURCE)
    expect(caught!.tokenPaths).toEqual(['spacing.md'])
    expect(caught!.message).toMatch(described)
  }

  it('refuses a composite typography value', () => {
    expectComposite({ fontFamily: 'Helvetica', fontSize: '16px' }, /an object/)
  })

  it('refuses a shadow expressed as an array', () => {
    expectComposite([{ offsetX: '0', offsetY: '2px' }], /an array/)
  })

  it('refuses an object-form colour', () => {
    expectComposite({ colorSpace: 'srgb', components: [1, 0, 0] }, /an object/)
  })

  it('refuses null and booleans, which are scalars in JSON but not in CSS', () => {
    expectComposite(null, /null/)
    expectComposite(true, /a boolean/)
    expectComposite(false, /a boolean/)
  })

  it('names the offending token so the developer can find it', () => {
    try {
      scalar({})
    } catch (err) {
      expect((err as TokenCssError).message).toContain('spacing.md')
    }
  })

  it('never produces [object Object] on a success path', () => {
    expect(() => scalar({ a: 1 })).toThrow(TokenCssError)
  })
})

describe('the scalar predicate', () => {
  it('accepts strings and finite numbers', () => {
    expect(isScalar('x')).toBe(true)
    expect(isScalar(0)).toBe(true)
    expect(isScalar(-1.5)).toBe(true)
  })

  it('rejects everything else', () => {
    for (const value of [null, undefined, true, {}, [], () => {}]) {
      expect(isScalar(value), String(value)).toBe(false)
    }
  })

  it('rejects NaN and Infinity, which would emit as broken CSS', () => {
    // JSON cannot express these, so they should never arrive — but `--x: NaN`
    // is the kind of output that looks like success and is not.
    expect(isScalar(Number.NaN)).toBe(false)
    expect(isScalar(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('returns the value unchanged when it is acceptable', () => {
    expect(scalar('#fff')).toBe('#fff')
    expect(scalar(16)).toBe(16)
  })
})
