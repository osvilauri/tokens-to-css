/**
 * Writing the stylesheet (FR-9, FR-10, AD-10).
 *
 * The whole document becomes one string before anything reaches disk (AD-6), so
 * a failure late in emission cannot leave half a stylesheet behind.
 *
 * The exact bytes produced here are the contract the golden files hold. Two
 * runs over the same document must produce identical text, which is why nothing
 * in this module reads the clock, the filesystem, the environment, or the
 * order a runtime happens to iterate keys — declaration order is the order of
 * the array it was handed, and that is document order.
 */
import type { SkippedToken } from '../errors.js'
import { isRef, type TokenDoc } from '../model/index.js'
import { stringifyLiteral } from './literal.js'
import { customPropertyName } from './name.js'

/** Two spaces. Fixed: a configurable indent would make goldens negotiable. */
const INDENT = '  '

/**
 * The block that announces skipped tokens (FR-24).
 *
 * This is the half of the skip report that reaches people rather than callers.
 * A generated stylesheet lives in a repository, so a token that stopped being
 * emitted shows up here in the next diff — where somebody is already looking —
 * instead of only in a return value most callers never read.
 *
 * Nothing is emitted when nothing was skipped. That is not a nicety: it is what
 * keeps every document that converted before this existed byte-identical.
 */
function skipComment(skipped: readonly SkippedToken[]): readonly string[] {
  if (skipped.length === 0) return []
  const heading = skipped.length === 1 ? '1 token was skipped:' : `${skipped.length} tokens were skipped:`
  return [`/* ${heading}`, ...skipped.map((s) => ` *   ${s.reason}`), ' */']
}

/**
 * Renders a normalized document as a stylesheet.
 *
 * A token whose value points at another token is written as `var(--target)`,
 * never as the target's value. That is the whole point of the product: the
 * relationship the token file expressed survives into the CSS, so changing a
 * primitive still moves everything that referred to it.
 *
 * A document carrying skipped tokens is preceded by a comment naming them, so
 * the stylesheet says what it is missing rather than quietly being short.
 *
 * @param doc The normalized document, in document order.
 * @param skipped Tokens the document held that the stylesheet cannot, announced
 * in a comment above the rule. Empty for a document that lost nothing, and then
 * no comment is written at all.
 * @param source The Token Source, carried only so a naming failure can name it.
 * @returns The complete stylesheet text, ending in exactly one newline.
 */
export function emitStylesheet(
  doc: TokenDoc,
  skipped: readonly SkippedToken[],
  source: string,
): string {
  const declarations = doc.tokens.map((node) => {
    const property = customPropertyName(node.path, source)
    const value = isRef(node.value)
      ? `var(${customPropertyName(node.value.path, source)})`
      : stringifyLiteral(node.value.value)
    return `${INDENT}${property}: ${value};`
  })

  return [...skipComment(skipped), ':root {', ...declarations, '}', ''].join('\n')
}
