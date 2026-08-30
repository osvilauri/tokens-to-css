import { describe, expect, it } from 'vitest'
import { emitStylesheet } from '../src/emit/css.js'
import { literal, ref, token, type TokenDoc } from '../src/model/index.js'
import { compareGolden } from './support/corpus.js'

const SOURCE = 'design/tokens.json'
const emit = (doc: TokenDoc): string => emitStylesheet(doc, SOURCE)

/** The catalogue the fixture corpus will use, built here by hand. */
const CATALOGUE: TokenDoc = {
  tokens: [
    token(['color', 'brand', 'primary'], literal('#5A4FCF')),
    token(['color', 'text', 'accent'], ref(['color', 'brand', 'primary'])),
    token(['spacing', 'md'], literal('16px')),
  ],
}

describe('the shape of the stylesheet', () => {
  it('is one :root block of custom properties', () => {
    expect(emit(CATALOGUE)).toBe(
      ':root {\n' +
        '  --color-brand-primary: #5A4FCF;\n' +
        '  --color-text-accent: var(--color-brand-primary);\n' +
        '  --spacing-md: 16px;\n' +
        '}\n',
    )
  })

  it('ends with exactly one newline', () => {
    const css = emit(CATALOGUE)
    expect(css.endsWith('}\n')).toBe(true)
    expect(css.endsWith('\n\n')).toBe(false)
  })

  it('indents declarations with two spaces', () => {
    expect(emit(CATALOGUE)).toContain('\n  --color-brand-primary:')
  })

  it('handles a document with no tokens without producing something malformed', () => {
    // Upstream refuses a document with no recognizable token node (FR-14), so
    // this should not arrive — but if it does, the output is still valid CSS
    // rather than a truncated block.
    expect(emit({ tokens: [] })).toBe(':root {\n}\n')
  })
})

describe('declaration order is document order (AD-10)', () => {
  it('does not sort', () => {
    const doc: TokenDoc = {
      tokens: [
        token(['z'], literal(1)),
        token(['a'], literal(2)),
        token(['m'], literal(3)),
      ],
    }
    expect(emit(doc)).toBe(':root {\n  --z: 1;\n  --a: 2;\n  --m: 3;\n}\n')
  })

  it('keeps a reference before its target when the document did', () => {
    const doc: TokenDoc = {
      tokens: [
        token(['text'], ref(['brand'])),
        token(['brand'], literal('#000')),
      ],
    }
    // CSS custom properties resolve regardless of declaration order, so there
    // is no reason to reorder — and reordering would break byte-equality with
    // the token file's own structure.
    expect(emit(doc)).toBe(':root {\n  --text: var(--brand);\n  --brand: #000;\n}\n')
  })
})

describe('references are emitted, never resolved (FR-10)', () => {
  it('writes var(--target) instead of the target value', () => {
    const css = emit(CATALOGUE)
    expect(css).toContain('--color-text-accent: var(--color-brand-primary);')
    expect(css).not.toContain('--color-text-accent: #5A4FCF')
  })

  it('emits one hop per token in a multi-hop chain, never a collapsed literal', () => {
    const doc: TokenDoc = {
      tokens: [
        token(['primitive', 'purple'], literal('#5A4FCF')),
        token(['semantic', 'brand'], ref(['primitive', 'purple'])),
        token(['component', 'button', 'bg'], ref(['semantic', 'brand'])),
      ],
    }
    expect(emit(doc)).toBe(
      ':root {\n' +
        '  --primitive-purple: #5A4FCF;\n' +
        '  --semantic-brand: var(--primitive-purple);\n' +
        '  --component-button-bg: var(--semantic-brand);\n' +
        '}\n',
    )
  })

  it('names the target with the same rule as any other token', () => {
    const doc: TokenDoc = {
      tokens: [token(['a'], ref(['Color Brand', 'Primary']))],
    }
    expect(emit(doc)).toContain('var(--color-brand-primary)')
  })

  it('does not check that the target exists — that is the alias graph pass', () => {
    const doc: TokenDoc = { tokens: [token(['a'], ref(['nowhere']))] }
    expect(emit(doc)).toContain('var(--nowhere)')
  })
})

describe('values are written as the literal rule says', () => {
  it('writes a number without inventing a unit', () => {
    expect(emit({ tokens: [token(['spacing', 'md'], literal(16))] })).toContain('--spacing-md: 16;')
  })

  it('writes a multi-word string unquoted', () => {
    const doc: TokenDoc = { tokens: [token(['font'], literal('Helvetica Neue, sans-serif'))] }
    expect(emit(doc)).toContain('--font: Helvetica Neue, sans-serif;')
  })
})

describe('the output is reproducible', () => {
  it('is byte-identical across runs', () => {
    const first = emit(CATALOGUE)
    for (let i = 0; i < 20; i++) {
      expect(compareGolden(emit(CATALOGUE), first)).toBeNull()
    }
  })

  it('carries nothing that would differ between machines or moments', () => {
    const css = emit(CATALOGUE)
    expect(css).not.toMatch(/\d{4}-\d{2}-\d{2}/) // a date
    expect(css).not.toMatch(/\/(Users|home)\//) // an absolute path
    expect(css).not.toMatch(/https?:\/\//) // a hostname
    expect(css).not.toMatch(/\bv?\d+\.\d+\.\d+\b/) // a version string
    expect(css).not.toContain(SOURCE) // not even the source it came from
  })

  it('does not mutate the document it was given', () => {
    const doc: TokenDoc = { tokens: [token(['a'], literal(1))] }
    const snapshot = JSON.stringify(doc)
    emit(doc)
    expect(JSON.stringify(doc)).toBe(snapshot)
  })
})

describe('a naming failure stops emission', () => {
  it('propagates rather than writing a broken declaration', () => {
    const doc: TokenDoc = { tokens: [token(['color', '!!!'], literal('#fff'))] }
    expect(() => emit(doc)).toThrow(/no letters or digits/)
  })

  it('propagates when the failure is in a reference target', () => {
    const doc: TokenDoc = { tokens: [token(['a'], ref(['!!!']))] }
    expect(() => emit(doc)).toThrow(/no letters or digits/)
  })
})
