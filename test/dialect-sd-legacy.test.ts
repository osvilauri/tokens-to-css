import { describe, expect, it } from 'vitest'
import { DIALECTS, normalizeDocument } from '../src/dialects/registry.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import { literal, ref, token, type TokenDoc } from '../src/model/index.js'

const SOURCE = 'design/tokens.json'
const read = (json: string): TokenDoc => normalizeDocument(JSON.parse(json), SOURCE).doc

const css = (json: string): string => {
  const { doc, skipped } = normalizeDocument(JSON.parse(json), SOURCE)
  return emitStylesheet(doc, skipped, SOURCE)
}

const failure = (json: string): TokenCssError => {
  try {
    read(json)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to be refused')
}

describe('reading a legacy document', () => {
  it('accepts value and type without the dollar', () => {
    const doc = read(`{
      "color": { "brand": { "primary": { "value": "#5A4FCF", "type": "color" } } },
      "spacing": { "md": { "value": "16px", "type": "dimension" } }
    }`)
    expect(doc.tokens).toEqual([
      token(['color', 'brand', 'primary'], literal('#5A4FCF')),
      token(['spacing', 'md'], literal('16px')),
    ])
  })

  it('drops type, exactly as it drops $type', () => {
    const doc = read(`{ "spacing": { "md": { "value": 16, "type": "dimension" } } }`)
    expect(doc.tokens[0]!.value).toEqual(literal(16))
    expect(JSON.stringify(doc)).not.toContain('dimension')
  })

  it('ignores the other keys Style Dictionary puts on a token', () => {
    const withExtras = read(`{
      "a": { "value": "1px", "type": "dimension", "comment": "the gap", "attributes": { "category": "size" } }
    }`)
    expect(withExtras).toEqual(read(`{ "a": { "value": "1px" } }`))
  })

  it('reads aliases the same way', () => {
    const doc = read(`{
      "color": { "brand": { "value": "#5A4FCF" }, "text": { "value": "{color.brand}" } }
    }`)
    expect(doc.tokens[1]!.value).toEqual(ref(['color', 'brand']))
  })

  it('accepts any nesting depth', () => {
    const doc = read(`{ "ns": { "obj": { "base": { "mod": { "value": "1px" } } } } }`)
    expect(doc.tokens[0]!.path).toEqual(['ns', 'obj', 'base', 'mod'])
  })
})

describe('post-normalization parity with DTCG (FR-18)', () => {
  const CATALOGUE = {
    dtcg: `{
      "primitive": { "purple": { "$value": "#5A4FCF", "$type": "color" } },
      "semantic": { "brand": { "$value": "{primitive.purple}" } },
      "component": { "button": { "$value": "{semantic.brand}" } }
    }`,
    legacy: `{
      "primitive": { "purple": { "value": "#5A4FCF", "type": "color" } },
      "semantic": { "brand": { "value": "{primitive.purple}" } },
      "component": { "button": { "value": "{semantic.brand}" } }
    }`,
  }

  it('produces the same internal representation', () => {
    expect(read(CATALOGUE.legacy)).toEqual(read(CATALOGUE.dtcg))
  })

  it('produces byte-identical stylesheets', () => {
    expect(css(CATALOGUE.legacy)).toBe(css(CATALOGUE.dtcg))
  })

  it('emits references as var(), not resolved values', () => {
    expect(css(CATALOGUE.legacy)).toContain('--component-button: var(--semantic-brand);')
  })

  it('is an input shape, never a mode — nothing downstream can tell', () => {
    const doc = read(CATALOGUE.legacy)
    expect(JSON.stringify(doc)).not.toMatch(/dialect|legacy|sd-/i)
  })
})

describe('a node speaking both dialects is refused, not resolved', () => {
  it('refuses $value and value on the same token', () => {
    const err = failure(`{ "a": { "$value": "1px", "value": "2px" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/both "\$value" and "value"/)
    expect(err.tokenPaths).toEqual(['a'])
  })

  it('names the offending node however deep it sits', () => {
    const err = failure(`{ "x": { "y": { "z": { "$value": 1, "value": 2 } } }, "ok": { "$value": 3 } }`)
    expect(err.message).toContain('"x.y.z"')
  })

  it('refuses it at the document root too', () => {
    expect(failure(`{ "$value": 1, "value": 2 }`).message).toMatch(/document root/)
  })

  it('would otherwise have dropped a key silently', () => {
    // First-match-wins reads this as DTCG. Without the check, "value" simply
    // vanishes between the file and the stylesheet.
    expect(() => read(`{ "a": { "$value": "1px", "value": "2px" } }`)).toThrow(TokenCssError)
  })
})

describe('a document mixing dialects across different nodes', () => {
  it('is decided by precedence, and the other dialect is refused rather than dropped', () => {
    // Any $value present means the document is read as DTCG. The legacy node
    // then looks like a group holding a stray scalar, which is a rejection.
    const err = failure(`{ "a": { "$value": "1px" }, "b": { "value": "2px" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/b\.value.*group or a token/s)
  })

  it('reads a document as legacy only when no $value exists anywhere', () => {
    const doc = read(`{ "a": { "value": "1px" }, "b": { "value": "2px" } }`)
    expect(doc.tokens).toHaveLength(2)
  })
})

describe('a Tokens Studio export is not read as legacy', () => {
  it('drops the set wrapper instead of folding it into every name', () => {
    // Before the Tokens Studio entry existed, this document matched here and
    // converted happily with every name wrong. The regression it guards
    // against is silent, so the test outlives the bug.
    const doc = read(`{ "$themes": [], "global": { "color": { "brand": { "value": "#000" } } } }`)
    expect(doc.tokens[0]!.path).toEqual(['color', 'brand'])
    expect(doc.tokens[0]!.path).not.toContain('global')
  })

  it('emits --color-brand rather than --global-color-brand', () => {
    const doc = read(`{ "$metadata": {}, "global": { "color": { "brand": { "value": "#000" } } } }`)
    expect(emitStylesheet(doc, [], SOURCE)).toContain('--color-brand: #000;')
  })
})

describe('the registry', () => {
  it('lists every shape, with Tokens Studio checked first', () => {
    expect(DIALECTS.map((d) => d.id)).toEqual(['tokens-studio', 'dtcg', 'sd-legacy'])
  })

  it('names them all when a document matches nothing', () => {
    const err = failure(`{ "a": { "nope": 1 } }`)
    expect(err.message).toContain('DTCG single-file documents using $value')
    expect(err.message).toContain('Style Dictionary legacy documents using value/type')
  })

  it('skips a composite legacy value rather than walking into it', () => {
    // The danger this guards is specific to the legacy dialect: a composite
    // `value` must reach the composite check, not be walked into as a group.
    const { doc, skipped } = normalizeDocument(
      JSON.parse(`{ "a": { "value": "1px" }, "shadow": { "value": { "offsetY": "2px" }, "type": "shadow" } }`),
      SOURCE,
    )
    expect(doc.tokens.map((t) => t.path)).toEqual([['a']])
    expect(skipped[0]!.path).toBe('shadow')
    expect(skipped[0]!.code).toBe(FailureCode.COMPOSITE_VALUE)
  })

  it('refuses an embedded reference in a legacy value', () => {
    expect(failure(`{ "b": { "value": "1px solid {color.border}" } }`).message).toMatch(
      /reference inside a larger value/,
    )
  })
})
