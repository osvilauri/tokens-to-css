/**
 * The failure contract — public surface, frozen by semver (AD-4).
 *
 * Every failure in this library is a `TokenCssError` carrying one of the codes
 * below. Callers branch on `code`; they never match on message text, so message
 * wording stays free to improve. Renaming or merging a code is a major version.
 */

/**
 * The complete set of ways a conversion can fail.
 *
 * One code per failure class in the PRD. Adding a code is a minor version;
 * renaming, merging, or removing one is a major version.
 */
export const FailureCode = Object.freeze({
  /** The path or URL could not be read: missing, denied, unreachable, timed out, oversized, or refused by network policy. */
  SOURCE_UNREADABLE: 'SOURCE_UNREADABLE',
  /** The source was read but its content is not valid JSON. */
  SOURCE_INVALID_JSON: 'SOURCE_INVALID_JSON',
  /** The document is not a shape this version accepts. */
  FORMAT_NOT_ALLOWED: 'FORMAT_NOT_ALLOWED',
  /** Aliases reference each other in a loop. */
  ALIAS_CYCLE: 'ALIAS_CYCLE',
  /** An alias points at a token that does not exist. */
  ALIAS_DANGLING: 'ALIAS_DANGLING',
  // Since FR-24 this is a skip reason rather than a thrown failure: the token is
  // left out and reported, and the rest of the document converts. It stays in
  // this enum — removing a code is a major version — and is what a
  // `SkippedToken` carries. The one-line doc comment below is what the
  // generated failure reference reads; keep it one line.
  /** A value is an object, array, boolean, or null rather than a scalar — reported as a skipped token, not a failure. */
  COMPOSITE_VALUE: 'COMPOSITE_VALUE',
  /** Two or more tokens would emit the same custom-property name. */
  NAME_COLLISION: 'NAME_COLLISION',
  /** The stylesheet could not be written. */
  OUTPUT_WRITE_FAILED: 'OUTPUT_WRITE_FAILED',
  /** Every token was skipped, so the stylesheet would declare nothing (FR-24). */
  NOTHING_EMITTED: 'NOTHING_EMITTED',
} as const)

/** One of the nine failure codes. */
export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode]

/**
 * One token that was left out of the stylesheet (FR-24).
 *
 * A skip is not a failure: the conversion succeeded and the document is
 * otherwise intact. It is reported here for callers, and in a comment block
 * above `:root` for the humans who will read the generated file — which is the
 * copy that shows up in a pull request when a token stops being emitted.
 */
export interface SkippedToken {
  /** Dotted path of the token, spelled as the document wrote it. */
  readonly path: string
  /** Why, in the same vocabulary a failure would have used. */
  readonly code: FailureCode
  /** The sentence a caller would have seen had this been fatal. Wording is not contract. */
  readonly reason: string
}

/** What a `TokenCssError` is constructed from. */
export interface TokenCssErrorInit {
  /** The failure class. */
  readonly code: FailureCode
  /** The Token Source the conversion was working on, as the caller supplied it. */
  readonly source: string
  /** Dotted paths of the offending tokens, for token-scoped failures. */
  readonly tokenPaths?: readonly string[]
  /** The underlying error, when this one wraps something lower-level. */
  readonly cause?: unknown
}

/**
 * The only error this library throws.
 *
 * There are no subclasses: the `code` is what callers branch on, and one type
 * means a caller never has to ask which error shape it caught.
 */
export class TokenCssError extends Error {
  override readonly name = 'TokenCssError'

  /** The failure class. Stable across minor versions. */
  readonly code: FailureCode

  /** The Token Source being converted when this failed. */
  readonly source: string

  /** Offending token paths — empty for failures that are not token-scoped. */
  readonly tokenPaths: readonly string[]

  constructor(message: string, init: TokenCssErrorInit) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause })
    this.code = init.code
    this.source = init.source
    this.tokenPaths = init.tokenPaths ?? []
  }
}
