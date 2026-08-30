import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/**
 * The manifest carries architecture decisions that are easy to undo by accident:
 * zero runtime dependencies (AD-13) and a single public entry point (AD-14).
 */
describe('package manifest', () => {
  it('has no runtime dependencies', () => {
    // npm strips an empty `dependencies` object on install, so absent is the
    // canonical form of "none". Both spellings must satisfy AD-13.
    expect(pkg.dependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies ?? {}).toEqual({})
    expect(pkg.optionalDependencies ?? {}).toEqual({})
  })

  it('is ESM only', () => {
    expect(pkg.type).toBe('module')
  })

  it('requires a Node version that is still supported', () => {
    expect(pkg.engines.node).toBe('>=22.12')
  })

  it('exposes the package root and nothing else', () => {
    expect(Object.keys(pkg.exports)).toEqual(['.'])
    expect(JSON.stringify(pkg.exports)).not.toContain('*')
  })

  it('ships types alongside the entry point', () => {
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts')
  })

  it('publishes the build output only', () => {
    expect(pkg.files).toEqual(['dist'])
  })

  it('is MIT licensed', () => {
    expect(pkg.license).toBe('MIT')
  })
})
