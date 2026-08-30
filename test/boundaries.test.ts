import { describe, expect, it } from 'vitest'
// @ts-expect-error — the checker is plain ESM JavaScript, deliberately dependency-free.
import { findViolations, FORBIDDEN_MODULES, RESTRICTED } from '../scripts/check-boundaries.mjs'

/**
 * The boundary checker is proved against synthetic sources rather than against
 * the real tree, which is nearly empty at this point in the epic. A checker
 * that silently finds nothing would pass on an empty tree and keep passing
 * once the tree is full.
 */
describe('architecture boundary checker', () => {
  it('flags a filesystem import', () => {
    const found = findViolations(`import { readFile } from 'node:fs/promises'`, 'because')
    expect(found).toHaveLength(1)
    expect(found[0].what).toContain('node:fs/promises')
  })

  it('flags the bare specifier as well as the node: prefixed one', () => {
    expect(findViolations(`import fs from 'fs'`, 'r')).toHaveLength(1)
    expect(findViolations(`import fs from 'node:fs'`, 'r')).toHaveLength(1)
  })

  it('flags every networking builtin', () => {
    for (const mod of ['net', 'dns', 'http', 'https', 'http2', 'tls']) {
      expect(findViolations(`import x from 'node:${mod}'`, 'r'), mod).toHaveLength(1)
    }
  })

  it('flags a dynamic import and a require', () => {
    expect(findViolations(`await import('node:net')`, 'r')).toHaveLength(1)
    expect(findViolations(`const fs = require('fs')`, 'r')).toHaveLength(1)
  })

  it('flags a call to global fetch', () => {
    const found = findViolations(`const r = await fetch(url)`, 'r')
    expect(found).toHaveLength(1)
    expect(found[0].what).toBe('calls fetch()')
  })

  it('does not flag a property named fetch', () => {
    expect(findViolations(`client.fetch(url)`, 'r')).toHaveLength(0)
  })

  it('allows imports that are not filesystem or network', () => {
    const source = `import { join } from 'node:path'\nimport type { TokenDoc } from '../model/index.js'`
    expect(findViolations(source, 'r')).toHaveLength(0)
  })

  it('carries the reason into every violation, so the message names the rule', () => {
    const found = findViolations(`import fs from 'node:fs'`, 'emission is a pure stage (AD-1)')
    expect(found[0].reason).toBe('emission is a pure stage (AD-1)')
  })

  it('restricts exactly the directories the spine names', () => {
    expect(RESTRICTED.map((r: { path: string }) => r.path)).toEqual([
      'src/dialects',
      'src/validate',
      'src/emit',
      'src/model',
      'src/pipeline.ts',
    ])
  })

  it('does not restrict the shell directories', () => {
    const paths = RESTRICTED.map((r: { path: string }) => r.path)
    expect(paths).not.toContain('src/source')
    expect(paths).not.toContain('src/write')
    expect(FORBIDDEN_MODULES).toContain('fs')
  })
})
