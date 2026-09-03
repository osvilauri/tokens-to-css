import { describe, expect, it } from 'vitest'
import { convertDocument } from '../src/pipeline.js'
import { FailureCode, TokenCssError } from '../src/index.js'

const SOURCE = 'design/tokens.json'
const convert = (json: string): ReturnType<typeof convertDocument> =>
  convertDocument(JSON.parse(json), SOURCE)

const failure = (json: string): TokenCssError => {
  try {
    convert(json)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to fail')
}

/**
 * FR-24. A token this library cannot write no longer costs the document it
 * lives in — but a token that vanishes quietly is the exact failure the product
 * exists to prevent, so most of what is asserted here is about the announcing,
 * not the skipping.
 */
describe('what is skipped, and what still fails whole', () => {
  it('skips a value that cannot be written and converts the rest', () => {
    const { css, tokenCount, skipped } = convert(`{
      "color": { "brand": { "$value": "#5A4FCF" } },
      "type": { "body": { "$value": { "fontSize": "16px" } } }
    }`)
    expect(tokenCount).toBe(1)
    expect(css).toContain('--color-brand: #5A4FCF;')
    expect(skipped.map((s) => s.path)).toEqual(['type.body'])
  })

  it('still fails whole on a document that is not shaped the way it claims', () => {
    // Not about one token's value: there is no partial answer to give.
    expect(failure(`{ "a": { "$value": "1px" }, "b": 5 }`).code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(failure(`{ "__proto__": { "$value": "1px" } }`).code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })

  it('still fails whole on a dangling reference, an alias cycle, and a collision', () => {
    expect(failure(`{ "a": { "$value": "{nowhere}" } }`).code).toBe(FailureCode.ALIAS_DANGLING)
    expect(failure(`{ "a": { "$value": "{b}" }, "b": { "$value": "{a}" } }`).code).toBe(
      FailureCode.ALIAS_CYCLE,
    )
    expect(failure(`{ "a b": { "$value": "1px" }, "a-b": { "$value": "2px" } }`).code).toBe(
      FailureCode.NAME_COLLISION,
    )
  })

  it('keeps a reference to a skipped token dangling, and fatal', () => {
    // This falls out of the stage order rather than being enforced: skips
    // happen in normalization, the alias graph is validated after it. Skipping
    // therefore cannot quietly hollow out a token that survived.
    const err = failure(`{
      "type": { "body": { "$value": { "fontSize": "16px" } } },
      "heading": { "$value": "{type.body}" }
    }`)
    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
  })

  it('fails rather than writing a stylesheet that declares nothing', () => {
    const err = failure(`{
      "a": { "$value": { "fontSize": "16px" } },
      "b": { "$value": { "fontSize": "18px" } }
    }`)
    expect(err.code).toBe(FailureCode.NOTHING_EMITTED)
    expect(err.tokenPaths).toEqual(['a', 'b'])
    // The message says why each one went, not just that nothing came out.
    expect(err.message).toContain('"a"')
    expect(err.message).toContain('"b"')
  })

  it('distinguishes "everything was skipped" from "nothing was recognized"', () => {
    // Both end with an empty stylesheet, and sending a developer to the wrong
    // one of these two costs an afternoon.
    expect(failure(`{ "a": { "$value": { "fontSize": "16px" } } }`).code).toBe(
      FailureCode.NOTHING_EMITTED,
    )
    expect(failure(`{ "a": { "b": {} } }`).code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })
})

describe('the omission is announced twice', () => {
  it('reports every skipped token on the result, with a code and a reason', () => {
    const { skipped } = convert(`{
      "keep": { "$value": "1px" },
      "a": { "$value": { "fontSize": "16px" } }
    }`)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.path).toBe('a')
    expect(skipped[0]!.code).toBe(FailureCode.COMPOSITE_VALUE)
    expect(skipped[0]!.reason).toContain('"a"')
  })

  it('names them in a comment above the rule, where a diff will show it', () => {
    const { css } = convert(`{
      "keep": { "$value": "1px" },
      "a": { "$value": { "fontSize": "16px" } }
    }`)
    expect(css.startsWith('/* 1 token was skipped:\n')).toBe(true)
    expect(css).toMatch(/^ \*   token "a" has an object as its value/m)
    expect(css).toContain(' */\n:root {')
  })

  it('counts in the plural when there is more than one', () => {
    const { css } = convert(`{
      "keep": { "$value": "1px" },
      "a": { "$value": {} },
      "b": { "$value": [] }
    }`)
    expect(css.startsWith('/* 2 tokens were skipped:\n')).toBe(true)
  })
})

describe('one pass reports every unwritable token, not the first (AD-5)', () => {
  it('collects them all', () => {
    const { skipped } = convert(`{
      "keep": { "$value": "1px" },
      "a": { "$value": {} },
      "b": { "$value": [] },
      "c": { "$value": true },
      "d": { "$value": null }
    }`)
    expect(skipped.map((s) => s.path)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reports them in document order, the order the stylesheet uses', () => {
    const { skipped } = convert(`{
      "z": { "$value": {} },
      "keep": { "$value": "1px" },
      "a": { "$value": {} }
    }`)
    expect(skipped.map((s) => s.path)).toEqual(['z', 'a'])
  })
})

describe('a conversion that loses nothing is unchanged', () => {
  it('emits no comment block and an empty skipped list', () => {
    const { css, skipped } = convert(`{ "color": { "brand": { "$value": "#5A4FCF" } } }`)
    expect(skipped).toEqual([])
    expect(css).toBe(':root {\n  --color-brand: #5A4FCF;\n}\n')
  })

  it('is what keeps this release a minor: the bytes 1.0.0 produced are the bytes produced now', () => {
    // Every accept fixture is a golden of exactly this claim; this is the
    // narrow assertion that the comment block is opt-in on content, not on a
    // flag somebody could forget to pass.
    const { css } = convert(`{ "a": { "$value": "1px" }, "b": { "$value": "{a}" } }`)
    expect(css).not.toContain('/*')
  })
})
