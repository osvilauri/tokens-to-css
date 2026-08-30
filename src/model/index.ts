/**
 * The internal representation (AD-2).
 *
 * Every stage after normalization sees only this. Normalizers are the one place
 * that knows what `$value` or `value` means; validation, naming and emission
 * work from the shape below and cannot tell which dialect produced it.
 *
 * This module imports nothing — not another module in `src/`, not a builtin. It
 * is the bottom of the dependency graph, which is what lets every stage above
 * it be tested with a document built by hand.
 */

/** A token whose value points at another token. */
export interface TokenRef {
  readonly kind: 'ref'
  /** Path segments of the target, from the document root. */
  readonly path: readonly string[]
}

/**
 * A token whose value is written out as-is.
 *
 * Only strings and numbers reach here. Anything else — an object, an array, a
 * boolean, null — is rejected upstream as a composite (FR-20), because there is
 * no honest way to write it into a stylesheet.
 */
export interface TokenLiteral {
  readonly kind: 'literal'
  readonly value: string | number
}

/** A token's value: either a reference to another token, or a literal. */
export type TokenValue = TokenRef | TokenLiteral

/** One token, identified by its path from the document root. */
export interface TokenNode {
  /** Path segments from the document root, e.g. `['color', 'brand', 'primary']`. */
  readonly path: readonly string[]
  readonly value: TokenValue
}

/**
 * A normalized token document.
 *
 * Tokens are an ordered array, never a keyed object or a `Map`. Document order
 * is the emission order (AD-10), and an array is the only structure that
 * carries it without depending on how a runtime iterates keys.
 */
export interface TokenDoc {
  readonly tokens: readonly TokenNode[]
}

/** Builds a literal value. */
export function literal(value: string | number): TokenLiteral {
  return { kind: 'literal', value }
}

/** Builds a reference to another token. */
export function ref(path: readonly string[]): TokenRef {
  return { kind: 'ref', path }
}

/** Builds a token node. */
export function token(path: readonly string[], value: TokenValue): TokenNode {
  return { path, value }
}

/** Narrows a value to a reference. */
export function isRef(value: TokenValue): value is TokenRef {
  return value.kind === 'ref'
}

/** Narrows a value to a literal. */
export function isLiteral(value: TokenValue): value is TokenLiteral {
  return value.kind === 'literal'
}

/**
 * Renders a path the way the token document wrote it, for humans.
 *
 * This is how a token is named in an error message — it is *not* the custom
 * property name, which follows the naming rule and lives in the emitter.
 */
export function formatPath(path: readonly string[]): string {
  return path.join('.')
}
