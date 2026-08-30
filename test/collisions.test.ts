import { describe, expect, it } from 'vitest'
import { validateNoCollisions } from '../src/validate/collisions.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import { literal, token, type TokenDoc } from '../src/model/index.js'

const SOURCE = 'design/tokens.json'
const doc = (...tokens: TokenDoc['tokens']): TokenDoc => ({ tokens })

const failure = (d: TokenDoc): TokenCssError => {
  try {
    validateNoCollisions(d, SOURCE)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to be refused')
}

describe('distinct names pass', () => {
  it('accepts a document where every token names something different', () => {
    expect(() =>
      validateNoCollisions(
        doc(
          token(['color', 'brand', 'primary'], literal('#5A4FCF')),
          token(['color', 'brand', 'secondary'], literal('#000')),
          token(['spacing', 'md'], literal('16px')),
        ),
        SOURCE,
      ),
    ).not.toThrow()
  })

  it('accepts an empty document', () => {
    expect(() => validateNoCollisions(doc(), SOURCE)).not.toThrow()
  })
})

describe('collisions the naming rule itself creates (AD-12)', () => {
  it('catches a dot and a dash arriving at the same property', () => {
    // Neither path is a duplicate of the other. Comparing paths would find
    // nothing; comparing emitted names finds this.
    const err = failure(
      doc(
        token(['color', 'brand', 'primary'], literal('#5A4FCF')),
        token(['color', 'brand-primary'], literal('#000')),
      ),
    )
    expect(err.code).toBe(FailureCode.NAME_COLLISION)
    expect(err.message).toContain('--color-brand-primary')
    expect(err.message).toContain('color.brand.primary')
    expect(err.message).toContain('color.brand-primary')
  })

  it('catches a case difference', () => {
    const err = failure(doc(token(['Brand'], literal(1)), token(['brand'], literal(2))))
    expect(err.message).toContain('--brand')
  })

  it('catches an accent that the naming rule strips', () => {
    // café collapses to --caf, and so does caf. This is the collision a
    // developer will never predict, and the one silence would hurt most.
    const err = failure(doc(token(['café'], literal(1)), token(['caf'], literal(2))))
    expect(err.code).toBe(FailureCode.NAME_COLLISION)
    expect(err.message).toContain('--caf')
  })

  it('catches separators that collapse to the same dash', () => {
    const err = failure(
      doc(
        token(['color brand'], literal(1)),
        token(['color_brand'], literal(2)),
        token(['color.brand'], literal(3)),
      ),
    )
    expect(err.tokenPaths).toHaveLength(3)
  })
})

describe('what the failure tells the developer', () => {
  it('names the property and every token claiming it', () => {
    const err = failure(
      doc(
        token(['a', 'b'], literal(1)),
        token(['a-b'], literal(2)),
        token(['a_b'], literal(3)),
      ),
    )
    expect(err.tokenPaths).toEqual(['a.b', 'a-b', 'a_b'])
    expect(err.message).toMatch(/--a-b ← "a\.b", "a-b", "a_b"/)
  })

  it('reports every colliding group in one run, not just the first', () => {
    const err = failure(
      doc(
        token(['a', 'b'], literal(1)),
        token(['a-b'], literal(2)),
        token(['x', 'y'], literal(3)),
        token(['x-y'], literal(4)),
      ),
    )
    expect(err.message).toContain('2 custom properties are claimed')
    expect(err.tokenPaths).toEqual(['a.b', 'a-b', 'x.y', 'x-y'])
  })

  it('uses the singular for a single collision', () => {
    const err = failure(doc(token(['a', 'b'], literal(1)), token(['a-b'], literal(2))))
    expect(err.message).toContain('1 custom property is claimed')
  })

  it('says it will not pick a winner, so nobody expects last-wins', () => {
    const err = failure(doc(token(['a', 'b'], literal(1)), token(['a-b'], literal(2))))
    expect(err.message).toMatch(/will not pick a winner/)
  })

  it('carries the source', () => {
    expect(failure(doc(token(['a', 'b'], literal(1)), token(['a-b'], literal(2)))).source).toBe(
      SOURCE,
    )
  })
})

describe('a name that cannot be built stops the pass', () => {
  it('surfaces the naming failure rather than reporting a collision', () => {
    const err = failure(doc(token(['color', '!!!'], literal(1))))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
  })
})
