/**
 * Name collision detection (FR-21, AD-12).
 *
 * The naming rule is deliberately lossy — everything outside `[a-z0-9]`
 * collapses — so two different token paths can arrive at the same custom
 * property. `color.brand.primary` and `color.brand-primary` both become
 * `--color-brand-primary`, and so do `cafe` and `café`.
 *
 * That is fine, as long as it is never silent. Emitting both would let the
 * second declaration quietly win and ship a theme that reports success while a
 * token has vanished — the exact failure the Reliability requirement forbids.
 *
 * This runs on the **final emitted names**, not on the paths. Comparing paths
 * would find the identical ones and miss every collision the naming rule
 * itself creates, which are the ones nobody expects.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { customPropertyName } from '../emit/name.js'
import { formatPath, type TokenDoc } from '../model/index.js'

/**
 * Checks that every token emits a distinct custom property.
 *
 * @throws {TokenCssError} `NAME_COLLISION` listing every colliding group, so
 * one run tells the developer about all of them.
 */
export function validateNoCollisions(doc: TokenDoc, source: string): void {
  const byName = new Map<string, string[]>()

  for (const node of doc.tokens) {
    const name = customPropertyName(node.path, source)
    const paths = byName.get(name)
    if (paths === undefined) byName.set(name, [formatPath(node.path)])
    else paths.push(formatPath(node.path))
  }

  const collisions = [...byName].filter(([, paths]) => paths.length > 1)
  if (collisions.length === 0) return

  const described = collisions.map(
    ([name, paths]) => `  ${name} ← ${paths.map((p) => `"${p}"`).join(', ')}`,
  )

  throw new TokenCssError(
    `${collisions.length} custom ${collisions.length === 1 ? 'property is' : 'properties are'} ` +
      `claimed by more than one token:\n${described.join('\n')}\n` +
      `Rename one of each pair — this version will not pick a winner for you.`,
    {
      code: FailureCode.NAME_COLLISION,
      source,
      tokenPaths: collisions.flatMap(([, paths]) => paths),
    },
  )
}
