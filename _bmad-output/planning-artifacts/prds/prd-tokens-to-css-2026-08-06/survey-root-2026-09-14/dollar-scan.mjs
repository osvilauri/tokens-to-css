/**
 * Counts nodes carrying `$value` that hang off a `$`-prefixed key.
 * These are tokens the DTCG reader drops silently (isMetadataKey → continue).
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.argv[2]
const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === '.git' || e === 'node_modules' || e === '.vscode') continue
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.json')) files.push(p)
  }
})(ROOT)

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

// Every node with $value anywhere under this subtree.
const countValues = (node) => {
  if (!isObj(node)) return 0
  if ('$value' in node) return 1
  let n = 0
  for (const k of Object.keys(node)) n += countValues(node[k])
  return n
}

const hits = []       // { file, path, key, direct, buried }
const byKey = new Map()
const byFile = new Map()

for (const f of files.sort()) {
  let doc
  try { doc = JSON.parse(readFileSync(f, 'utf8')) } catch { continue }
  if (!isObj(doc)) continue

  const visit = (node, path) => {
    if (!isObj(node)) return
    if ('$value' in node) return          // token node: its $-keys are metadata
    for (const k of Object.keys(node)) {
      const child = node[k]
      if (k.startsWith('$')) {
        const n = countValues(child)
        if (n > 0) {
          const rec = {
            file: relative(ROOT, f),
            path: [...path, k].join('.'),
            key: k,
            direct: isObj(child) && '$value' in child,
            total: n,
          }
          hits.push(rec)
          byKey.set(k, (byKey.get(k) ?? 0) + n)
          byFile.set(rec.file, (byFile.get(rec.file) ?? 0) + n)
        }
        continue                           // mirrors the reader: never descend
      }
      if (isObj(child)) visit(child, [...path, k])
    }
  }
  visit(doc, [])
}

console.log(`scanned ${files.length} .json files under ${ROOT}`)
console.log(`\n=== $-prefixed keys carrying $value, by key ===`)
for (const [k, n] of [...byKey].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)} ${String(n).padStart(5)} tokens`)
console.log(`\n=== by file ===`)
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(50)} ${String(n).padStart(5)}`)
console.log(`\ntotal hidden tokens: ${hits.reduce((a, h) => a + h.total, 0)} at ${hits.length} sites`)
console.log(`all direct (child itself carries $value)? ${hits.every(h => h.direct)}`)
console.log(`\n=== first 40 sites ===`)
for (const h of hits.slice(0, 40)) console.log(`  ${h.file} :: ${h.path}${h.total > 1 ? ` (${h.total})` : ''}`)
