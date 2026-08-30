/**
 * The Format Allowlist, as a closed ordered registry (AD-3).
 *
 * Every accepted shape is one entry. Detection walks the list in a fixed order
 * and the first match wins, so a document that could be read two ways is always
 * read the same way. Adding a shape means adding an entry and its fixtures —
 * there is nowhere else to change, which is what keeps the allowlist a decision
 * rather than an accumulation.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import type { TokenDoc } from '../model/index.js'
import { findMultiFileConstruct, looksLikeDtcg, normalizeDtcg } from './dtcg.js'
import { findMixedDialectNode, looksLikeSdLegacy, normalizeSdLegacy } from './sd-legacy.js'
import { isPlainObject, type JsonObject } from './walk.js'

/** One allowlisted shape. */
export interface Dialect {
  /** Stable identifier, used in fixture paths and failure messages. */
  readonly id: string
  /** Human-readable description, shown when a document matches nothing. */
  readonly describedAs: string
  /** Whether this document is this shape. */
  readonly matches: (root: JsonObject) => boolean
  /** Reads it into the internal representation. */
  readonly normalize: (root: JsonObject, source: string) => TokenDoc
}

/**
 * Detection order: Tokens Studio, then DTCG, then Style Dictionary legacy.
 *
 * Tokens Studio comes first because its documents *contain* DTCG or legacy
 * nodes — checking it later would match the inner shape and lose the wrappers.
 * The Epic 2 dialects slot in around this entry without reordering it.
 */
export const DIALECTS: readonly Dialect[] = [
  {
    id: 'dtcg',
    describedAs: 'DTCG single-file documents using $value',
    matches: looksLikeDtcg,
    normalize: normalizeDtcg,
  },
  {
    id: 'sd-legacy',
    describedAs: 'Style Dictionary legacy documents using value/type without the dollar',
    matches: looksLikeSdLegacy,
    normalize: normalizeSdLegacy,
  },
]

/**
 * Reads a parsed JSON document into the internal representation.
 *
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` when the root is not an object,
 * or when no allowlisted shape matches. The message lists what is accepted, so
 * a developer can act on it without reading this source.
 */
export function normalizeDocument(root: unknown, source: string): TokenDoc {
  if (!isPlainObject(root)) {
    throw new TokenCssError(
      `the token source is ${Array.isArray(root) ? 'a list' : `a ${root === null ? 'null' : typeof root}`}, ` +
        `but a token document must be a JSON object`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source },
    )
  }

  // Checked before detection: a resolver document carries no token marker, so
  // no dialect would claim it and the specific message would never be reached.
  const multiFile = findMultiFileConstruct(root)
  if (multiFile) {
    throw new TokenCssError(
      `token document uses "$ref" at "${multiFile.join('.')}". Multi-file documents and resolver ` +
        `manifests are not supported — pass a single self-contained file`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source, tokenPaths: [multiFile.join('.')] },
    )
  }

  // Tokens Studio exports wrap their tokens in a set, and the wrapper does not
  // belong in the emitted name. Until that shape is read properly, such a
  // document would be picked up as Style Dictionary legacy and converted with
  // the set name folded into every custom property — a silently wrong
  // stylesheet, which is worse than a refusal. Replaced by real support in the
  // Tokens Studio story.
  if ('$themes' in root || '$metadata' in root) {
    throw new TokenCssError(
      `this looks like a Tokens Studio export. That shape is not read yet — reading it as a ` +
        `plain document would fold the token set name into every custom property`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source },
    )
  }

  // Also checked before detection, and for the same reason: first-match-wins
  // would read a node carrying both markers as DTCG and drop its `value`.
  const mixed = findMixedDialectNode(root)
  if (mixed) {
    const where = mixed.length === 0 ? 'the document root' : `"${mixed.join('.')}"`
    throw new TokenCssError(
      `${where} carries both "$value" and "value". A token speaks one dialect or the other — ` +
        `remove whichever one is not meant to be there`,
      { code: FailureCode.FORMAT_NOT_ALLOWED, source, tokenPaths: [mixed.join('.')] },
    )
  }

  for (const dialect of DIALECTS) {
    if (dialect.matches(root)) {
      const doc = dialect.normalize(root, source)
      if (doc.tokens.length === 0) break
      return doc
    }
  }

  throw new TokenCssError(
    `no tokens were recognized in this document. This version reads: ` +
      `${DIALECTS.map((d) => d.describedAs).join('; ')}`,
    { code: FailureCode.FORMAT_NOT_ALLOWED, source },
  )
}
