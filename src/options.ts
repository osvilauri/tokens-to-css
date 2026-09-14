import type { SkippedToken } from './errors.js'

/**
 * What a caller passes in and gets back.
 *
 * These live apart from the public surface so the orchestrator can read them
 * without importing the entry point that calls it — a cycle between the two
 * would work in ESM and still be the wrong shape (AD-1).
 */

/** How a remote Token Source is fetched. Ignored when the source is a local path. */
export interface HttpOptions {
  /** Allow `http:` URLs. Off by default — only `https:` is fetched. */
  readonly allowInsecure?: boolean
  /** Total budget for the request, in milliseconds. */
  readonly timeoutMs?: number
  /** Largest response body accepted, in bytes. */
  readonly maxBytes?: number
  /** How many redirects to follow before giving up. */
  readonly maxRedirects?: number
}

/**
 * One token that more than one source defined, with different values (FR-27).
 *
 * Only value-*changing* redefinitions are reported. A later source that repeats
 * a token verbatim — or a source listed twice, which published resolver
 * manifests do — changed nothing, and reporting it would bury the redefinitions
 * that matter under the ones that do not.
 */
export interface Redefinition {
  /** Dotted path of the token, spelled as the document wrote it. */
  readonly path: string
  /** The source whose value was replaced, as the caller wrote it. */
  readonly from: string
  /** The source that won, as the caller wrote it. */
  readonly to: string
}

/** Everything a caller can adjust about a conversion. */
export interface GenerateCssOptions {
  /** Directory the stylesheet is written to. Defaults to `assets/css`. */
  readonly outDir?: string
  /** Filename inside that directory. Defaults to `tokens.css`. */
  readonly fileName?: string
  /** Base for resolving relative paths. Defaults to the current working directory. */
  readonly baseDir?: string
  /** Network policy for a URL Token Source. */
  readonly http?: HttpOptions
}

/** What a successful conversion reports back. Deliberately carries no CSS. */
export interface GenerateCssResult {
  /** Absolute path of the stylesheet that was written. */
  readonly outputPath: string
  /** How many custom properties it declares. */
  readonly tokenCount: number
  /**
   * Every Token Source that was merged, in order, as each one resolved (FR-27).
   *
   * Absolute paths and URL hrefs, like `outputPath` — the resolved form is what
   * a caller can act on. A conversion from one source returns one element, so a
   * caller never has to branch on whether a merge happened.
   */
  readonly sources: readonly string[]
  /**
   * Tokens that more than one source defined with different values (FR-27).
   *
   * Empty for a conversion from one source, and for a merge in which no source
   * took a token over from another — which, measured across seven published
   * design systems, is all of them. It exists for the case that is not in that
   * corpus and is the obvious way to get a stylesheet quietly wrong: a file
   * added to the list that shadows a token nobody meant it to shadow.
   */
  readonly redefinitions: readonly Redefinition[]
  /**
   * Tokens the document contained that the stylesheet could not (FR-24).
   *
   * Empty on a conversion that lost nothing, which is the ordinary case. A
   * caller that wants a conversion to be all-or-nothing checks this and decides
   * for itself; the library's own answer is to convert what it can and say what
   * it could not.
   */
  readonly skipped: readonly SkippedToken[]
}

/** The defaults a conversion uses when the caller says nothing. */
export const DEFAULTS = Object.freeze({
  outDir: 'assets/css',
  fileName: 'tokens.css',
  http: Object.freeze({
    allowInsecure: false,
    timeoutMs: 10_000,
    maxBytes: 10_000_000,
    maxRedirects: 3,
  }),
})
