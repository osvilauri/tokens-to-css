import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeDocuments } from '../src/merge/documents.js'
import { convertDocument, convertDocuments } from '../src/pipeline.js'
import { literal, ref, token, type TokenDoc } from '../src/model/index.js'
import { FailureCode, TokenCssError, generateCss } from '../src/index.js'

/**
 * Multi-file merge (FR-27).
 *
 * The corpus proves the bytes; this proves the rules that produce them, and the
 * ones a fixture cannot express — an empty list, a source that fails to load,
 * and the claim the whole release rests on: a single-source conversion is
 * untouched.
 */

const doc = (...tokens: TokenDoc['tokens']): TokenDoc => ({ tokens })

describe('mergeDocuments', () => {
  it('concatenates documents that share no paths, in order', () => {
    const merged = mergeDocuments([
      doc(token(['color', 'brand'], literal('#5A4FCF'))),
      doc(token(['size', 'md'], literal('16px'))),
    ])
    expect(merged.tokens.map((t) => t.path)).toEqual([['color', 'brand'], ['size', 'md']])
  })

  it('lets a later document win', () => {
    const merged = mergeDocuments([
      doc(token(['color', 'brand'], literal('#5A4FCF'))),
      doc(token(['color', 'brand'], literal('#000000'))),
    ])
    expect(merged.tokens).toHaveLength(1)
    expect(merged.tokens[0]!.value).toEqual(literal('#000000'))
  })

  it('keeps a redefined token where it first appeared', () => {
    // Appending it would move a custom property to the bottom of the stylesheet
    // the first time a theme layer touched it, and the diff of a generated file
    // is a thing this product protects (AD-10).
    const merged = mergeDocuments([
      doc(token(['a'], literal('1')), token(['b'], literal('2')), token(['c'], literal('3'))),
      doc(token(['a'], literal('9'))),
    ])
    expect(merged.tokens.map((t) => [t.path[0], (t.value as { value: string }).value])).toEqual([
      ['a', '9'],
      ['b', '2'],
      ['c', '3'],
    ])
  })

  it('does not merge two different tokens that spell the same dotted path', () => {
    // JSON lets a single key contain a dot, so `['color.brand']` and
    // `['color', 'brand']` are different tokens that both read as `color.brand`.
    // Keying the merge on the dotted form would silently make them one.
    const merged = mergeDocuments([
      doc(token(['color.brand'], literal('#5A4FCF'))),
      doc(token(['color', 'brand'], literal('#000000'))),
    ])
    expect(merged.tokens).toHaveLength(2)
  })

  it('returns a single document untouched', () => {
    const only = doc(token(['color', 'brand'], literal('#5A4FCF')))
    expect(mergeDocuments([only])).toBe(only)
  })
})

describe('converting several documents', () => {
  const raw = (value: unknown, source: string) => ({ raw: value, source })

  it('resolves a reference that crosses from one document into another', () => {
    const { css } = convertDocuments([
      raw({ primitive: { purple: { $value: '#5A4FCF' } } }, 'primitives.json'),
      raw({ semantic: { brand: { $value: '{primitive.purple}' } } }, 'semantic.json'),
    ])
    expect(css).toContain('--semantic-brand: var(--primitive-purple);')
  })

  it('still fails on a reference that lands nowhere even after the merge', () => {
    const err = catching(() =>
      convertDocuments([
        raw({ primitive: { purple: { $value: '#5A4FCF' } } }, 'a.json'),
        raw({ semantic: { brand: { $value: '{primitive.green}' } } }, 'b.json'),
      ]),
    )
    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
  })

  it('still fails when two documents emit the same custom-property name', () => {
    // A collision is two *different* paths fighting over one name, which the
    // merge cannot resolve and must not: it is not a redefinition (FR-21).
    const err = catching(() =>
      convertDocuments([
        raw({ color: { 'brand primary': { $value: '#5A4FCF' } } }, 'a.json'),
        raw({ color: { 'brand-primary': { $value: '#000000' } } }, 'b.json'),
      ]),
    )
    expect(err.code).toBe(FailureCode.NAME_COLLISION)
  })

  it('reads each document in its own dialect', () => {
    const { css } = convertDocuments([
      raw({ primitive: { purple: { $value: '#5A4FCF', $type: 'color' } } }, 'dtcg.json'),
      raw({ semantic: { brand: { value: '{primitive.purple}', type: 'color' } } }, 'legacy.json'),
    ])
    expect(css).toContain('--semantic-brand: var(--primitive-purple);')
  })

  it('converts when one source contributes nothing but its skips', () => {
    const { css, skipped } = convertDocuments([
      raw({ color: { brand: { $value: '#5A4FCF' } } }, 'color.json'),
      raw({ type: { body: { $value: { fontSize: '16px' }, $type: 'typography' } } }, 'type.json'),
    ])
    expect(skipped.map((s) => s.path)).toEqual(['type.body'])
    expect(css).toContain('--color-brand: #5A4FCF;')
  })

  it('fails when the merged document would declare nothing at all', () => {
    const err = catching(() =>
      convertDocuments([
        raw({ type: { body: { $value: { fontSize: '16px' }, $type: 'typography' } } }, 'a.json'),
        raw({ type: { lead: { $value: { fontSize: '20px' }, $type: 'typography' } } }, 'b.json'),
      ]),
    )
    expect(err.code).toBe(FailureCode.NOTHING_EMITTED)
    expect(err.tokenPaths).toEqual(['type.body', 'type.lead'])
  })

  it('refuses an empty list, naming the call rather than the documents', () => {
    const err = catching(() => convertDocuments([]))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toContain('empty')
  })

  it('leaves a single-document conversion byte-identical', () => {
    // The claim that keeps this release a minor.
    const input = { color: { brand: { $value: '#5A4FCF' }, alias: { $value: '{color.brand}' } } }
    const { css } = convertDocument(input, 'tokens.json')
    expect(css).toBe(':root {\n  --color-brand: #5A4FCF;\n  --color-alias: var(--color-brand);\n}\n')
  })

  it('names the conversion by its first source and a count, however long the list', () => {
    const err = catching(() =>
      convertDocuments([
        raw({ a: { $value: '{nope}' } }, 'first.json'),
        raw({ b: { $value: '1px' } }, 'second.json'),
        raw({ c: { $value: '2px' } }, 'third.json'),
      ]),
    )
    expect(err.source).toBe('first.json + 2 more')
  })
})

let base: string
const write = (name: string, contents: unknown): string => {
  const path = join(base, name)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(contents))
  return path
}

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'merge-')))
})
afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('generateCss over a list of sources', () => {
  it('writes one stylesheet and reports every source it merged, in order', async () => {
    const first = write('primitives.json', { primitive: { purple: { $value: '#5A4FCF' } } })
    const second = write('semantic.json', { semantic: { brand: { $value: '{primitive.purple}' } } })

    const result = await generateCss([first, second], { outDir: base })

    expect(result.sources).toEqual([first, second])
    expect(result.tokenCount).toBe(2)
    const css = readFileSync(result.outputPath, 'utf8')
    expect(css).toContain('--semantic-brand: var(--primitive-purple);')
    expect(css.startsWith('/* 2 sources merged, in order:')).toBe(true)
  })

  it('reports one source for a single-source conversion, so callers never branch', async () => {
    const only = write('tokens.json', { color: { brand: { $value: '#5A4FCF' } } })
    const result = await generateCss(only, { outDir: base })
    expect(result.sources).toEqual([only])
    expect(readFileSync(result.outputPath, 'utf8').startsWith(':root {')).toBe(true)
  })

  it('resolves relative sources against the same base as a single one does', async () => {
    write('tokens/primitives.json', { primitive: { purple: { $value: '#5A4FCF' } } })
    write('tokens/semantic.json', { semantic: { brand: { $value: '{primitive.purple}' } } })

    const result = await generateCss(['tokens/primitives.json', 'tokens/semantic.json'], {
      baseDir: base,
      outDir: base,
    })

    expect(result.sources).toEqual([
      join(base, 'tokens/primitives.json'),
      join(base, 'tokens/semantic.json'),
    ])
  })

  it('fails on the first source that cannot be read, in the order the caller wrote', async () => {
    const good = write('good.json', { color: { brand: { $value: '#5A4FCF' } } })
    const missing = join(base, 'missing.json')

    const err = await catchingAsync(() => generateCss([good, missing, good], { outDir: base }))

    expect(err.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(err.source).toBe(missing)
  })

  it('writes nothing when a later source makes the merge fail', async () => {
    const good = write('good.json', { color: { brand: { $value: '#5A4FCF' } } })
    const bad = write('bad.json', { color: { alias: { $value: '{color.nope}' } } })

    const err = await catchingAsync(() => generateCss([good, bad], { outDir: base }))

    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
    expect(() => readFileSync(join(base, 'tokens.css'), 'utf8')).toThrow()
  })

  it('refuses an empty list before it opens anything', async () => {
    const err = await catchingAsync(() => generateCss([], { outDir: base }))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })
})

function catching(run: () => unknown): TokenCssError {
  try {
    run()
  } catch (err) {
    expect(err).toBeInstanceOf(TokenCssError)
    return err as TokenCssError
  }
  throw new Error('expected this conversion to fail')
}

async function catchingAsync(run: () => Promise<unknown>): Promise<TokenCssError> {
  try {
    await run()
  } catch (err) {
    expect(err).toBeInstanceOf(TokenCssError)
    return err as TokenCssError
  }
  throw new Error('expected this conversion to fail')
}
