/**
 * The resolver reading and the merge, as `merge-2026-09-12.md` specifies them —
 * projected statically, on raw JSON, because the implementation does not exist
 * yet. The library will merge on the internal representation instead; for
 * measuring which files a manifest names and whether the references land, the
 * two agree.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const read = (p) => JSON.parse(readFileSync(p, 'utf8'))

/** Every token in a document, as `{ path, node }`, in document order. */
export function tokensOf(obj, path = [], out = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out
  if ('$value' in obj || 'value' in obj) {
    out.push({ path, key: path.join('.'), node: obj })
    return out
  }
  for (const k of Object.keys(obj)) if (!k.startsWith('$')) tokensOf(obj[k], [...path, k], out)
  return out
}

/** Every `{alias.path}` a token's value mentions, at any depth. */
export function refsOf(node) {
  const found = []
  ;(function scan(v) {
    if (typeof v === 'string') for (const m of v.matchAll(/\{([^{}]+)\}/g)) found.push(m[1])
    else if (Array.isArray(v)) v.forEach(scan)
    else if (v && typeof v === 'object') Object.values(v).forEach(scan)
  })(node.$value ?? node.value)
  return found
}

/**
 * The ordered source list a manifest expands to.
 *
 * `contexts` names one context per modifier; a modifier with neither a choice
 * nor a `default` is reported in `needsContext` rather than guessed — which is
 * `CONTEXT_REQUIRED`, measured.
 */
export function expand(manifestPath, contexts = {}) {
  const m = read(manifestPath)
  const dir = dirname(manifestPath)
  const sources = []
  const chosen = {}
  const needsContext = []

  for (const entry of m.resolutionOrder ?? []) {
    const [, kind, name] = entry.$ref.split('/')
    if (kind === 'sets') {
      sources.push(...(m.sets[name].sources ?? []).map((s) => resolve(dir, s.$ref)))
      continue
    }
    const mod = m.modifiers[name]
    const ctx = contexts[name] ?? mod.default ?? null
    if (ctx === null) needsContext.push({ modifier: name, contexts: Object.keys(mod.contexts) })
    const applied = ctx ?? Object.keys(mod.contexts)[0]
    chosen[name] = applied
    sources.push(...(mod.contexts[applied] ?? []).map((s) => resolve(dir, s.$ref)))
  }

  const ordered = new Set((m.resolutionOrder ?? []).map((e) => e.$ref))
  const unusedSets = Object.keys(m.sets ?? {}).filter((s) => !ordered.has(`#/sets/${s}`))

  return { name: m.name, sources, chosen, needsContext, unusedSets }
}

/** Deep merge of raw documents, later wins, token nodes replaced whole. */
export function mergeRaw(target, src) {
  for (const [k, v] of Object.entries(src)) {
    const mergeable =
      v && typeof v === 'object' && !Array.isArray(v) && !('$value' in v) && !('value' in v) &&
      target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])
    if (mergeable) mergeRaw(target[k], v)
    else target[k] = v
  }
  return target
}
