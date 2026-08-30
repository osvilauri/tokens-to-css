/**
 * Builds a token document of a given size, shaped like a real one.
 *
 * Not stored in the repository: ten thousand tokens of JSON is a large file to
 * carry around and review, and it is fully determined by this function anyway.
 * Deterministic, so two runs measure the same work.
 *
 * The shape matters as much as the count. A flat document of ten thousand
 * literals would measure the emitter and nothing else; what should be measured
 * is the alias graph, which is the only part with any real structure. So the
 * document is three-tier: primitives hold values, semantics point at
 * primitives, components point at semantics — chains three deep, the way a
 * design system actually looks.
 */

/** @param {number} total How many tokens the document should hold. */
export function generateTokenDocument(total) {
  const primitives = Math.floor(total * 0.4)
  const semantics = Math.floor(total * 0.4)
  const components = total - primitives - semantics

  /** @type {Record<string, unknown>} */
  const document = { primitive: {}, semantic: {}, component: {} }

  for (let i = 0; i < primitives; i++) {
    const value =
      i % 3 === 0
        ? `#${(i * 2654435761 % 0xffffff).toString(16).padStart(6, '0')}`
        : i % 3 === 1
          ? `${(i % 64) + 1}px`
          : (i % 20) / 10 + 1
    document.primitive[`p${i}`] = { $value: value, $type: i % 3 === 0 ? 'color' : 'dimension' }
  }

  for (let i = 0; i < semantics; i++) {
    document.semantic[`s${i}`] = { $value: `{primitive.p${i % primitives}}` }
  }

  for (let i = 0; i < components; i++) {
    document.component[`c${i}`] = { $value: `{semantic.s${i % semantics}}` }
  }

  return document
}
