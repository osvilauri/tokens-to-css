import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIALECTS, normalizeDocument } from '../src/dialects/registry.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import { literal, ref, token } from '../src/model/index.js'

const SOURCE = 'design/tokens.json'
const read = (json: string): ReturnType<typeof normalizeDocument> =>
  normalizeDocument(JSON.parse(json), SOURCE)
const css = (json: string): string => emitStylesheet(read(json), SOURCE)

const failure = (json: string): TokenCssError => {
  try {
    read(json)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to be refused')
}

const wrap = (set: string, name = 'global'): string =>
  `{ "$themes": [], "$metadata": { "tokenSetOrder": ["${name}"] }, "${name}": ${set} }`

describe('the wrapper is dropped, and only the wrapper (AD-22)', () => {
  it('leaves the set name out of the emitted path', () => {
    const doc = read(wrap(`{ "color": { "brand": { "value": "#5A4FCF" } } }`))
    expect(doc.tokens).toEqual([token(['color', 'brand'], literal('#5A4FCF'))])
  })

  it('emits --color-brand, not --global-color-brand', () => {
    expect(css(wrap(`{ "color": { "brand": { "value": "#5A4FCF" } } }`))).toContain(
      '--color-brand: #5A4FCF;',
    )
  })

  it('keeps every key below the top level, even one that looks like a set name', () => {
    // "global" nested inside the set is an ordinary group. Only the outermost
    // key is a wrapper; guessing by name is how two implementations disagree.
    const doc = read(wrap(`{ "global": { "a": { "value": "1px" } } }`))
    expect(doc.tokens[0]!.path).toEqual(['global', 'a'])
  })

  it('works whatever the set is called', () => {
    const doc = read(wrap(`{ "a": { "value": "1px" } }`, 'brand-2024'))
    expect(doc.tokens[0]!.path).toEqual(['a'])
  })
})

describe('the plugin bookkeeping is read and ignored', () => {
  it('changes nothing about the output', () => {
    const withMetadata = read(wrap(`{ "a": { "value": "1px" } }`))
    const bare = read(`{ "a": { "$value": "1px" } }`)
    expect(withMetadata).toEqual(bare)
  })

  it('accepts an export carrying only $themes', () => {
    expect(read(`{ "$themes": [], "g": { "a": { "value": "1px" } } }`).tokens).toHaveLength(1)
  })

  it('accepts an export carrying only $metadata', () => {
    expect(read(`{ "$metadata": {}, "g": { "a": { "value": "1px" } } }`).tokens).toHaveLength(1)
  })

  it('refuses an export with bookkeeping and no tokens at all', () => {
    expect(failure(`{ "$themes": [], "$metadata": {} }`).message).toMatch(/no token set/)
  })
})

describe('either inner dialect works inside the wrapper', () => {
  it('reads legacy nodes', () => {
    expect(read(wrap(`{ "a": { "value": "1px", "type": "dimension" } }`)).tokens).toEqual([
      token(['a'], literal('1px')),
    ])
  })

  it('reads DTCG nodes', () => {
    expect(read(wrap(`{ "a": { "$value": "1px", "$type": "dimension" } }`)).tokens).toEqual([
      token(['a'], literal('1px')),
    ])
  })

  it('reads aliases, which are relative to the set rather than the file', () => {
    const doc = read(wrap(`{ "p": { "value": "#000" }, "s": { "value": "{p}" } }`))
    expect(doc.tokens[1]!.value).toEqual(ref(['p']))
    expect(css(wrap(`{ "p": { "value": "#000" }, "s": { "value": "{p}" } }`))).toContain(
      '--s: var(--p);',
    )
  })
})

describe('more than one set is refused (FR-17)', () => {
  it('names the sets and says why merging is not attempted', () => {
    const err = failure(
      `{ "$themes": [], "global": { "a": { "value": "1px" } }, "brand": { "b": { "value": "2px" } } }`,
    )
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/2 token sets \(global, brand\)/)
    expect(err.message).toMatch(/which one wins/)
  })
})

describe('expressions are refused, never evaluated (FR-17, NFR7)', () => {
  it('refuses arithmetic on a reference', () => {
    const err = failure(wrap(`{ "lg": { "value": "{md} * 2" } }`))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })

  it('refuses bare arithmetic, which no brace check would catch', () => {
    const err = failure(wrap(`{ "lg": { "value": "16 * 2" } }`))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/is an expression/)
    expect(err.message).toMatch(/resolve it in Tokens Studio/)
    expect(err.tokenPaths).toEqual(['lg'])
  })

  it('refuses the plugin helper functions', () => {
    expect(failure(wrap(`{ "a": { "value": "roundTo(16 / 3, 2)" } }`)).message).toMatch(
      /is an expression/,
    )
  })

  it.each(['8 + 8', '16 / 2', '2*4', '(8 + 8)', '1.5 * 2'])('refuses %s', (expression) => {
    expect(failure(wrap(`{ "a": { "value": "${expression}" } }`)).code).toBe(
      FailureCode.FORMAT_NOT_ALLOWED,
    )
  })

  it('lets valid CSS through untouched, however much it looks like maths', () => {
    // calc() and clamp() are values a browser understands. Refusing them would
    // be this library deciding it knows CSS better than CSS.
    for (const value of ['calc(100% - 16px)', 'clamp(1rem, 2vw, 3rem)', 'min(50%, 400px)']) {
      expect(css(wrap(`{ "a": { "value": "${value}" } }`)), value).toContain(`--a: ${value};`)
    }
  })

  it('lets a plain negative number through', () => {
    expect(css(wrap(`{ "a": { "value": -1 } }`))).toContain('--a: -1;')
    expect(css(wrap(`{ "a": { "value": "-1px" } }`))).toContain('--a: -1px;')
  })
})

/**
 * Reads the built bundle, and skips rather than crashing when there is none.
 *
 * `npm test` on its own, without a build, is a reasonable thing to run — so
 * this cannot throw at import time. The assertion still always runs where it
 * matters: both workflows build before they test, and a test below checks that
 * they still do.
 */
const bundlePath = new URL('../dist/index.js', import.meta.url)
const isBuilt = existsSync(bundlePath)

describe.skipIf(!isBuilt)('nothing in the package can evaluate anything', () => {
  const built = (): string => readFileSync(bundlePath, 'utf8')

  it('ships no eval and no Function constructor', () => {
    expect(built()).not.toMatch(/\beval\s*\(/)
    expect(built()).not.toMatch(/new\s+Function\s*\(/)
  })

  it('ships no expression parser', () => {
    for (const smell of ['parseExpression', 'evaluate(', 'tokenize(', 'mathjs']) {
      expect(built(), smell).not.toContain(smell)
    }
  })
})

describe('every workflow builds before it tests', () => {
  // The reason the block above can skip. If a workflow ever tests first, that
  // assertion would quietly stop running and nobody would notice — which for a
  // check about `eval` reaching the published bundle is the worst way to lose a
  // test.
  it.each(['ci.yml', 'release.yml'])('%s', (file) => {
    const workflow = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8')
    const build = workflow.indexOf('npm run build')
    const test = workflow.indexOf('npm test')
    expect(build, `${file} never builds`).toBeGreaterThan(-1)
    expect(test, `${file} never tests`).toBeGreaterThan(-1)
    expect(build, `${file} tests before it builds`).toBeLessThan(test)
  })
})

describe('detection order (AD-3)', () => {
  it('checks Tokens Studio first, because its documents contain the others', () => {
    expect(DIALECTS.map((d) => d.id)).toEqual(['tokens-studio', 'dtcg', 'sd-legacy'])
  })

  it('reads a wrapped document as Tokens Studio, not as the dialect inside it', () => {
    // Matched as DTCG this would keep the wrapper and emit --global-a.
    expect(read(wrap(`{ "a": { "$value": "1px" } }`)).tokens[0]!.path).toEqual(['a'])
  })

  it('names all three shapes when a document matches none', () => {
    const err = failure(`{ "a": { "nope": 1 } }`)
    for (const shape of ['Tokens Studio', 'DTCG', 'Style Dictionary legacy']) {
      expect(err.message).toContain(shape)
    }
  })
})
