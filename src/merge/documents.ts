/**
 * Merging several normalized documents into one (FR-27).
 *
 * This is the whole of multi-file support that is not IO. Each document has
 * already been detected and normalized on its own, so what arrives here is the
 * internal representation and the name of the source it came from — no
 * `$value`, no dialect. That is the point: merging is a question about token
 * paths, and token paths are the one thing every dialect agrees on.
 *
 * Pure, and the bottom of the merge stage (AD-1, AD-2).
 */
import { formatPath, valuesEqual, type TokenDoc, type TokenNode } from '../model/index.js'
import type { Redefinition } from '../options.js'

/** One normalized document, and the source it was read from as the caller wrote it. */
export interface MergeInput {
  readonly doc: TokenDoc
  readonly source: string
}

/** What merging produced: one document, and what took over from what. */
export interface Merged {
  readonly doc: TokenDoc
  readonly redefinitions: readonly Redefinition[]
}

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
 * **Only a value-changing redefinition is reported.** A later source that
 * repeats a token verbatim changed nothing. Without that clause, a design
 * system that lists one of its own files twice — which published resolver
 * manifests do — announces 98 redefinitions of nothing, and an announcement
 * nobody can afford to read is one nobody reads.
 *
 * @param inputs The normalized documents, in the order the caller listed them.
 */
export function mergeDocuments(inputs: readonly MergeInput[]): Merged {
  // One document is the overwhelmingly common case and must not pay for this.
  if (inputs.length === 1) return { doc: inputs[0]!.doc, redefinitions: [] }

  const positionOf = new Map<string, number>()
  const definedBy = new Map<string, string>()
  const tokens: TokenNode[] = []
  const redefinitions: Redefinition[] = []

  for (const { doc, source } of inputs) {
    for (const node of doc.tokens) {
      const key = keyOf(node.path)
      const at = positionOf.get(key)

      if (at === undefined) {
        positionOf.set(key, tokens.length)
        definedBy.set(key, source)
        tokens.push(node)
        continue
      }

      // `from` is the source that last *defined* this token, which is not always
      // the one that introduced the value: a source may restate a value it
      // agrees with. The last definition is the one somebody would go and edit,
      // so that is the one worth naming — and it is tracked whether or not the
      // restatement was announced.
      if (!valuesEqual(tokens[at]!.value, node.value)) {
        redefinitions.push({ path: formatPath(node.path), from: definedBy.get(key)!, to: source })
      }
      definedBy.set(key, source)
      tokens[at] = node
    }
  }

  return { doc: { tokens }, redefinitions }
}
