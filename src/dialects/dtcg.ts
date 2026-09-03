/**
 * DTCG single-file documents — shape A1 of the Format Allowlist.
 *
 * The v1 subset: `$value`, `$type`, `$description`, group nesting, and
 * `{path.to.token}` aliases. `$type` and `$description` are read and dropped —
 * `$description` because comments are not emitted in this version, and `$type`
 * because nothing downstream may infer from it (AD-2, AD-19).
 */
import type { Normalized } from './registry.js'
import { isPlainObject, walkTokenTree, type JsonObject, type TokenReader } from './walk.js'

/** Keys DTCG reserves. Inside a token node they are metadata; at group level, document metadata. */
const isDollarKey = (key: string): boolean => key.startsWith('$')

const reader: TokenReader = {
  read: (node) => ('$value' in node ? { found: true, raw: node['$value'] } : { found: false, raw: undefined }),
  isMetadataKey: isDollarKey,
}

/**
 * Finds a multi-file construct, wherever it sits.
 *
 * This runs before dialect detection, and it has to. A resolver document
 * carries no `$value` anywhere, so no dialect claims it and the tree walk that
 * holds the specific message never runs — the developer would be told "no
 * tokens were recognized", which is true and useless when the real answer is
 * "this file points at other files, and this version reads one".
 *
 * @returns The path where the construct was found, or `null`.
 */
export function findMultiFileConstruct(root: JsonObject): string[] | null {
  const seen = new Set<unknown>()
  const scan = (node: JsonObject, path: string[]): string[] | null => {
    if (seen.has(node)) return null
    seen.add(node)
    for (const key of Object.keys(node)) {
      if (key === '$ref') return [...path, key]
      const child = node[key]
      if (isPlainObject(child)) {
        const found = scan(child, [...path, key])
        if (found) return found
      }
    }
    return null
  }
  return scan(root, [])
}

/** True when any node in the document carries a `$value`. */
export function looksLikeDtcg(root: JsonObject): boolean {
  const seen = new Set<unknown>()
  const scan = (node: JsonObject): boolean => {
    if (seen.has(node)) return false
    seen.add(node)
    if ('$value' in node) return true
    return Object.keys(node).some((key) => {
      const child = node[key]
      return isPlainObject(child) && scan(child)
    })
  }
  return scan(root)
}

/** Normalizes a DTCG document into the internal representation. */
export function normalizeDtcg(root: JsonObject, source: string): Normalized {
  const { tokens, skipped } = walkTokenTree(root, source, reader)
  return { doc: { tokens }, skipped }
}
