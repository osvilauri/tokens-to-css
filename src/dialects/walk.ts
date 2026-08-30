/**
 * The shared tree walk every dialect uses (AD-2, AD-9, AD-20).
 *
 * Dialects differ in one thing: which key marks a node as a token, and how to
 * read its value out. Everything else — recursion, prototype safety, reference
 * syntax, refusing to drop things silently — is identical, and lives here so
 * three dialects cannot disagree about it.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath, literal, ref, token, type TokenNode, type TokenValue } from '../model/index.js'
import { assertScalar } from '../emit/literal.js'
import { objectValueToCss } from './values.js'

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
  // The current DTCG spec writes colours and dimensions as objects. They are
  // still one CSS value each, so they become a string here and nothing further
  // down ever learns they arrived as objects (FR-23).
  const asObjectScalar = objectValueToCss(raw, path, source)
  if (asObjectScalar !== null) return literal(asObjectScalar)

  return literal(assertScalar(raw, path, source))
}

/**
 * Walks a token document into a flat, ordered list of tokens.
 *
 * Nothing is dropped quietly. A scalar sitting where a group should be is a
 * failure, not a skipped entry, because a token that vanishes between the file
 * and the stylesheet is the silent breakage the Reliability requirement forbids.
 *
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` for unsafe keys, stray scalars,
 * and malformed references. Multi-file constructs are caught earlier, by the
 * registry, because they can appear in a document no dialect claims.
 */
export function walkTokenTree(root: JsonObject, source: string, reader: TokenReader): TokenNode[] {
  const tokens: TokenNode[] = []

  const visit = (node: JsonObject, path: readonly string[]): void => {
    const value = reader.read(node)
    if (value.found) {
      tokens.push(token(path, toTokenValue(value.raw, path, source)))
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
  return tokens
}
