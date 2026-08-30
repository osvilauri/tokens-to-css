import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const built = existsSync(fileURLToPath(new URL('dist/', root)))

/**
 * The exports map is a promise about files on disk. Nothing else checks that
 * the promise is kept — a bundler that changes its output extension would ship
 * a package that cannot be resolved, and every unit test would still pass.
 */
describe.skipIf(!built)('build output matches the exports map', () => {
  const targets = Object.values(pkg.exports['.'] as Record<string, string>)

  it.each(targets)('%s exists after a build', (target) => {
    expect(existsSync(fileURLToPath(new URL(target, root)))).toBe(true)
  })

  it('carries the real public surface once imported', async () => {
    const mod = await import(new URL(pkg.exports['.'].default, root).href)
    expect(Object.keys(mod).sort()).toEqual([
      'DEFAULTS',
      'FailureCode',
      'TokenCssError',
      'generateCss',
    ])
    expect(typeof mod.generateCss).toBe('function')
  })
})
