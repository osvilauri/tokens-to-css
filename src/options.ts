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
