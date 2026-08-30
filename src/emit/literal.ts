/**
 * Turning a token value into stylesheet text (AD-19).
 *
 * One rule, no options: write what the token said. A string goes out verbatim,
 * a number goes out as its plain decimal form. Nothing is inferred from a
 * `$type`, which is why the internal model does not carry one — the moment this
 * function could see that a token is a "dimension", someone would reasonably
 * append `px`, and two implementations would disagree about what `16` means.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath } from '../model/index.js'

/** What a token value may be once it reaches the stylesheet. */
export type Scalar = string | number

/** Whether a raw JSON value can be written into a stylesheet at all. */
export function isScalar(value: unknown): value is Scalar {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

/** How a rejected value is described in the failure message. */
function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') return 'an object'
  return `a ${typeof value}`
}

/**
 * Accepts a raw value only if it is a scalar (FR-20).
 *
 * @throws {TokenCssError} `COMPOSITE_VALUE` for objects, arrays, booleans and
 * null. A composite has no single stylesheet value, and stringifying one
 * produces `[object Object]` under a successful-looking run.
 */
export function assertScalar(value: unknown, path: readonly string[], source: string): Scalar {
  if (isScalar(value)) return value
  throw new TokenCssError(
    `token "${formatPath(path)}" has ${describe(value)} as its value, but this version writes ` +
      `one custom property per scalar token`,
    { code: FailureCode.COMPOSITE_VALUE, source, tokenPaths: [formatPath(path)] },
  )
}

/**
 * Renders a scalar as stylesheet text.
 *
 * Verbatim for strings — no quoting, no trimming, no escaping: a token that
 * says `1px solid red` means exactly that, and a token with a trailing space
 * keeps it, because the golden files are byte-exact and silently tidying the
 * input would make the output depend on this function's taste.
 */
export function stringifyLiteral(value: Scalar): string {
  return typeof value === 'string' ? value : String(value)
}
