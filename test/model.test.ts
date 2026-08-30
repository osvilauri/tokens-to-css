import { readFileSync } from 'node:fs'
import { describe, expect, expectTypeOf, it } from 'vitest'
import * as api from '../src/index.js'
import {
  formatPath,
  isLiteral,
  isRef,
  literal,
  ref,
  token,
} from '../src/model/index.js'
import type { TokenDoc, TokenNode, TokenValue } from '../src/model/index.js'

describe('the shape of a token', () => {
  it('is a path plus a value that is either a reference or a literal', () => {
    expectTypeOf<TokenNode>().toEqualTypeOf<{
      readonly path: readonly string[]
      readonly value: TokenValue
    }>()
  })

  it('carries no metadata from the source dialect', () => {
    const node = token(['color', 'brand', 'primary'], literal('#5A4FCF'))
    // $type, $description and $extensions are read and dropped by the
    // normalizers. Threading them here would invite inference the PRD forbids.
    expect(Object.keys(node).sort()).toEqual(['path', 'value'])
    expect(Object.keys(node.value).sort()).toEqual(['kind', 'value'])
  })

  it('holds only scalars as literals', () => {
    expectTypeOf(literal).parameter(0).toEqualTypeOf<string | number>()
  })

  it('keeps a reference as a path, not as a resolved value', () => {
    const node = token(['color', 'text'], ref(['color', 'brand', 'primary']))
    expect(node.value).toEqual({ kind: 'ref', path: ['color', 'brand', 'primary'] })
    expect(node.value).not.toHaveProperty('value')
  })
})

describe('the shape of a document', () => {
  it('is an ordered array, not a keyed structure', () => {
    expectTypeOf<TokenDoc>().toEqualTypeOf<{ readonly tokens: readonly TokenNode[] }>()
  })

  it('preserves the order it was built in', () => {
    const doc: TokenDoc = {
      tokens: [
        token(['z'], literal(1)),
        token(['a'], literal(2)),
        token(['m'], literal(3)),
      ],
    }
    expect(doc.tokens.map((t) => t.path[0])).toEqual(['z', 'a', 'm'])
  })
})

describe('narrowing a value', () => {
  it('tells a reference from a literal', () => {
    expect(isRef(ref(['a']))).toBe(true)
    expect(isRef(literal('x'))).toBe(false)
    expect(isLiteral(literal('x'))).toBe(true)
    expect(isLiteral(ref(['a']))).toBe(false)
  })

  it('narrows the type, not just the value', () => {
    const reference: TokenValue = ref(['color', 'brand'])
    if (isRef(reference)) {
      expectTypeOf(reference.path).toEqualTypeOf<readonly string[]>()
    } else {
      throw new Error('unreachable')
    }

    const scalar: TokenValue = literal('#5A4FCF')
    if (isLiteral(scalar)) {
      expectTypeOf(scalar.value).toEqualTypeOf<string | number>()
    } else {
      throw new Error('unreachable')
    }
  })
})

describe('rendering a path for humans', () => {
  it('joins segments with dots, the way the token document wrote them', () => {
    expect(formatPath(['color', 'brand', 'primary'])).toBe('color.brand.primary')
  })

  it('handles a single segment and an empty path', () => {
    expect(formatPath(['spacing'])).toBe('spacing')
    expect(formatPath([])).toBe('')
  })

  it('does not sanitize — this is not the custom-property naming rule', () => {
    expect(formatPath(['Color Brand', 'Primary!'])).toBe('Color Brand.Primary!')
  })
})

describe('the model sits at the bottom of the dependency graph', () => {
  const source = readFileSync(new URL('../src/model/index.ts', import.meta.url), 'utf8')

  it('imports nothing at all', () => {
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\brequire\s*\(/)
  })

  it('is not part of the public surface', () => {
    for (const name of ['literal', 'ref', 'token', 'isRef', 'isLiteral', 'formatPath']) {
      expect(Object.keys(api)).not.toContain(name)
    }
  })
})
