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
export type {
  GenerateCssOptions,
  GenerateCssResult,
  HttpOptions,
  Redefinition,
} from './options.js'

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
 * **Several sources merge into one stylesheet** (FR-27). Pass a list and each
 * document is read on its own — so one system may mix dialects — and then
 * merged in list order, where a later source wins. A reference from one
 * document to a token defined in another is an ordinary reference: the alias
 * graph is validated once, over the merged document. Where two sources define
 * the same token differently the later one wins, and that is reported — in
 * `redefinitions` and in the comment above `:root`, which is where somebody
 * reading the next pull request will see it. Two sources that agree, or one
 * source listed twice, change nothing and are reported as nothing. A conversion
 * from a single source is byte-identical to what it has always produced.
 *
 * @param source Path to a local file, a URL, or a list of either. A list is
 * merged in the order it is written; an empty list is refused.
 * @param options Output location and network policy.
 * @returns Where the stylesheet was written, how many properties it holds,
 * which sources it merged, and which tokens it left out.
 * @throws {TokenCssError} With a `code` naming the failure class.
 */
export function generateCss(
  source: string | URL | readonly (string | URL)[],
  options?: GenerateCssOptions,
): Promise<GenerateCssResult> {
  return runConversion(source, options)
}
