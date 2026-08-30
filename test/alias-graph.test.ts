import { describe, expect, it } from 'vitest'
import { validateAliasGraph } from '../src/validate/alias-graph.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import { literal, ref, token, type TokenDoc } from '../src/model/index.js'

const SOURCE = 'design/tokens.json'
const doc = (...tokens: TokenDoc['tokens']): TokenDoc => ({ tokens })

const failure = (d: TokenDoc): TokenCssError => {
  try {
    validateAliasGraph(d, SOURCE)
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this document to be refused')
}

describe('a sound graph passes', () => {
  it('accepts literals only', () => {
    expect(() =>
      validateAliasGraph(doc(token(['a'], literal('1px')), token(['b'], literal(2))), SOURCE),
    ).not.toThrow()
  })

  it('accepts a reference to a token declared later', () => {
    expect(() =>
      validateAliasGraph(doc(token(['a'], ref(['b'])), token(['b'], literal('1px'))), SOURCE),
    ).not.toThrow()
  })

  it('accepts a long chain', () => {
    const tokens = [token(['t0'], literal('#000'))]
    for (let i = 1; i < 500; i++) tokens.push(token([`t${i}`], ref([`t${i - 1}`])))
    expect(() => validateAliasGraph(doc(...tokens), SOURCE)).not.toThrow()
  })

  it('accepts many references to the same target', () => {
    expect(() =>
      validateAliasGraph(
        doc(
          token(['base'], literal('#000')),
          token(['a'], ref(['base'])),
          token(['b'], ref(['base'])),
          token(['c'], ref(['base'])),
        ),
        SOURCE,
      ),
    ).not.toThrow()
  })
})

describe('dangling references (FR-22)', () => {
  it('names the referring token and the missing target', () => {
    const err = failure(doc(token(['color', 'text'], ref(['color', 'brand', 'primry']))))
    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
    expect(err.message).toContain('color.text')
    expect(err.message).toContain('color.brand.primry')
    expect(err.message).toMatch(/does not exist/)
    expect(err.source).toBe(SOURCE)
  })

  it('reports every dangling reference, not just the first', () => {
    const err = failure(
      doc(
        token(['a'], ref(['missing', 'one'])),
        token(['b'], literal('#000')),
        token(['c'], ref(['missing', 'two'])),
        token(['d'], ref(['missing', 'three'])),
      ),
    )
    expect(err.tokenPaths).toEqual(['a', 'c', 'd'])
    expect(err.message).toContain('3 references point nowhere')
    for (const missing of ['missing.one', 'missing.two', 'missing.three']) {
      expect(err.message).toContain(missing)
    }
  })

  it('says "a group of tokens" when the target is a group, not a typo', () => {
    // Being told "color.brand does not exist" while looking straight at
    // color.brand in the file is how a developer ends up reading library source.
    const err = failure(
      doc(
        token(['color', 'brand', 'primary'], literal('#5A4FCF')),
        token(['color', 'text'], ref(['color', 'brand'])),
      ),
    )
    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
    expect(err.message).toMatch(/is a group of tokens rather than a token/)
  })

  it('does not mistake a partial name for a group', () => {
    const err = failure(
      doc(token(['colorful'], literal('#000')), token(['a'], ref(['color']))),
    )
    expect(err.message).toMatch(/does not exist/)
  })

  it('uses the singular for one problem', () => {
    expect(failure(doc(token(['a'], ref(['x'])))).message).toContain('1 reference points nowhere')
  })
})

describe('cycles (FR-15)', () => {
  it('catches a token referencing itself', () => {
    const err = failure(doc(token(['a'], ref(['a']))))
    expect(err.code).toBe(FailureCode.ALIAS_CYCLE)
    expect(err.tokenPaths).toEqual(['a'])
    expect(err.message).toContain('a → a')
  })

  it('catches a two-token loop', () => {
    const err = failure(doc(token(['a'], ref(['b'])), token(['b'], ref(['a']))))
    expect(err.code).toBe(FailureCode.ALIAS_CYCLE)
    expect(new Set(err.tokenPaths)).toEqual(new Set(['a', 'b']))
  })

  it('names every token in a longer loop, in order', () => {
    const err = failure(
      doc(token(['a'], ref(['b'])), token(['b'], ref(['c'])), token(['c'], ref(['a']))),
    )
    expect(err.message).toContain('a → b → c → a')
  })

  it('reports the loop only, not the tail that leads into it', () => {
    const err = failure(
      doc(
        token(['tail'], ref(['a'])),
        token(['a'], ref(['b'])),
        token(['b'], ref(['a'])),
      ),
    )
    expect(new Set(err.tokenPaths)).toEqual(new Set(['a', 'b']))
    expect(err.tokenPaths).not.toContain('tail')
  })

  it('reports several independent cycles in one run', () => {
    const err = failure(
      doc(
        token(['a'], ref(['b'])),
        token(['b'], ref(['a'])),
        token(['x'], ref(['y'])),
        token(['y'], ref(['x'])),
      ),
    )
    expect(err.message).toContain('2 alias cycles found')
    expect(new Set(err.tokenPaths)).toEqual(new Set(['a', 'b', 'x', 'y']))
  })

  it('reports each cycle once, however many tokens lead into it', () => {
    const err = failure(
      doc(
        token(['in1'], ref(['a'])),
        token(['in2'], ref(['a'])),
        token(['a'], ref(['b'])),
        token(['b'], ref(['a'])),
      ),
    )
    expect(err.message).toContain('1 alias cycle found')
  })

  it('survives a cycle far deeper than a recursive walk would', () => {
    const tokens = []
    for (let i = 0; i < 20_000; i++) tokens.push(token([`t${i}`], ref([`t${i + 1}`])))
    tokens.push(token(['t20000'], ref(['t0'])))
    const err = failure(doc(...tokens))
    expect(err.code).toBe(FailureCode.ALIAS_CYCLE)
    expect(err.tokenPaths).toHaveLength(20_001)
  })
})

describe('the two failures are told apart by code alone', () => {
  it('gives different codes', () => {
    expect(failure(doc(token(['a'], ref(['a'])))).code).toBe(FailureCode.ALIAS_CYCLE)
    expect(failure(doc(token(['a'], ref(['b'])))).code).toBe(FailureCode.ALIAS_DANGLING)
  })

  it('reports the dangling reference first when a document has both', () => {
    // A typo can invent a loop that would not exist otherwise. Telling someone
    // about the loop first sends them looking for a problem they do not have.
    const err = failure(
      doc(
        token(['a'], ref(['b'])),
        token(['b'], ref(['a'])),
        token(['c'], ref(['typo'])),
      ),
    )
    expect(err.code).toBe(FailureCode.ALIAS_DANGLING)
  })
})
