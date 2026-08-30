import { execFileSync } from 'node:child_process'
import { describe, expect, expectTypeOf, it } from 'vitest'
import * as api from '../src/index.js'
import { FailureCode, TokenCssError } from '../src/index.js'
import type { GenerateCssOptions, GenerateCssResult, HttpOptions } from '../src/index.js'

/**
 * What this package promises the outside world. Every assertion here is a
 * semver commitment: if one has to change, the version has to move with it.
 */
describe('the exported surface', () => {
  it('is exactly this and nothing more', () => {
    expect(Object.keys(api).sort()).toEqual([
      'DEFAULTS',
      'FailureCode',
      'TokenCssError',
      'generateCss',
    ])
  })
})

describe('FailureCode', () => {
  it('has exactly the eight failure classes', () => {
    expect(Object.keys(FailureCode)).toEqual([
      'SOURCE_UNREADABLE',
      'SOURCE_INVALID_JSON',
      'FORMAT_NOT_ALLOWED',
      'ALIAS_CYCLE',
      'ALIAS_DANGLING',
      'COMPOSITE_VALUE',
      'NAME_COLLISION',
      'OUTPUT_WRITE_FAILED',
    ])
  })

  it('is frozen, so a caller cannot add a code at runtime', () => {
    expect(Object.isFrozen(FailureCode)).toBe(true)
  })

  it('uses each key as its own value, so a code survives serialization', () => {
    for (const [key, value] of Object.entries(FailureCode)) expect(value).toBe(key)
  })
})

describe('TokenCssError', () => {
  const err = new TokenCssError('could not read the token source', {
    code: FailureCode.SOURCE_UNREADABLE,
    source: 'design/tokens.json',
  })

  it('is a real Error, so existing handling still works', () => {
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('TokenCssError')
    expect(err.message).toBe('could not read the token source')
  })

  it('carries the code and the source a caller needs to react', () => {
    expect(err.code).toBe('SOURCE_UNREADABLE')
    expect(err.source).toBe('design/tokens.json')
  })

  it('defaults tokenPaths to empty rather than undefined', () => {
    expect(err.tokenPaths).toEqual([])
  })

  it('carries token paths for token-scoped failures', () => {
    const scoped = new TokenCssError('two tokens want the same name', {
      code: FailureCode.NAME_COLLISION,
      source: 'design/tokens.json',
      tokenPaths: ['color.brand.primary', 'color.brand-primary'],
    })
    expect(scoped.tokenPaths).toEqual(['color.brand.primary', 'color.brand-primary'])
  })

  it('preserves an underlying cause', () => {
    const cause = new Error('ENOENT')
    const wrapped = new TokenCssError('missing', {
      code: FailureCode.SOURCE_UNREADABLE,
      source: 'x.json',
      cause,
    })
    expect(wrapped.cause).toBe(cause)
  })

  it('has no subclasses to catch — one type, distinguished by code', () => {
    expect(Object.getPrototypeOf(TokenCssError)).toBe(Error)
  })
})

describe('the Main Entry contract', () => {
  it('takes a path or a URL and resolves to a result', () => {
    expectTypeOf(api.generateCss).parameter(0).toEqualTypeOf<string | URL>()
    expectTypeOf(api.generateCss).returns.toEqualTypeOf<Promise<GenerateCssResult>>()
  })

  it('accepts options, and every option is optional', () => {
    expectTypeOf<GenerateCssOptions>().toEqualTypeOf<{
      readonly outDir?: string
      readonly fileName?: string
      readonly baseDir?: string
      readonly http?: HttpOptions
    }>()
  })

  it('declares the whole network policy now, so Epic 1 never reshapes it later', () => {
    expectTypeOf<HttpOptions>().toEqualTypeOf<{
      readonly allowInsecure?: boolean
      readonly timeoutMs?: number
      readonly maxBytes?: number
      readonly maxRedirects?: number
    }>()
  })

  it('returns where it wrote and how much — never the CSS itself', () => {
    expectTypeOf<GenerateCssResult>().toEqualTypeOf<{
      readonly outputPath: string
      readonly tokenCount: number
    }>()
    expect(Object.keys(({ outputPath: '', tokenCount: 0 }) satisfies GenerateCssResult)).toEqual([
      'outputPath',
      'tokenCount',
    ])
  })

  it('documents the defaults the PRD fixes', () => {
    expect(api.DEFAULTS.outDir).toBe('assets/css')
    expect(api.DEFAULTS.fileName).toBe('tokens.css')
    expect(api.DEFAULTS.http.allowInsecure).toBe(false)
  })
})

describe('the entry point is real', () => {
  it('no longer carries an unimplemented marker, and the publish guard agrees', () => {
    let code = 0
    try {
      execFileSync(process.execPath, ['scripts/guard-unimplemented.mjs'], { stdio: 'pipe' })
    } catch (err) {
      code = (err as { status: number }).status
    }
    expect(code, 'the publish guard must pass once the pipeline is wired').toBe(0)
  })

  it('returns a promise rather than throwing synchronously', () => {
    const result = api.generateCss('does-not-exist.json')
    expect(result).toBeInstanceOf(Promise)
    return expect(result).rejects.toBeInstanceOf(TokenCssError)
  })
})
