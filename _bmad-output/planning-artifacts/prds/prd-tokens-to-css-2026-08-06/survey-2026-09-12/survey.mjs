/**
 * What the seven manifests name, and what happens when their sources are merged
 * and handed to the published library.
 *
 *   node survey.mjs [path to a dtcg-examples clone]
 */
import { readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
// The built library. Point TOKENS_TO_CSS_DIST at a different build to compare.
const { generateCss, TokenCssError } = await import(
  process.env.TOKENS_TO_CSS_DIST ?? new URL('../../../../../dist/index.js', import.meta.url).href,
)
import { expand, mergeRaw, read, refsOf, tokensOf } from './resolve.mjs'

const ROOT = process.argv[2] ?? 'dtcg-examples'
const manifests = readdirSync(ROOT).filter((f) => f.endsWith('.resolver.json')).sort()

const allFiles = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    if (['.git', 'node_modules', '.vscode', 'scripts'].includes(e)) continue
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.tokens.json')) allFiles.push(p)
  }
})(ROOT)

const rows = []
for (const f of manifests) {
  const system = f.replace('.resolver.json', '')
  const { sources, chosen, needsContext, unusedSets } = expand(join(ROOT, f))

  // merge, tracking what a redefinition would report
  const defined = new Map()
  let identical = 0
  const changing = []
  for (const p of sources) {
    for (const t of tokensOf(read(p))) {
      const value = JSON.stringify(t.node.$value ?? t.node.value)
      const prev = defined.get(t.key)
      if (prev !== undefined) {
        if (prev.value === value) identical++
        else changing.push({ path: t.key, from: relative(ROOT, prev.file), to: relative(ROOT, p) })
      }
      defined.set(t.key, { value, file: p })
    }
  }

  // do the references land once merged?
  const dangling = []
  for (const p of sources) {
    for (const t of tokensOf(read(p))) {
      for (const r of refsOf(t.node)) if (!defined.has(r)) dangling.push(`${t.key} -> ${r}`)
    }
  }

  // and what does the library make of the merged document?
  const dir = mkdtempSync(join(tmpdir(), 'merge-survey-'))
  const merged = sources.reduce((acc, p) => mergeRaw(acc, read(p)), {})
  const file = join(dir, 'merged.tokens.json')
  writeFileSync(file, JSON.stringify(merged))
  let status = 'ok', code = '', message = '', props = 0, skipped = 0
  try {
    const result = await generateCss(file, { outDir: dir })
    props = result.tokenCount
    skipped = result.skipped.length
  } catch (err) {
    status = 'FAIL'
    code = err instanceof TokenCssError ? err.code : err.constructor.name
    message = String(err.message).split('\n')[0].slice(0, 120)
  }

  const inDirectory = allFiles.filter((p) => p.startsWith(join(ROOT, system) + '/')).length
  rows.push({ system, inDirectory, sources: sources.length, duplicates: sources.length - new Set(sources).size,
    chosen, needsContext, unusedSets, tokens: defined.size, identical, changing, dangling,
    status, code, message, props, skipped })
}

const pad = (s, n) => String(s).padEnd(n)
const num = (s, n) => String(s).padStart(n)
console.log(`${pad('system', 18)} ${num('dir', 4)} ${num('used', 5)} ${num('dup', 4)} ${num('tokens', 7)} ${num('id-redef', 9)} ${num('redef', 6)} ${num('dangling', 9)}  result`)
for (const r of rows) {
  console.log(`${pad(r.system, 18)} ${num(r.inDirectory, 4)} ${num(r.sources, 5)} ${num(r.duplicates, 4)} ${num(r.tokens, 7)} ${num(r.identical, 9)} ${num(r.changing.length, 6)} ${num(r.dangling.length, 9)}  ` +
    (r.status === 'ok' ? `OK ${r.props} props, ${r.skipped} skipped` : `FAIL ${r.code}`))
}
console.log(`\n${rows.filter((r) => r.status === 'ok').length}/${rows.length} systems convert whole after merge`)

console.log('\n--- contexts ---')
for (const r of rows) {
  const picked = Object.entries(r.chosen).map(([m, c]) => `${m}=${c}`).join(' ') || '(no modifiers)'
  const needs = r.needsContext.map((n) => `${n.modifier} [${n.contexts.join('|')}]`).join(', ')
  console.log(`${pad(r.system, 18)} ${picked}${needs ? `   CONTEXT_REQUIRED: ${needs}` : ''}`)
  if (r.unusedSets.length) console.log(`${' '.repeat(19)}declared, never ordered: ${r.unusedSets.join(', ')}`)
}

console.log('\n--- failures ---')
for (const r of rows.filter((x) => x.status !== 'ok')) console.log(`${r.system}\n    ${r.code}: ${r.message}`)
