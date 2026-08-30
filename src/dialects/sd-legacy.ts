/**
 * Style Dictionary legacy documents — shape A2 of the Format Allowlist.
 *
 * The same tree as DTCG with the dollars taken off: `value` and `type` instead
 * of `$value` and `$type`. Plenty of catalogues were written this way years ago
 * and still work, and asking someone to rewrite a file that already works
 * before they can convert it is exactly the busywork this library exists to
 * remove.
 *
 * Once normalized it is indistinguishable from DTCG — same internal
 * representation, same validation, same stylesheet, byte for byte. The dialect
 * is an input shape, never a mode.
 */
import type { TokenDoc } from '../model/index.js'
import { isPlainObject, walkTokenTree, type JsonObject, type TokenReader } from './walk.js'

/**
 * A node holding `value` is a token.
 *
 * There is a trade-off buried here. A group literally named `value` would be
 * misread as a token — but a composite `value` (a shadow, a typography block)
 * is far more common than a group by that name, and it must reach the composite
 * check rather than be walked into as a group. The pathological case fails
 * clearly, naming the token, rather than converting into something wrong.
 */
const reader: TokenReader = {
  read: (node) => ('value' in node ? { found: true, raw: node['value'] } : { found: false, raw: undefined }),
  // No `$` convention here, so group-level keys are groups. `$schema` and
  // friends still appear in hybrid files, so they stay ignorable.
  isMetadataKey: (key) => key.startsWith('$'),
}

/** True when any node in the document carries a `value`. */
export function looksLikeSdLegacy(root: JsonObject): boolean {
  const seen = new Set<unknown>()
  const scan = (node: JsonObject): boolean => {
    if (seen.has(node)) return false
    seen.add(node)
    if ('value' in node) return true
    return Object.keys(node).some((key) => {
      const child = node[key]
      return isPlainObject(child) && scan(child)
    })
  }
  return scan(root)
}

/** Normalizes a Style Dictionary legacy document into the internal representation. */
export function normalizeSdLegacy(root: JsonObject, source: string): TokenDoc {
  return { tokens: walkTokenTree(root, source, reader) }
}

/**
 * Finds a token node that speaks both dialects at once.
 *
 * Detection is first-match-wins, so a node carrying `$value` and `value`
 * together would be read as DTCG and its `value` quietly ignored. A key that
 * disappears between the file and the stylesheet is the silent breakage this
 * library refuses to produce, so the ambiguity is refused instead of resolved.
 *
 * @returns The path of the offending node, or `null`.
 */
export function findMixedDialectNode(root: JsonObject): string[] | null {
  const seen = new Set<unknown>()
  const scan = (node: JsonObject, path: string[]): string[] | null => {
    if (seen.has(node)) return null
    seen.add(node)
    if ('$value' in node && 'value' in node) return path
    for (const key of Object.keys(node)) {
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
