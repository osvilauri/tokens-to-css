import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../src/dialects/registry.js'
import { FailureCode, TokenCssError } from '../src/index.js'

const SOURCE = 'design/tokens.json'

const refuse = (value: string): TokenCssError => {
  try {
    normalizeDocument(JSON.parse(`{ "t": { "$value": ${value} } }`), SOURCE)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this value to be refused')
}

/**
 * Composites are refused where the raw JSON is read, not in a later pass. The
 * internal representation cannot hold one — a literal is a string or a number —
 * so by the time any validator ran, the value would already have had to become
 * something it is not.
 */
describe('every DTCG composite type is refused (FR-20)', () => {
  const composites = {
    typography: `{ "fontFamily": "Helvetica", "fontSize": "16px", "lineHeight": 1.4 }`,
    shadow: `{ "color": "#000", "offsetX": "0", "offsetY": "2px", "blur": "4px" }`,
    'shadow list': `[{ "offsetY": "2px" }, { "offsetY": "4px" }]`,
    border: `{ "color": "#000", "width": "1px", "style": "solid" }`,
    gradient: `[{ "color": "#000", "position": 0 }, { "color": "#fff", "position": 1 }]`,
    transition: `{ "duration": "200ms", "delay": "0ms", "timingFunction": [0.5, 0, 1, 1] }`,
    'stroke style': `{ "dashArray": ["2px", "4px"], "lineCap": "round" }`,
    'object colour': `{ "colorSpace": "srgb", "components": [0.35, 0.31, 0.81] }`,
  }

  it.each(Object.entries(composites))('refuses a %s value', (_kind, value) => {
    const err = refuse(value)
    expect(err.code).toBe(FailureCode.COMPOSITE_VALUE)
    expect(err.tokenPaths).toEqual(['t'])
    expect(err.message).toMatch(/an (object|array)/)
  })

  it('names the offending token and what it found', () => {
    const err = refuse(`{ "fontSize": "16px" }`)
    expect(err.message).toContain('"t"')
    expect(err.message).toContain('an object')
  })

  it('refuses null and booleans, scalars in JSON but not in CSS', () => {
    expect(refuse('null').message).toContain('null')
    expect(refuse('true').message).toContain('a boolean')
  })
})

describe('nothing composite ever reaches a stylesheet', () => {
  it('never produces [object Object] on a success path', () => {
    for (const value of ['{}', '[]', '{ "a": 1 }', '[1, 2]']) {
      expect(() => normalizeDocument(JSON.parse(`{ "t": { "$value": ${value} } }`), SOURCE)).toThrow(
        TokenCssError,
      )
    }
  })

  it('refuses the whole document rather than converting the rest', () => {
    // Partial conversion would ship a stylesheet missing a token under a
    // successful-looking run.
    const err = (): unknown =>
      normalizeDocument(
        JSON.parse(`{
          "good": { "$value": "#5A4FCF" },
          "bad": { "$value": { "fontSize": "16px" } },
          "alsoGood": { "$value": "16px" }
        }`),
        SOURCE,
      )
    expect(err).toThrow(TokenCssError)
    try {
      err()
    } catch (caught) {
      expect((caught as TokenCssError).code).toBe(FailureCode.COMPOSITE_VALUE)
    }
  })
})
