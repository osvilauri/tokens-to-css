#!/usr/bin/env node
/**
 * Architecture boundary check — enforces AD-1 from the architecture spine.
 *
 * The four middle stages of the pipeline are pure functions. They may not reach
 * the filesystem or the network; only `src/source/` and `src/write/` may. The
 * orchestrator may sequence them but must not do IO itself.
 *
 * This runs as `npm run lint` and in CI. It is intentionally dependency-free.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** Directories that must stay pure, and the reason shown when they are not. */
export const RESTRICTED = [
  { path: 'src/dialects', reason: 'normalization is a pure stage (AD-1)' },
  { path: 'src/validate', reason: 'validation is a pure stage (AD-1)' },
  { path: 'src/emit', reason: 'emission is a pure stage (AD-1)' },
  { path: 'src/model', reason: 'the model imports nothing (AD-2)' },
  { path: 'src/pipeline.ts', reason: 'the orchestrator sequences stages but does no IO (AD-1)' },
]

/** Builtins the restricted set may never import, in any specifier form. */
export const FORBIDDEN_MODULES = [
  'fs', 'fs/promises',
  'net', 'dns', 'dns/promises',
  'http', 'https', 'http2', 'tls',
  'child_process', 'worker_threads',
]

const IMPORT_RE = /(?:^|\s)(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g
const FETCH_RE = /(?<![.\w])fetch\s*\(/

/** Strips the optional `node:` prefix so both spellings are caught. */
const bare = (spec) => (spec.startsWith('node:') ? spec.slice(5) : spec)

export function findViolations(source, reason) {
  const found = []
  for (const m of source.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3]
    if (spec && FORBIDDEN_MODULES.includes(bare(spec))) {
      found.push({ what: `imports "${spec}"`, reason })
    }
  }
  if (FETCH_RE.test(source)) {
    found.push({ what: 'calls fetch()', reason })
  }
  return found
}

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return // the directory does not exist yet
    throw err
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (/\.[cm]?tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) yield full
  }
}

async function filesFor(target) {
  if (target.endsWith('.ts')) {
    try {
      await readFile(target)
      return [target]
    } catch {
      return []
    }
  }
  const out = []
  for await (const f of walk(target)) out.push(f)
  return out
}

export async function check(root = process.cwd()) {
  const violations = []
  for (const { path, reason } of RESTRICTED) {
    for (const file of await filesFor(join(root, path))) {
      const source = await readFile(file, 'utf8')
      for (const v of findViolations(source, reason)) {
        violations.push({ file: relative(root, file), ...v })
      }
    }
  }
  return violations
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = await check()
  if (violations.length === 0) {
    console.log('boundaries ok — the pure stages import no filesystem or networking builtin')
    process.exit(0)
  }
  console.error('Architecture boundary violated (AD-1):\n')
  for (const v of violations) {
    console.error(`  ${v.file}\n    ${v.what} — ${v.reason}\n`)
  }
  console.error('Only src/source/ and src/write/ may touch the filesystem or the network.')
  process.exit(1)
}
