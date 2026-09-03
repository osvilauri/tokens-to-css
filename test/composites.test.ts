import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../src/dialects/registry.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode } from '../src/index.js'
import type { SkippedToken } from '../src/errors.js'

const SOURCE = 'design/tokens.json'

const read = (value: string): { css: string; skipped: readonly SkippedToken[] } => {
  const { doc, skipped } = normalizeDocument(
    JSON.parse(`{ "keep": { "$value": "#5A4FCF" }, "t": { "$value": ${value} } }`),
    SOURCE,
  )
  return { css: emitStylesheet(doc, skipped, SOURCE), skipped }
}

const skip = (value: string): SkippedToken => {
  const { skipped } = read(value)
  expect(skipped).toHaveLength(1)
  return skipped[0]!
}

/**
 * Composites are recognized where the raw JSON is read, not in a later pass.
 * The internal representation cannot hold one — a literal is a string or a
 * number — so by the time any validator ran, the value would already have had
 * to become something it is not.
 *
 * Until FR-24 that recognition was fatal. It is now a skip: the token is left
 * out and said out loud, and the document around it still converts.
 */
describe('an object-form scalar is not a composite', () => {
  it('accepts a colour written as an object', () => {
    // It was refused until the current DTCG spec turned out to write every
    // colour this way. One colour is still one CSS value; the object is
    // notation, not structure (FR-23).
    const { doc } = normalizeDocument(
      JSON.parse(`{ "t": { "$value": { "colorSpace": "srgb", "components": [0, 0, 0] } } }`),
      SOURCE,
    )
    expect(doc.tokens).toHaveLength(1)
  })

  it('accepts a dimension written as an object', () => {
    const { doc } = normalizeDocument(
      JSON.parse(`{ "t": { "$value": { "value": 16, "unit": "px" } } }`),
      SOURCE,
    )
    expect(doc.tokens).toHaveLength(1)
  })
})

describe('every DTCG composite type is skipped, not written (FR-24)', () => {
  const composites = {
    typography: `{ "fontFamily": "Helvetica", "fontSize": "16px", "lineHeight": 1.4 }`,
    shadow: `{ "color": "#000", "offsetX": "0", "offsetY": "2px", "blur": "4px" }`,
    'shadow list': `[{ "offsetY": "2px" }, { "offsetY": "4px" }]`,
    border: `{ "color": "#000", "width": "1px", "style": "solid" }`,
    gradient: `[{ "color": "#000", "position": 0 }, { "color": "#fff", "position": 1 }]`,
    transition: `{ "duration": "200ms", "delay": "0ms", "timingFunction": [0.5, 0, 1, 1] }`,
    'stroke style': `{ "dashArray": ["2px", "4px"], "lineCap": "round" }`,
  }

  it.each(Object.entries(composites))('skips a %s value', (_kind, value) => {
    const skipped = skip(value)
    expect(skipped.code).toBe(FailureCode.COMPOSITE_VALUE)
    expect(skipped.path).toBe('t')
    expect(skipped.reason).toMatch(/an (object|array)/)
  })

  it('names the token and what it found', () => {
    const skipped = skip(`{ "fontSize": "16px" }`)
    expect(skipped.reason).toContain('"t"')
    expect(skipped.reason).toContain('an object')
  })

  it('skips null and booleans, scalars in JSON but not in CSS', () => {
    expect(skip('null').reason).toContain('null')
    expect(skip('true').reason).toContain('a boolean')
  })
})

describe('nothing composite ever reaches a stylesheet', () => {
  it('never produces [object Object] on a success path', () => {
    for (const value of ['{}', '[]', '{ "a": 1 }', '[1, 2]']) {
      const { css } = read(value)
      expect(css).not.toContain('[object Object]')
      expect(css).not.toContain('--t:')
    }
  })

  it('converts the rest of the document instead of losing all of it', () => {
    // The inverse of what this test asserted before FR-24. Losing two hundred
    // good tokens to one bad one was the cost being paid for fail-closed, and
    // the reason skipping is safe is the sentence below it: the omission is
    // announced, in the result and in the stylesheet.
    const { doc, skipped } = normalizeDocument(
      JSON.parse(`{
        "good": { "$value": "#5A4FCF" },
        "bad": { "$value": { "fontSize": "16px" } },
        "alsoGood": { "$value": "16px" }
      }`),
      SOURCE,
    )
    const css = emitStylesheet(doc, skipped, SOURCE)

    expect(css).toContain('--good: #5A4FCF;')
    expect(css).toContain('--alsogood: 16px;')
    expect(css).not.toContain('--bad')
    expect(skipped.map((s) => s.path)).toEqual(['bad'])
    expect(css).toContain('1 token was skipped:')
  })
})
