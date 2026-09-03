import { describe, expect, it } from 'vitest'
import { DIALECTS, normalizeDocument } from '../src/dialects/registry.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import { literal, ref, token, type TokenDoc } from '../src/model/index.js'

const SOURCE = 'design/tokens.json'
const read = (json: string): TokenDoc => normalizeDocument(JSON.parse(json), SOURCE).doc

const failure = (json: string): TokenCssError => {
  try {
    read(json)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to be refused')
}

describe('reading a DTCG document', () => {
  it('turns nested groups into dotted token paths', () => {
    const doc = read(`{
      "color": { "brand": { "primary": { "$value": "#5A4FCF", "$type": "color" } } },
      "spacing": { "md": { "$value": "16px", "$type": "dimension" } }
    }`)
    expect(doc.tokens).toEqual([
      token(['color', 'brand', 'primary'], literal('#5A4FCF')),
      token(['spacing', 'md'], literal('16px')),
    ])
  })

  it('keeps document order', () => {
    const doc = read(`{ "z": { "$value": 1 }, "a": { "$value": 2 } }`)
    expect(doc.tokens.map((t) => t.path[0])).toEqual(['z', 'a'])
  })

  it('accepts any nesting depth — hierarchy is not a separate shape', () => {
    const threeTier = read(`{ "primitive": { "purple": { "$value": "#5A4FCF" } } }`)
    const eightShapes = read(`{ "ns": { "obj": { "base": { "mod": { "$value": "1px" } } } } }`)
    expect(threeTier.tokens[0]!.path).toEqual(['primitive', 'purple'])
    expect(eightShapes.tokens[0]!.path).toEqual(['ns', 'obj', 'base', 'mod'])
  })

  it('reads $description and lets it change nothing', () => {
    const withDescription = read(`{ "a": { "$value": "1px", "$description": "the gap" } }`)
    const without = read(`{ "a": { "$value": "1px" } }`)
    expect(withDescription).toEqual(without)
  })

  it('drops $type rather than inferring from it', () => {
    const doc = read(`{ "spacing": { "md": { "$value": 16, "$type": "dimension" } } }`)
    expect(doc.tokens[0]!.value).toEqual(literal(16))
    expect(JSON.stringify(doc)).not.toContain('dimension')
  })

  it('ignores $-prefixed document metadata', () => {
    const doc = read(`{ "$schema": "https://example.com/s.json", "a": { "$value": "1px" } }`)
    expect(doc.tokens).toEqual([token(['a'], literal('1px'))])
  })

  it('keeps a numeric value as a number, not a string', () => {
    expect(read(`{ "a": { "$value": 16 } }`).tokens[0]!.value).toEqual(literal(16))
  })
})

describe('references', () => {
  it('reads a whole-string {path} as a reference', () => {
    const doc = read(`{
      "color": { "brand": { "$value": "#5A4FCF" }, "text": { "$value": "{color.brand}" } }
    }`)
    expect(doc.tokens[1]!.value).toEqual(ref(['color', 'brand']))
  })

  it('tolerates surrounding whitespace', () => {
    expect(read(`{ "a": { "$value": " {b.c} " } }`).tokens[0]!.value).toEqual(ref(['b', 'c']))
  })

  it('does not check that the target exists — that is the alias graph pass', () => {
    expect(read(`{ "a": { "$value": "{nowhere}" } }`).tokens[0]!.value).toEqual(ref(['nowhere']))
  })

  it('refuses a reference embedded in a larger value', () => {
    const err = failure(`{ "border": { "$value": "1px solid {color.border}" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/reference inside a larger value/)
    expect(err.tokenPaths).toEqual(['border'])
  })

  it('refuses two references in one value', () => {
    expect(failure(`{ "a": { "$value": "{b} {c}" } }`).code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })

  it('refuses a malformed reference path', () => {
    expect(failure(`{ "a": { "$value": "{b..c}" } }`).message).toMatch(/not a token path/)
  })
})

describe('rejections that are structural', () => {
  it('refuses a root that is not an object', () => {
    for (const json of ['[]', '"a string"', '42', 'null']) {
      const err = failure(json)
      expect(err.code, json).toBe(FailureCode.FORMAT_NOT_ALLOWED)
      expect(err.message, json).toMatch(/must be a JSON object/)
    }
  })

  it('refuses a document with no token node, naming what is accepted', () => {
    const err = failure(`{ "color": { "brand": {} } }`)
    expect(err.message).toMatch(/no tokens were recognized/)
    expect(err.message).toMatch(/DTCG single-file documents using \$value/)
  })

  it('refuses a bare scalar where a group or token belongs, instead of dropping it', () => {
    const err = failure(`{ "color": { "red": "#f00" }, "a": { "$value": "1px" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/color\.red.*string.*group or a token/s)
  })

  it('refuses $ref and resolver-style multi-file documents', () => {
    const err = failure(`{ "color": { "$ref": "./palette.json" } }`)
    expect(err.message).toMatch(/single self-contained file/)
  })

  it('skips a composite value rather than stringifying it', () => {
    // The refusal to write `[object Object]` is unchanged. What changed with
    // FR-24 is that it costs the token rather than the document.
    const { doc, skipped } = normalizeDocument(
      JSON.parse(`{ "a": { "$value": "1px" }, "shadow": { "$value": { "offsetX": "0", "blur": "4px" } } }`),
      SOURCE,
    )
    expect(doc.tokens.map((t) => t.path)).toEqual([['a']])
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.path).toBe('shadow')
    expect(skipped[0]!.code).toBe(FailureCode.COMPOSITE_VALUE)
  })
})

describe('prototype pollution is refused, not survived (AD-9)', () => {
  const polluted = ['__proto__', 'constructor', 'prototype']

  it.each(polluted)('refuses "%s" as a key in the token tree', (key) => {
    const err = failure(`{ "${key}": { "polluted": { "$value": "1px" } }, "a": { "$value": "1px" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toContain(key)
  })

  it('leaves Object.prototype untouched', () => {
    const before = Object.keys(Object.prototype).length
    try {
      read(`{ "__proto__": { "polluted": { "$value": "yes" } }, "a": { "$value": "1px" } }`)
    } catch {
      /* refused, as it should be */
    }
    expect(Object.keys(Object.prototype).length).toBe(before)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})

describe('the registry', () => {
  it('carries one entry per allowlisted shape, each with an id and a description', () => {
    for (const dialect of DIALECTS) {
      expect(dialect.id).toMatch(/^[a-z-]+$/)
      expect(dialect.describedAs.length).toBeGreaterThan(0)
    }
  })

  it('holds the three shapes this version reads', () => {
    expect(DIALECTS.map((d) => d.id)).toEqual(['tokens-studio', 'dtcg', 'sd-legacy'])
  })

  it('detects first-match-wins, in the order the array declares', () => {
    const order = DIALECTS.map((d) => d.id)
    expect(order).toEqual([...order]) // the array itself is the precedence
  })
})

describe('a multi-file document is named as such, not as unrecognized', () => {
  it('says so even when the document carries no token marker at all', () => {
    // The whole point of catching this before detection: there is no $value
    // here, so no dialect claims the document and the generic message would
    // have won.
    const err = failure(`{ "color": { "$ref": "./palette.json" } }`)
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/single self-contained file/)
    expect(err.tokenPaths).toEqual(['color.$ref'])
  })

  it('says so even when the document also has real tokens', () => {
    const err = failure(`{ "a": { "$value": "1px" }, "b": { "$ref": "./more.json" } }`)
    expect(err.message).toMatch(/single self-contained file/)
  })
})
