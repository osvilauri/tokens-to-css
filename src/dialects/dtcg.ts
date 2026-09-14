/**
 * DTCG single-file documents — shape A1 of the Format Allowlist.
 *
 * The v1 subset: `$value`, `$type`, `$description`, group nesting, `$root`
 * (the reserved name for a group's own token, §6.2) and `{path.to.token}`
 * aliases. `$type` and `$description` are read and dropped —
 * `$description` because comments are not emitted in this version, and `$type`
 * because nothing downstream may infer from it (AD-2, AD-19).
 */
import type { Normalized } from './registry.js'
import {
  CHILD_KEY,
  METADATA_KEY,
  isPlainObject,
  walkTokenTree,
  type JsonObject,
  type KeyClass,
  type TokenReader,
} from './walk.js'

/**
 * The reserved name a group uses for its own token (DTCG 2025.10 §6.2).
 *
 * `$root` is the one `$`-prefixed key that names a *token* rather than a
 * property, so it is the one the walk descends into. §6.7.2 keeps the segment
 * in the token path — `color.accent.$root`, never `color.accent`, which the
 * spec declares invalid for token resolution — so aliases written against it
 * resolve. The segment is dropped later, when the path becomes a
 * custom-property name (`emit/name.ts`); paths and names are different
 * namespaces and only the name has to read like CSS.
 */
const ROOT_TOKEN_KEY = '$root'

/**
 * The `$`-prefixed names the spec defines as properties.
 *
 * Listed rather than inferred, because the fallback for an *unlisted* `$` key
 * carrying a `$value` is a refusal — and `$extensions` above all must never
 * reach it. Vendors put arbitrary JSON there, which the spec says tools "MUST
 * preserve", and that payload may legitimately contain a nested `$value` that
 * is not a token.
 */
const METADATA_KEYS = new Set(['$type', '$description', '$extensions', '$deprecated', '$extends', '$ref'])

/** True for a node the dialect would read as a token. */
const carriesValue = (child: unknown): boolean => isPlainObject(child) && '$value' in child

/**
 * Decides what one key inside a group is.
 *
 * Every `$`-prefixed key used to be metadata, which meant a token written as
 * `$root` was dropped before anything could notice it existed — not emitted,
 * not counted, not reported as skipped. That is the silent drop FR-20 and FR-24
 * forbid, and it cost 56 real tokens across the Figma SDS theme files.
 */
const classifyKey = (key: string, child: unknown): KeyClass => {
  if (!key.startsWith('$')) return CHILD_KEY

  if (key === ROOT_TOKEN_KEY) {
    if (carriesValue(child)) return CHILD_KEY
    return {
      kind: 'refused',
      reason: `uses "${ROOT_TOKEN_KEY}", the reserved name for a group's own token, on something that has no "$value"`,
    }
  }

  if (METADATA_KEYS.has(key)) return METADATA_KEY

  // An unknown `$` key holding a value directly. The spec reserves the whole
  // `$` namespace for itself, so this is not a token this version can name —
  // and refusing it by name is the one thing that must not become a quiet skip.
  if (carriesValue(child)) {
    return {
      kind: 'refused',
      reason:
        `uses "${key}" as a token name, but DTCG reserves "$"-prefixed names for the format itself ` +
        `and this version reads only "${ROOT_TOKEN_KEY}" as one`,
    }
  }

  return METADATA_KEY
}

const reader: TokenReader = {
  read: (node) => ('$value' in node ? { found: true, raw: node['$value'] } : { found: false, raw: undefined }),
  classifyKey,
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
