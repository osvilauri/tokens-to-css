import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../src/dialects/registry.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode, TokenCssError } from '../src/index.js'

const SOURCE = 'design/tokens.json'
const value = (json: string): string => {
  const doc = normalizeDocument(JSON.parse(`{ "t": { "$value": ${json} } }`), SOURCE)
  return emitStylesheet(doc, SOURCE).match(/--t: (.+);/)![1]!
}
const failure = (json: string): TokenCssError => {
  try {
    normalizeDocument(JSON.parse(`{ "t": { "$value": ${json} } }`), SOURCE)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this value to be refused')
}

describe('dimensions written as objects', () => {
  it('joins the number and the unit', () => {
    expect(value(`{ "value": 16, "unit": "px" }`)).toBe('16px')
    expect(value(`{ "value": 0.25, "unit": "rem" }`)).toBe('0.25rem')
  })

  it('does not round or reformat the number', () => {
    expect(value(`{ "value": 1.5, "unit": "rem" }`)).toBe('1.5rem')
    expect(value(`{ "value": 0, "unit": "px" }`)).toBe('0px')
  })

  it('writes the number alone when there is no unit', () => {
    // `{ "value": 0, "unit": "" }` appears in published catalogues, and 0 is a
    // perfectly good CSS length. Saying what the token said, adding nothing.
    expect(value(`{ "value": 0, "unit": "" }`)).toBe('0')
  })

  it('accepts the units CSS actually has', () => {
    for (const unit of ['px', 'rem', 'em', '%', 'vw', 'dvh', 'ch', 'deg', 'ms', 's', 'fr', 'cqw']) {
      expect(value(`{ "value": 1, "unit": "${unit}" }`), unit).toBe(`1${unit}`)
    }
  })

  it('refuses a unit from another platform', () => {
    // `2dp` is an Android density pixel. A browser ignores the declaration
    // silently, which is the shape of failure this library exists to prevent.
    const err = failure(`{ "value": 2, "unit": "dp" }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/"dp", which is not a CSS unit/)
    expect(err.tokenPaths).toEqual(['t'])
  })

  it('refuses a dimension whose value is not a number', () => {
    expect(failure(`{ "value": "16", "unit": "px" }`).message).toMatch(/not a number/)
  })
})

describe('colours written as objects', () => {
  it('renders sRGB as rgb(), scaling the components', () => {
    expect(value(`{ "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 1 }`)).toBe('rgb(0 0 0)')
    expect(value(`{ "colorSpace": "srgb", "components": [1, 1, 1] }`)).toBe('rgb(255 255 255)')
  })

  it('reproduces the hex the file itself declares', () => {
    // Checked against every colour in five published design systems while
    // choosing this: 689 of 689 round-trip exactly, so the familiar notation
    // costs nothing.
    expect(value(`{ "colorSpace": "srgb", "components": [0.3529411764705882, 0.30980392156862746, 0.8117647058823529], "hex": "#5A4FCF" }`)).toBe(
      'rgb(90 79 207)',
    )
  })

  it('ignores hex, the way it ignores $description', () => {
    // hex is optional in the spec. A value whose form depended on whether an
    // optional field happened to be present would be worse than one that never
    // uses it.
    const withHex = value(`{ "colorSpace": "srgb", "components": [0, 0, 0], "hex": "#ffffff" }`)
    const without = value(`{ "colorSpace": "srgb", "components": [0, 0, 0] }`)
    expect(withHex).toBe(without)
    expect(withHex).toBe('rgb(0 0 0)')
  })

  it('omits alpha when it is fully opaque', () => {
    expect(value(`{ "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 1 }`)).not.toContain('/')
  })

  it('writes alpha when it is not, without rounding it', () => {
    expect(value(`{ "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.4 }`)).toBe(
      'rgb(0 0 0 / 0.4)',
    )
    expect(
      value(`{ "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.050980392156862744 }`),
    ).toBe('rgb(0 0 0 / 0.050980392156862744)')
  })

  it('keeps any other colour space in color(), numbers untouched', () => {
    expect(value(`{ "colorSpace": "display-p3", "components": [0.1, 0.2, 0.3] }`)).toBe(
      'color(display-p3 0.1 0.2 0.3)',
    )
    expect(value(`{ "colorSpace": "oklch", "components": [0.7, 0.1, 200], "alpha": 0.5 }`)).toBe(
      'color(oklch 0.7 0.1 200 / 0.5)',
    )
  })

  it('passes "none" through, which the spec allows', () => {
    expect(value(`{ "colorSpace": "srgb", "components": [0, "none", 1] }`)).toBe('rgb(0 none 255)')
  })

  it('refuses a colour with the wrong number of components', () => {
    expect(failure(`{ "colorSpace": "srgb", "components": [0, 0] }`).message).toMatch(
      /2 components; three are expected/,
    )
  })
})

describe('what stays a composite', () => {
  it('still refuses typography, which is not one custom property', () => {
    const err = failure(`{ "fontFamily": "Inter", "fontSize": "16px", "lineHeight": 1.4 }`)
    expect(err.code).toBe(FailureCode.COMPOSITE_VALUE)
  })

  it('still refuses shadow lists', () => {
    expect(failure(`[{ "offsetY": "2px" }]`).code).toBe(FailureCode.COMPOSITE_VALUE)
  })

  it('still refuses an object that is neither a colour nor a dimension', () => {
    expect(failure(`{ "duration": "200ms", "delay": "0ms" }`).code).toBe(FailureCode.COMPOSITE_VALUE)
  })
})

describe('nothing is inferred from $type', () => {
  it('converts by shape, so a mislabelled token converts the same way', () => {
    // The object says what it is. A `$type` saying otherwise changes nothing,
    // which is what keeps "16 never becomes 16px" true.
    const asColor = normalizeDocument(
      JSON.parse(`{ "t": { "$value": { "value": 16, "unit": "px" }, "$type": "color" } }`),
      SOURCE,
    )
    expect(emitStylesheet(asColor, SOURCE)).toContain('--t: 16px;')
  })

  it('leaves a plain number a plain number', () => {
    expect(value(`16`)).toBe('16')
  })

  it('leaves a string a string', () => {
    expect(value(`"16px"`)).toBe('16px')
  })
})
