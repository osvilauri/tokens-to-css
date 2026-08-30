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
import { isRef, type TokenDoc } from '../model/index.js'
import { stringifyLiteral } from './literal.js'
import { customPropertyName } from './name.js'

/** Two spaces. Fixed: a configurable indent would make goldens negotiable. */
const INDENT = '  '

/**
 * Renders a normalized document as a stylesheet.
 *
 * A token whose value points at another token is written as `var(--target)`,
 * never as the target's value. That is the whole point of the product: the
 * relationship the token file expressed survives into the CSS, so changing a
 * primitive still moves everything that referred to it.
 *
 * @param doc The normalized document, in document order.
 * @param source The Token Source, carried only so a naming failure can name it.
 * @returns The complete stylesheet text, ending in exactly one newline.
 */
export function emitStylesheet(doc: TokenDoc, source: string): string {
  const declarations = doc.tokens.map((node) => {
    const property = customPropertyName(node.path, source)
    const value = isRef(node.value)
      ? `var(${customPropertyName(node.value.path, source)})`
      : stringifyLiteral(node.value.value)
    return `${INDENT}${property}: ${value};`
  })

  return [':root {', ...declarations, '}', ''].join('\n')
}
