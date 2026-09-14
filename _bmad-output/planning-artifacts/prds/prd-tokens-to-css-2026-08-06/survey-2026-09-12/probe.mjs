/**
 * The three systems that do not convert after the merge, and what each one
 * would take. Projections: the transforms below stand in for capabilities that
 * do not exist, so what they prove is the size of the prize, not the design.
 *
 *   node probe.mjs [path to a dtcg-examples clone]
 */
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
// The built library. Point TOKENS_TO_CSS_DIST at a different build to compare.
const { generateCss, TokenCssError } = await import(
  process.env.TOKENS_TO_CSS_DIST ?? new URL('../../../../../dist/index.js', import.meta.url).href,
)
import { expand, mergeRaw, read } from './resolve.mjs'

const ROOT = process.argv[2] ?? 'dtcg-examples'
const merged = (manifest, opts) => expand(join(ROOT, manifest), opts.contexts ?? {})

const mapTokens = (obj, fn) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  if ('$value' in obj || 'value' in obj) return fn(obj)
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[k] = k.startsWith('$') ? v : mapTokens(v, fn)
  return out
}
const prune = (o) => {
  for (const [k, v] of Object.entries(o)) {
    if (v === null) delete o[k]
    else if (v && typeof v === 'object' && !Array.isArray(v) && !('$value' in v) && !('value' in v)) {
      prune(v)
      if (Object.keys(v).length === 0) delete o[k]
    }
  }
  return o
}
async function convert(label, doc) {
  const dir = mkdtempSync(join(tmpdir(), 'probe-'))
  const file = join(dir, 'merged.tokens.json')
  writeFileSync(file, JSON.stringify(doc))
  try {
    const r = await generateCss(file, { outDir: dir })
    console.log(`OK   ${label} — ${r.tokenCount} props, ${r.skipped.length} skipped`)
  } catch (err) {
    const code = err instanceof TokenCssError ? err.code : err.constructor.name
    console.log(`FAIL ${label} — ${code}: ${String(err.message).split('\n')[0].slice(0, 120)}`)
  }
}
const load = (manifest, includeUnusedSets = false) => {
  const { sources, unusedSets } = merged(manifest, {})
  const list = [...sources]
  if (includeUnusedSets && unusedSets.length) {
    const m = read(join(ROOT, manifest))
    const dir = join(ROOT, manifest, '..')
    for (const s of unusedSets) list.unshift(...(m.sets[s].sources ?? []).map((x) => join(dir, x.$ref)))
  }
  return list.reduce((acc, p) => mergeRaw(acc, read(p)), {})
}

// 1. apple-hig — its manifest declares a set its resolutionOrder never applies
await convert('apple-hig, as the manifest orders it', load('apple-hig.resolver.json'))
await convert('apple-hig, with the declared-but-unordered set', load('apple-hig.resolver.json', true))

// 2. adobe-spectrum — one token in a non-CSS unit, today fatal
let dropped = 0
const spectrum = mapTokens(load('adobe-spectrum.resolver.json'), (t) => {
  const v = t.$value ?? t.value
  const nonCss = (typeof v === 'string' && /\d(dp|sp|pt)\b/.test(v)) ||
    (v && typeof v === 'object' && !Array.isArray(v) && ['dp', 'sp', 'pt'].includes(v.unit))
  if (nonCss) { dropped++; return null }
  return t
})
await convert(`adobe-spectrum, with ${dropped} non-CSS-unit token skipped instead of fatal`, prune(spectrum))

// 3. github-primer — references embedded in a larger value, today fatal
let embedded = 0
const primer = mapTokens(load('github-primer.resolver.json'), (t) => {
  const key = '$value' in t ? '$value' : 'value'
  const inline = (v) => {
    if (typeof v === 'string' && /\{[^}]+\}/.test(v) && !/^\{[^{}]+\}$/.test(v.trim())) {
      embedded++
      return v.replace(/\{([^}]+)\}/g, (_, p) => `var(--${p.replace(/\./g, '-')})`)
    }
    if (Array.isArray(v)) return v.map(inline)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inline(x)]))
    return v
  }
  return { ...t, [key]: inline(t[key]) }
})
await convert(`github-primer, with ${embedded} embedded references emitted`, primer)
