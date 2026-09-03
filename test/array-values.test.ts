import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../src/dialects/registry.js'
import { emitStylesheet } from '../src/emit/css.js'
import { FailureCode } from '../src/index.js'

const SOURCE = 'design/tokens.json'

const value = (json: string): string => {
  const { doc, skipped } = normalizeDocument(
    JSON.parse(`{ "t": { "$value": ${json} } }`),
    SOURCE,
  )
  return emitStylesheet(doc, skipped, SOURCE).match(/--t: (.+);/)![1]!
}

const skip = (json: string): { path: string; code: string } => {
  const { skipped } = normalizeDocument(
    JSON.parse(`{ "keep": { "$value": "1px" }, "t": { "$value": ${json} } }`),
    SOURCE,
  )
  expect(skipped, `expected ${json} to be skipped`).toHaveLength(1)
  return { path: skipped[0]!.path, code: skipped[0]!.code }
}

/**
 * FR-26. An array of names and four numbers are one CSS value each, refused
 * until now for being arrays — the same mistake FR-23 fixed for objects, still
 * standing in the other notation.
 */
describe('font families written as an array', () => {
  it('joins the names with a comma', () => {
    expect(value(`["Monaco", "Consolas", "monospace"]`)).toBe('Monaco, Consolas, monospace')
  })

  it('quotes a name that is more than one word', () => {
    expect(value(`["Monaco", "Lucida Console", "monospace"]`)).toBe(
      'Monaco, "Lucida Console", monospace',
    )
  })

  it('never quotes a generic family', () => {
    // Quoting one turns the generic family into a font that does not exist, so
    // the declaration stops falling back and starts failing.
    for (const generic of ['serif', 'sans-serif', 'monospace', 'system-ui', 'ui-rounded']) {
      expect(value(`["${generic}"]`)).toBe(generic)
    }
  })

  it('leaves a leading-hyphen vendor name unquoted, because it is a valid identifier', () => {
    expect(value(`["-apple-system", "BlinkMacSystemFont"]`)).toBe(
      '-apple-system, BlinkMacSystemFont',
    )
  })

  it('quotes a name that starts with a digit', () => {
    expect(value(`["0xProto", "monospace"]`)).toBe('"0xProto", monospace')
  })

  it('quotes a name that collides with a CSS-wide keyword', () => {
    expect(value(`["inherit"]`)).toBe('"inherit"')
  })

  it('passes through an entry that already holds a whole stack', () => {
    // Microsoft Fluent and GitHub Primer both write one pre-quoted stack where
    // the spec says one name goes. Quoting that would produce a single bogus
    // font name — silently, which is the failure this product exists to avoid.
    const stack = `'Mona Sans VF', -apple-system, 'Segoe UI', sans-serif`
    expect(value(`["${stack.replace(/'/g, "'")}"]`)).toBe(stack)
  })

  it('handles the four notations the 2026-09-02 survey found, all producing valid CSS', () => {
    expect(value(`["Monaco", "Consolas", "monospace"]`)).toBe('Monaco, Consolas, monospace')
    expect(value(`["SF Pro"]`)).toBe('"SF Pro"')
    expect(value(`"'Segoe UI', -apple-system, sans-serif"`)).toBe(
      `'Segoe UI', -apple-system, sans-serif`,
    )
    expect(value(`["'Mona Sans VF', Helvetica, sans-serif"]`)).toBe(
      `'Mona Sans VF', Helvetica, sans-serif`,
    )
  })
})

describe('easing curves written as four numbers', () => {
  it('becomes the CSS function', () => {
    expect(value(`[0.2, 0, 0, 1]`)).toBe('cubic-bezier(0.2, 0, 0, 1)')
  })

  it('reads a linear curve, all zeroes and ones', () => {
    expect(value(`[0, 0, 1, 1]`)).toBe('cubic-bezier(0, 0, 1, 1)')
  })

  it('reads negative control points, which overshoot and are legal', () => {
    expect(value(`[0.5, -0.5, 0.5, 1.5]`)).toBe('cubic-bezier(0.5, -0.5, 0.5, 1.5)')
  })
})

describe('an array that is neither is skipped, not guessed at', () => {
  it.each([
    ['empty', `[]`],
    ['mixed types', `["a", 1]`],
    ['three numbers', `[0, 0, 1]`],
    ['five numbers', `[0, 0, 1, 1, 1]`],
    ['a list of objects that is no composite', `[{ "nonsense": 1 }]`],
    ['an empty name', `["Monaco", ""]`],
  ])('skips %s', (_kind, json) => {
    expect(skip(json)).toEqual({ path: 't', code: FailureCode.COMPOSITE_VALUE })
  })

  it('skips an array holding a reference rather than emitting the braces', () => {
    // Property-level references are out of scope. Quoting one would emit
    // `font-family: "{font.family.base}"`, which is valid CSS that does nothing.
    expect(skip(`["{font.family.base}", "sans-serif"]`).code).toBe(FailureCode.COMPOSITE_VALUE)
  })
})

describe('recognition reads the shape, never the declared type', () => {
  it('converts an array of names whatever $type claims', () => {
    const { doc } = normalizeDocument(
      JSON.parse(`{ "t": { "$value": ["Monaco", "monospace"], "$type": "shadow" } }`),
      SOURCE,
    )
    expect(doc.tokens).toHaveLength(1)
  })

  it('converts four numbers whatever $type claims', () => {
    const { doc } = normalizeDocument(
      JSON.parse(`{ "t": { "$value": [0, 0, 1, 1], "$type": "fontFamily" } }`),
      SOURCE,
    )
    expect(doc.tokens).toHaveLength(1)
  })
})
