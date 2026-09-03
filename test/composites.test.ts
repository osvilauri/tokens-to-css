import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../src/dialects/registry.js'
import { convertDocument } from '../src/pipeline.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode, TokenCssError } from '../src/index.js'
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

describe('composites that fit one CSS value are written (FR-25)', () => {
  const emit = (value: string): string => read(value).css.match(/--t: (.+);/)![1]!

  it('writes a shadow as offsetX offsetY blur spread color', () => {
    expect(
      emit(`{ "color": "#000", "offsetX": "0px", "offsetY": "2px", "blur": "6px", "spread": "0px" }`),
    ).toBe('0px 2px 6px 0px #000')
  })

  it('puts inset in front when the shadow is an inner one', () => {
    expect(
      emit(`{ "color": "#000", "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px", "inset": true }`),
    ).toBe('inset 0px 1px 2px 0px #000')
  })

  it('joins a list of shadows with a comma and keeps it one value', () => {
    expect(
      emit(`[
        { "color": "#000", "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px" },
        { "color": "#111", "offsetX": "0px", "offsetY": "4px", "blur": "8px", "spread": "0px" }
      ]`),
    ).toBe('0px 1px 2px 0px #000, 0px 4px 8px 0px #111')
  })

  it('writes a border as width style color', () => {
    expect(emit(`{ "color": "#000", "width": "1px", "style": "solid" }`)).toBe('1px solid #000')
  })

  it('writes a transition as duration, timing function, delay', () => {
    // Not the order the object is written in: in the CSS shorthand the first
    // time is the duration and the second is the delay.
    expect(
      emit(`{ "duration": "200ms", "delay": "50ms", "timingFunction": [0.2, 0, 0, 1] }`),
    ).toBe('200ms cubic-bezier(0.2, 0, 0, 1) 50ms')
  })

  it('writes a gradient as its stops, with no axis invented', () => {
    // The token says nothing about direction, so the consumer supplies it:
    // background: linear-gradient(to right, var(--t)).
    expect(
      emit(`[{ "color": "#000", "position": 0 }, { "color": "#fff", "position": 1 }]`),
    ).toBe('#000 0%, #fff 100%')
  })

  it('clamps a stop position outside 0–1, as the spec requires', () => {
    expect(emit(`[{ "color": "#000", "position": -9 }, { "color": "#fff", "position": 42 }]`)).toBe(
      '#000 0%, #fff 100%',
    )
  })

  it('keeps an aliased sub-value an alias', () => {
    // The promise the whole product rests on, applied piecewise: a shadow still
    // moves when the colour it was built from moves.
    const { css } = read(
      `{ "color": "{keep}", "offsetX": "0px", "offsetY": "2px", "blur": "6px", "spread": "0px" }`,
    )
    expect(css).toContain('--t: 0px 2px 6px 0px var(--keep);')
  })

  it('accepts sub-values in every notation the spec allows, and invents no unit', () => {
    // The colour and three of the lengths are objects, the spread is a bare
    // number — and it stays `0`, not `0px`. Adding the unit would be the same
    // inference the product refuses everywhere else.
    expect(
      emit(`{ "color": { "colorSpace": "srgb", "components": [0, 0, 0] },
              "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 2, "unit": "px" },
              "blur": { "value": 6, "unit": "px" }, "spread": 0 }`),
    ).toBe('0px 2px 6px 0 rgb(0 0 0)')
  })
})

describe('a composite the spec calls incomplete is skipped, and says what is missing', () => {
  it('names the absent sub-property rather than calling it "an object"', () => {
    const skipped = skip(`{ "color": "#000", "offsetX": "0px", "offsetY": "2px", "blur": "6px" }`)
    expect(skipped.code).toBe(FailureCode.COMPOSITE_VALUE)
    expect(skipped.reason).toContain('"spread"')
  })

  it('skips a transition with no delay, which the spec marks required', () => {
    expect(skip(`{ "duration": "200ms", "timingFunction": [0, 0, 1, 1] }`).reason).toContain('"delay"')
  })

  it('skips a border whose style is written as an object', () => {
    // The spec's own focusring example. `dashArray` is SVG geometry a CSS
    // border cannot carry, and the "closest approximation" the spec permits is
    // exactly the silent guess this product does not make.
    const skipped = skip(
      `{ "color": "#000", "width": "1px", "style": { "dashArray": ["2px"], "lineCap": "round" } }`,
    )
    expect(skipped.reason).toContain('object')
  })

  it('skips typography missing sub-properties the spec marks required', () => {
    // GitHub Primer publishes typography without letterSpacing; the spec marks
    // all five MUST, and defaulting one would be the first inference.
    expect(skip(`{ "fontFamily": "Helvetica", "fontSize": "16px", "lineHeight": 1.4 }`).reason)
      .toContain('"fontWeight", "letterSpacing"')
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

describe('composites that need more than one property expand (FR-25)', () => {
  const emit = (value: string): Record<string, string> => {
    const { css } = read(value)
    return Object.fromEntries(
      [...css.matchAll(/^ {2}--t-([\w-]+): (.+);$/gm)].map((m) => [m[1]!, m[2]!]),
    )
  }

  it('writes one custom property per sub-property of a typography token', () => {
    expect(
      emit(`{ "fontFamily": ["system-ui", "sans-serif"], "fontSize": { "value": 0.875, "unit": "rem" },
              "fontWeight": 400, "letterSpacing": "0.16px", "lineHeight": 1.42857 }`),
    ).toEqual({
      'font-family': 'system-ui, sans-serif',
      'font-size': '0.875rem',
      'font-weight': '400',
      'letter-spacing': '0.16px',
      'line-height': '1.42857',
    })
  })

  it('names each one after the CSS property it feeds', () => {
    // The suffix is a table of seven, not the DTCG key: the existing naming
    // rule does not split camelCase, and teaching it to would rename every
    // token already emitted. So the token is spelled the way the declaration
    // that uses it is spelled — font-size: var(--t-font-size).
    const emitted = Object.keys(emit(`{ "fontFamily": "Inter", "fontSize": "16px",
      "fontWeight": 400, "letterSpacing": 0, "lineHeight": 1.5 }`))
    expect(emitted).toEqual([
      'font-family',
      'font-size',
      'font-weight',
      'letter-spacing',
      'line-height',
    ])
  })

  it('keeps an aliased sub-value an alias', () => {
    const { css } = read(`{ "fontFamily": "{keep}", "fontSize": "{keep}", "fontWeight": "{keep}",
      "letterSpacing": 0, "lineHeight": 1 }`)
    expect(css).toContain('--t-font-family: var(--keep);')
    expect(css).toContain('--t-font-size: var(--keep);')
  })

  it('never emits the font shorthand, not even as a convenience', () => {
    // Used alone it drops letter-spacing in silence, which is the exact failure
    // this product exists to prevent. Six properties would be five plus a trap.
    const { css } = read(`{ "fontFamily": "Inter", "fontSize": "16px", "fontWeight": 400,
      "letterSpacing": "0.16px", "lineHeight": 1.5 }`)
    expect(css).not.toContain('--t-font:')
  })

  it('translates a font weight written as a word through the spec table', () => {
    const weights: [string, string][] = [
      ['thin', '100'], ['regular', '400'], ['semi-bold', '600'], ['bold', '700'],
      ['heavy', '900'], ['ultra-black', '950'],
    ]
    for (const [word, number] of weights) {
      expect(
        emit(`{ "fontFamily": "Inter", "fontSize": "16px", "fontWeight": "${word}",
                "letterSpacing": 0, "lineHeight": 1.5 }`)['font-weight'],
      ).toBe(number)
    }
  })

  it('skips a font weight outside the table rather than emitting invalid CSS', () => {
    // `font-weight: regular` is ignored by a browser in silence. So is anything
    // else that is not a number or a keyword.
    expect(
      skip(`{ "fontFamily": "Inter", "fontSize": "16px", "fontWeight": "kinda bold",
              "letterSpacing": 0, "lineHeight": 1.5 }`).reason,
    ).toContain('not a weight the spec defines')
  })

  it('accepts letterSpacing in all three notations published files use', () => {
    const spacing = (json: string): string =>
      emit(`{ "fontFamily": "Inter", "fontSize": "16px", "fontWeight": 400,
              "letterSpacing": ${json}, "lineHeight": 1.5 }`)['letter-spacing']!
    expect(spacing(`{ "value": 0.16, "unit": "px" }`)).toBe('0.16px')
    expect(spacing(`"0.16px"`)).toBe('0.16px')
    expect(spacing(`0`)).toBe('0')
  })

  it('leaves a unitless line height unitless', () => {
    // The unitless number is semantic in CSS: it inherits as a ratio rather
    // than as a computed length, so adding a unit would change behaviour.
    expect(
      emit(`{ "fontFamily": "Inter", "fontSize": "16px", "fontWeight": 400,
              "letterSpacing": 0, "lineHeight": 1.42857 }`)['line-height'],
    ).toBe('1.42857')
  })

  it('expands an object-form stroke style into its two SVG properties', () => {
    expect(
      emit(`{ "dashArray": [{ "value": 0.5, "unit": "rem" }, { "value": 0.25, "unit": "rem" }],
              "lineCap": "round" }`),
    ).toEqual({ 'dash-array': '0.5rem 0.25rem', 'line-cap': 'round' })
  })
})

describe('an expanded name collides like any other name', () => {
  it('fails with NAME_COLLISION when a real token would emit the same property', () => {
    // The collision pass already runs after naming, so expansion needed nothing
    // added to it — but the case is worth pinning, because it is the one way
    // expansion can take a name that was already spoken for.
    let caught: TokenCssError | undefined
    try {
      convertDocument(
        JSON.parse(`{
          "type": { "body": { "$value": { "fontFamily": "Inter", "fontSize": "16px",
            "fontWeight": 400, "letterSpacing": 0, "lineHeight": 1.5 } } },
          "type-body-font-size": { "$value": "99px" }
        }`),
        SOURCE,
      )
    } catch (err) {
      caught = err as TokenCssError
    }
    expect(caught?.code).toBe(FailureCode.NAME_COLLISION)
    expect(caught?.message).toContain('--type-body-font-size')
    expect(caught?.tokenPaths).toEqual(['type.body.font-size', 'type-body-font-size'])
  })
})
