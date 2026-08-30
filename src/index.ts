/**
 * tokens-to-css — the public surface (AD-14).
 *
 * Everything a caller can reach is declared here. Nothing else in `src/` is
 * exported, and `package.json` publishes no subpaths, so internals stay free to
 * move without a major version.
 */

import { TokenCssError } from './errors.js'

// `FailureCode` is exported once and carries both meanings: the frozen object
// of codes, and the union type of those codes.
export { FailureCode, TokenCssError } from './errors.js'
export type { TokenCssErrorInit } from './errors.js'

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

/**
 * Convert a design-token document into a CSS custom-properties stylesheet.
 *
 * Reads the Token Source, validates it completely, and writes the stylesheet —
 * or throws a {@link TokenCssError} and writes nothing at all. There is no
 * partial success: a previous stylesheet at the target path is left untouched
 * whenever the conversion fails.
 *
 * @param source Path to a single local file, or a URL.
 * @param options Output location and network policy.
 * @returns Where the stylesheet was written, and how many properties it holds.
 * @throws {TokenCssError} With a `code` naming the failure class.
 */
export function generateCss(
  source: string | URL,
  options?: GenerateCssOptions,
): Promise<GenerateCssResult> {
  // NOT_IMPLEMENTED_STORY_1_10 — the contract above is settled; the pipeline
  // behind it is wired in Story 1.10. `npm run guard:unimplemented` fails while
  // this marker is present, and `prepublishOnly` runs it, so this placeholder
  // cannot reach the registry. This bare Error is the one deliberate exception
  // to "only TokenCssError in src/": a missing implementation is a build-state
  // problem, not a failure class of the product, and it must not consume a code.
  void source
  void options
  throw new Error(
    'generateCss is not implemented yet — the public contract landed in Story 1.2, the conversion lands in Story 1.10.',
  )
}
