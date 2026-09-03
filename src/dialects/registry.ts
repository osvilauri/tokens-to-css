/**
 * The Format Allowlist, as a closed ordered registry (AD-3).
 *
 * Every accepted shape is one entry. Detection walks the list in a fixed order
 * and the first match wins, so a document that could be read two ways is always
 * read the same way. Adding a shape means adding an entry and its fixtures —
 * there is nowhere else to change, which is what keeps the allowlist a decision
 * rather than an accumulation.
 */
import { FailureCode, TokenCssError, type SkippedToken } from '../errors.js'
import type { TokenDoc } from '../model/index.js'
import { findMultiFileConstruct, looksLikeDtcg, normalizeDtcg } from './dtcg.js'
import { findMixedDialectNode, looksLikeSdLegacy, normalizeSdLegacy } from './sd-legacy.js'
import { looksLikeTokensStudio, normalizeTokensStudio } from './tokens-studio.js'
import { isPlainObject, type JsonObject } from './walk.js'

/**
 * What reading a document produced.
 *
 * The skips travel beside the document rather than inside it: `TokenDoc` is
 * what the stylesheet will contain, and a token that will not be in the
 * stylesheet is not part of it (AD-2). It is a fact about the *reading*, which
 * is what this type is.
 */
export interface Normalized {
  readonly doc: TokenDoc
  readonly skipped: readonly SkippedToken[]
}

/** One allowlisted shape. */
export interface Dialect {
  /** Stable identifier, used in fixture paths and failure messages. */
  readonly id: string
  /** Human-readable description, shown when a document matches nothing. */
  readonly describedAs: string
  /** Whether this document is this shape. */
  readonly matches: (root: JsonObject) => boolean
  /** Reads it into the internal representation. */
  readonly normalize: (root: JsonObject, source: string) => Normalized
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
    id: 'tokens-studio',
    describedAs: 'Tokens Studio exports, one token set per file',
    matches: looksLikeTokensStudio,
    normalize: normalizeTokensStudio,
  },
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
export function normalizeDocument(root: unknown, source: string): Normalized {
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
      const read = dialect.normalize(root, source)
      if (read.doc.tokens.length === 0) {
        // Nothing to emit — but *why* matters. A document whose tokens were all
        // skipped was recognized and read; saying "no tokens were recognized"
        // would throw that away and send the developer looking at the wrong
        // thing. Writing `:root {}` instead is not an option either: an empty
        // stylesheet is a no-op wearing the costume of a success (FR-24).
        if (read.skipped.length > 0) {
          throw new TokenCssError(
            `every token in this document was skipped, so the stylesheet would declare nothing:\n` +
              read.skipped.map((skip) => `  ${skip.reason}`).join('\n'),
            {
              code: FailureCode.NOTHING_EMITTED,
              source,
              tokenPaths: read.skipped.map((skip) => skip.path),
            },
          )
        }
        break
      }
      return read
    }
  }

  throw new TokenCssError(
    `no tokens were recognized in this document. This version reads: ` +
      `${DIALECTS.map((d) => d.describedAs).join('; ')}`,
    { code: FailureCode.FORMAT_NOT_ALLOWED, source },
  )
}
