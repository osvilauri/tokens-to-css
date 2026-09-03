/**
 * tokens-to-css — the public surface (AD-14).
 *
 * Everything a caller can reach is declared here. Nothing else in `src/` is
 * exported, and `package.json` publishes no subpaths, so internals stay free to
 * move without a major version.
 */

import { runConversion } from './pipeline.js'
import type { GenerateCssOptions, GenerateCssResult } from './options.js'

// `FailureCode` is exported once and carries both meanings: the frozen object
// of codes, and the union type of those codes.
export { FailureCode, TokenCssError } from './errors.js'
export type { SkippedToken, TokenCssErrorInit } from './errors.js'
export { DEFAULTS } from './options.js'
export type { GenerateCssOptions, GenerateCssResult, HttpOptions } from './options.js'

/**
 * Convert a design-token document into a CSS custom-properties stylesheet.
 *
 * Reads the Token Source, validates it completely, and writes the stylesheet —
 * or throws a `TokenCssError` and writes nothing at all. A failed conversion
 * writes nothing: a previous stylesheet at the target path is left untouched.
 *
 * A token whose value cannot be written as CSS does not fail the conversion
 * (FR-24). It is left out, listed in `skipped` on the result, and named in a
 * comment above `:root` in the stylesheet itself. Everything else — an
 * unreadable source, a document shaped in a way this version does not accept,
 * an alias cycle, a dangling reference, a name collision — still fails whole.
 *
 * @param source Path to a single local file, or a URL.
 * @param options Output location and network policy.
 * @returns Where the stylesheet was written, how many properties it holds, and
 * which tokens it left out.
 * @throws {TokenCssError} With a `code` naming the failure class.
 */
export function generateCss(
  source: string | URL,
  options?: GenerateCssOptions,
): Promise<GenerateCssResult> {
  return runConversion(source, options)
}
