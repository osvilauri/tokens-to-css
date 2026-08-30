/**
 * The custom-property naming rule (FR-9, AD-11).
 *
 * **This is public contract.** The names produced here appear in the stylesheet
 * and in the stylesheets of everyone using it, so changing this function's
 * output is a major version — no exceptions, no options, no configurable prefix.
 *
 * The rule is deliberately lossy: anything outside `[a-z0-9]` collapses. Two
 * paths can therefore normalize to the same name, which is not this module's
 * problem to solve — the collision pass runs on the names this returns and
 * fails clearly rather than dropping a token (FR-21).
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath } from '../model/index.js'

/**
 * Normalizes one path segment.
 *
 * Unicode is normalized to NFC first, and that is not decoration. The same
 * word can arrive composed or decomposed depending on which tool wrote the
 * file — `é` as one code point, or `e` followed by a combining accent. Without
 * NFC those two produce different custom-property names from identical-looking
 * source, which would make the output depend on the editor rather than the
 * tokens.
 */
function normalizeSegment(segment: string): string {
  return segment
    .normalize('NFC')
    // Locale-independent: `toLocaleLowerCase` would turn a dotted capital I
    // into something else under a Turkish locale, making the emitted names
    // depend on the machine that ran the build.
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Builds the custom-property name for a token path.
 *
 * `['color', 'brand', 'primary']` becomes `--color-brand-primary`.
 *
 * @param path Path segments from the document root.
 * @param source The Token Source, carried only so a failure can name it.
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` when a segment has nothing left
 * after normalization. Dropping it would silently rename the token.
 */
export function customPropertyName(path: readonly string[], source: string): string {
  const segments = path.map((segment) => {
    const normalized = normalizeSegment(segment)
    if (normalized === '') {
      throw new TokenCssError(
        `token "${formatPath(path)}" has a path segment ("${segment}") with no letters or digits, ` +
          `so it cannot become part of a custom-property name`,
        { code: FailureCode.FORMAT_NOT_ALLOWED, source, tokenPaths: [formatPath(path)] },
      )
    }
    return normalized
  })

  if (segments.length === 0) {
    throw new TokenCssError(
      'a token has an empty path, so it cannot be named',
      { code: FailureCode.FORMAT_NOT_ALLOWED, source, tokenPaths: [''] },
    )
  }

  return `--${segments.join('-')}`
}
