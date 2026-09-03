/**
 * The shared tree walk every dialect uses (AD-2, AD-9, AD-20).
 *
 * Dialects differ in one thing: which key marks a node as a token, and how to
 * read its value out. Everything else — recursion, prototype safety, reference
 * syntax, refusing to drop things silently — is identical, and lives here so
 * three dialects cannot disagree about it.
 */
import { FailureCode, TokenCssError, type SkippedToken } from '../errors.js'
import { formatPath, literal, ref, token, type TokenNode, type TokenValue } from '../model/index.js'
import { assertScalar } from '../emit/literal.js'
import { scalarToCss } from './values.js'

/** A JSON object, as it comes out of `JSON.parse`. */
export type JsonObject = Record<string, unknown>

/**
 * Keys that must never be walked into or copied.
 *
 * `JSON.parse` puts `__proto__` on the object as an ordinary own property
 * rather than invoking the setter, so it arrives here intact — which is exactly
 * why it has to be refused explicitly rather than assumed impossible.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** A whole-string reference, and nothing else: `{color.brand.primary}`. */
const WHOLE_REFERENCE = /^\{([^{}]+)\}$/

/** Any brace at all, used to catch references embedded in a larger string. */
const ANY_BRACE = /[{}]/

/** How a dialect recognizes and reads one token node. */
export interface TokenReader {
  /** Returns the raw value when this object is a token node in this dialect. */
  readonly read: (node: JsonObject) => { readonly found: boolean; readonly raw: unknown }
  /** Keys inside a token node that carry metadata and are read then ignored. */
  readonly isMetadataKey: (key: string) => boolean
}

const fail = (message: string, source: string, path: readonly string[]): never => {
  throw new TokenCssError(message, {
    code: FailureCode.FORMAT_NOT_ALLOWED,
    source,
    tokenPaths: [formatPath(path)],
  })
}

/** True for a plain object — not null, not an array. */
export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Turns a raw token value into a reference or a literal.
 *
 * A value is a reference only when the entire string is one. A string that
 * merely contains `{…}` — `1px solid {color.border}` — is refused: emitting it
 * verbatim would produce syntactically valid CSS that silently does nothing,
 * which is the failure mode this library exists to prevent.
 */
export function toTokenValue(raw: unknown, path: readonly string[], source: string): TokenValue {
  if (typeof raw === 'string') {
    const whole = WHOLE_REFERENCE.exec(raw.trim())
    if (whole) {
      const target = whole[1]!.split('.')
      if (target.some((segment) => segment.trim() === '')) {
        fail(`token "${formatPath(path)}" references "${raw.trim()}", which is not a token path`, source, path)
      }
      return ref(target)
    }
    if (ANY_BRACE.test(raw)) {
      fail(
        `token "${formatPath(path)}" has a reference inside a larger value ("${raw}"). ` +
          `This version emits a reference only when the whole value is one`,
        source,
        path,
      )
    }
  }
  // The current DTCG spec writes colours and dimensions as objects, and font
  // families and easing curves as arrays. Each is still one CSS value, so it
  // becomes a string here and nothing further down ever learns it arrived any
  // other way (FR-23, FR-26).
  const asScalar = scalarToCss(raw, path, source)
  if (asScalar !== null) return literal(asScalar)

  return literal(assertScalar(raw, path, source))
}

/** What a walk produced: the tokens it could read, and the ones it could not (FR-24). */
export interface WalkResult {
  readonly tokens: TokenNode[]
  readonly skipped: SkippedToken[]
}

/**
 * Walks a token document into a flat, ordered list of tokens.
 *
 * Nothing is dropped quietly, but not everything is fatal any more (FR-24).
 * One code is skippable and the rest are not:
 *
 * **`COMPOSITE_VALUE`** — the value is an object, an array, a boolean or null,
 * so there is no CSS to write for it. That is scoped to one token and says
 * nothing about the document around it, so the token is left out and recorded
 * while the rest converts.
 *
 * **Everything else stays fatal**, including the token-scoped ones: a non-CSS
 * unit, a reference buried in a larger string, Tokens Studio arithmetic. Each
 * of those has its own message explaining the specific thing that is wrong, and
 * folding them into a generic skip would replace an explanation with a shrug —
 * arithmetic would be reported as an embedded reference, which is true and
 * useless. A document whose shape this version does not accept is refused by
 * name, the way it always has been.
 *
 * The line is drawn on the code rather than on where the failure was raised.
 * Raising position is an implementation detail that moves; the code is public
 * surface that cannot.
 *
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` for unsafe keys, stray scalars,
 * malformed references and values this version does not accept. Multi-file
 * constructs are caught earlier, by the registry, because they can appear in a
 * document no dialect claims.
 */
export function walkTokenTree(root: JsonObject, source: string, reader: TokenReader): WalkResult {
  const tokens: TokenNode[] = []
  const skipped: SkippedToken[] = []

  const visit = (node: JsonObject, path: readonly string[]): void => {
    const value = reader.read(node)
    if (value.found) {
      try {
        tokens.push(token(path, toTokenValue(value.raw, path, source)))
      } catch (err) {
        if (!(err instanceof TokenCssError) || err.code !== FailureCode.COMPOSITE_VALUE) throw err
        // Collected, not rethrown: the walk continues so one pass reports every
        // unwritable token rather than the first (AD-5).
        skipped.push({ path: formatPath(path), code: err.code, reason: err.message })
      }
      return
    }

    for (const key of Object.keys(node)) {
      const childPath = [...path, key]

      if (UNSAFE_KEYS.has(key)) {
        fail(
          `token document contains the key "${key}" at "${formatPath(childPath)}", which is refused`,
          source,
          childPath,
        )
      }
      if (reader.isMetadataKey(key)) continue

      const child = node[key]
      if (isPlainObject(child)) {
        visit(child, childPath)
      } else {
        fail(
          `"${formatPath(childPath)}" is a ${Array.isArray(child) ? 'list' : typeof child}, but a ` +
            `group or a token was expected here`,
          source,
          childPath,
        )
      }
    }
  }

  visit(root, [])
  return { tokens, skipped }
}
