/**
 * Merging several normalized documents into one (FR-27).
 *
 * This is the whole of multi-file support that is not IO. Each document has
 * already been detected and normalized on its own, so what arrives here is the
 * internal representation and nothing else — no `$value`, no dialect, no idea
 * which file it came from. That is the point: merging is a question about
 * token paths, and token paths are the one thing every dialect agrees on.
 *
 * Pure, and the bottom of the merge stage: it imports the model and nothing
 * else (AD-1, AD-2).
 */
import type { TokenDoc, TokenNode } from '../model/index.js'

/**
 * A path, as a map key that cannot lie.
 *
 * `['color.brand']` and `['color', 'brand']` are different tokens — JSON lets a
 * single key contain a dot — and both render as `color.brand`. Keying on the
 * dotted form would merge two tokens that were never the same one, so the key
 * is the encoded array.
 */
const keyOf = (path: readonly string[]): string => JSON.stringify(path)

/**
 * Merges documents in order, where a later document wins.
 *
 * **First appearance decides position; a redefinition updates the value in
 * place.** Emission order is document order (AD-10), and a redefinition is not
 * a new token — it is the same token with a later value. Appending it would
 * move a custom property to the bottom of the stylesheet whenever a theme layer
 * touched it, and the diff of a generated file is a thing this product protects.
 *
 * @param docs The normalized documents, in the order the caller listed their
 * sources.
 * @returns One document, in merged order.
 */
export function mergeDocuments(docs: readonly TokenDoc[]): TokenDoc {
  // One document is the overwhelmingly common case and must not pay for this.
  if (docs.length === 1) return docs[0]!

  const positionOf = new Map<string, number>()
  const tokens: TokenNode[] = []

  for (const doc of docs) {
    for (const node of doc.tokens) {
      const key = keyOf(node.path)
      const at = positionOf.get(key)
      if (at === undefined) {
        positionOf.set(key, tokens.length)
        tokens.push(node)
      } else {
        tokens[at] = node
      }
    }
  }

  return { tokens }
}
