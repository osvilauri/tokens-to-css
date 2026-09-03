/**
 * Tokens Studio exports — shape A3 of the Format Allowlist.
 *
 * What arrives from Tokens Studio is a DTCG or legacy tree wrapped in a token
 * set, alongside the plugin's own bookkeeping. The bookkeeping is read and
 * dropped; the wrapper is dropped from the emitted names.
 *
 * That last part is the whole reason this needs its own entry rather than
 * falling through to another dialect. Left in place, the set name folds into
 * every custom property — `global.color.brand` becoming `--global-color-brand`
 * instead of `--color-brand` — which converts perfectly happily and is wrong
 * everywhere at once.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath, type TokenDoc, type TokenNode } from '../model/index.js'
import type { Normalized } from './registry.js'
import { isPlainObject, walkTokenTree, type JsonObject, type TokenReader } from './walk.js'

/** The plugin's own keys, read and ignored. */
const BOOKKEEPING = new Set(['$themes', '$metadata'])

/** A token node in either dialect the wrapper may contain. */
const reader: TokenReader = {
  read: (node) => {
    if ('$value' in node) return { found: true, raw: node['$value'] }
    if ('value' in node) return { found: true, raw: node['value'] }
    return { found: false, raw: undefined }
  },
  isMetadataKey: (key) => key.startsWith('$'),
}

/** True when the document carries the plugin's bookkeeping. */
export function looksLikeTokensStudio(root: JsonObject): boolean {
  return [...BOOKKEEPING].some((key) => key in root)
}

/** Arithmetic written as a string: `2 * 4`, `16 / 2`, `(8 + 8)`. */
const ARITHMETIC = /^\(?\s*-?\d+(\.\d+)?\s*([+\-*/]\s*\(?\s*-?\d+(\.\d+)?\s*\)?\s*)+$/

/** A helper Tokens Studio provides and this version does not evaluate. */
const STUDIO_FUNCTION = /^\s*roundTo\s*\(/

/**
 * Refuses a value that is an expression rather than a value.
 *
 * No expression is evaluated here or anywhere else — there is no evaluator in
 * this package, deliberately. Tokens Studio can resolve its own math on export;
 * a converter that quietly implemented a second, slightly different arithmetic
 * would produce numbers nobody could account for.
 *
 * Deliberately narrow. `calc(100% - 16px)` and `clamp(1rem, 2vw, 3rem)` are
 * valid CSS and pass through untouched; only arithmetic that CSS would not
 * accept, and the plugin's own helpers, are refused.
 */
function refuseExpressions(node: TokenNode, source: string): void {
  if (node.value.kind !== 'literal' || typeof node.value.value !== 'string') return
  const text = node.value.value
  if (!ARITHMETIC.test(text) && !STUDIO_FUNCTION.test(text)) return

  throw new TokenCssError(
    `token "${formatPath(node.path)}" is an expression ("${text}"). This version writes token ` +
      `values as they are and evaluates nothing — resolve it in Tokens Studio before exporting`,
    { code: FailureCode.FORMAT_NOT_ALLOWED, source, tokenPaths: [formatPath(node.path)] },
  )
}

/**
 * Normalizes a Tokens Studio export.
 *
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` when the export holds more than
 * one token set, or when a value is an expression.
 */
export function normalizeTokensStudio(root: JsonObject, source: string): Normalized {
  const setNames = Object.keys(root).filter((key) => !BOOKKEEPING.has(key))

  if (setNames.length === 0) {
    throw new TokenCssError(
      `this Tokens Studio export contains no token set — only the plugin's own metadata`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source },
    )
  }

  if (setNames.length > 1) {
    throw new TokenCssError(
      `this Tokens Studio export contains ${setNames.length} token sets (${setNames.join(', ')}). ` +
        `This version converts one set at a time — merging sets would need to decide which one ` +
        `wins, and that is a choice the export does not record`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source },
    )
  }

  const set = root[setNames[0]!]
  if (!isPlainObject(set)) {
    throw new TokenCssError(
      `the token set "${setNames[0]}" is not a group of tokens`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source },
    )
  }

  // Walked from inside the set, so the wrapper never becomes a path segment.
  // Everything below the top level is an ordinary group (AD-22).
  const { tokens, skipped } = walkTokenTree(set, source, reader)
  // FR-17 is a rejection, not a skip: an expression is a shape this version
  // refuses to read at all, and reading half of one is worse than reading none.
  for (const node of tokens) refuseExpressions(node, source)
  return { doc: { tokens }, skipped }
}
