/**
 * Composite tokens that fit one CSS value (FR-25).
 *
 * Four DTCG types describe several sub-values that CSS writes as a single
 * property: shadow, border, transition and gradient. Each becomes one custom
 * property here. The types that describe *several* CSS properties — typography,
 * and the object form of strokeStyle — cannot, and are not this module's
 * business.
 *
 * Two rules run through everything below.
 *
 * **Component order is public contract.** Once a shadow ships as
 * `offsetX offsetY blur spread color`, every stylesheet in the world holds that
 * order, and changing it is a major version. It is CSS's order, not ours, which
 * is the only defensible way to pick one.
 *
 * **Nothing absent is invented.** Every sub-property the spec marks `MUST` has
 * to be there or the token is skipped: a `spread` assumed to be `0` would be
 * this product's first inference, and there is no principled second place to
 * stop. Where the token genuinely does not say something — the axis of a
 * gradient, the property a transition animates — the emitted value is the part
 * it did say, and the consumer supplies the rest.
 */
import { formatPath, ref, type TokenRef } from '../model/index.js'
import { scalarToCss } from './values.js'

/** A piece of a composite value: literal text, or a reference to another token. */
export type Part = string | TokenRef

/** A whole-string reference, matching the one the walk uses. */
const WHOLE_REFERENCE = /^\{([^{}]+)\}$/

/** Raised inside this module and caught at its edge; never escapes. */
class Unwritable extends Error {}

const unwritable = (why: string): never => {
  throw new Unwritable(why)
}

/**
 * Renders one sub-value: a reference stays a reference, anything else becomes
 * the CSS text for it.
 *
 * This is where "an aliased sub-value stays an alias" is implemented — the one
 * thing that keeps expansion from duplicating the primitives it was built from.
 */
function sub(raw: unknown, what: string): Part {
  if (typeof raw === 'string') {
    const whole = WHOLE_REFERENCE.exec(raw.trim())
    if (whole) return ref(whole[1]!.split('.'))
    if (/[{}]/.test(raw)) unwritable(`its ${what} has a reference inside a larger value`)
    return raw
  }
  if (typeof raw === 'number') return String(raw)

  const scalar = scalarToCss(raw, [], '')
  if (scalar === null) unwritable(`its ${what} is not a value CSS can hold`)
  return scalar!
}

/** Appends one part, merging it into the previous one when both are text. */
function push(out: Part[], part: Part): void {
  const last = out.at(-1)
  if (typeof part === 'string' && typeof last === 'string') {
    out[out.length - 1] = last + part
  } else {
    out.push(part)
  }
}

/**
 * Joins groups of parts with a separator **between the groups**.
 *
 * A group is one sub-value, and it may already be several parts — a shadow's
 * colour is one group whether it is a literal or a reference. Flattening before
 * separating would put the separator between the pieces of a sub-value instead
 * of between sub-values, which is how a shadow list first came out as
 * `0, 1px, 2px, 0, #000`.
 */
function join(groups: readonly (Part | readonly Part[])[], separator: string): Part[] {
  const out: Part[] = []
  groups.forEach((group, index) => {
    if (index > 0 && separator !== '') push(out, separator)
    for (const part of Array.isArray(group) ? group : [group as Part]) push(out, part)
  })
  return out
}

/** Requires every sub-property the spec marks MUST. */
function require_(value: Record<string, unknown>, keys: readonly string[], kind: string): void {
  const missing = keys.filter((k) => !(k in value))
  if (missing.length > 0) {
    unwritable(`its ${kind} is missing ${missing.map((m) => `"${m}"`).join(', ')}`)
  }
}

/** `offsetX offsetY blur spread color`, with `inset` in front when true. */
function shadowToParts(raw: Record<string, unknown>): Part[] {
  require_(raw, ['color', 'offsetX', 'offsetY', 'blur', 'spread'], 'shadow')
  const lengths = (['offsetX', 'offsetY', 'blur', 'spread'] as const).map((k) => sub(raw[k], k))
  const parts = join([...lengths, sub(raw['color'], 'color')], ' ')
  return raw['inset'] === true ? join(['inset', ...parts], ' ') : parts
}

/** `width style color`. */
function borderToParts(raw: Record<string, unknown>): Part[] {
  require_(raw, ['color', 'width', 'style'], 'border')
  const style = raw['style']
  if (style !== null && typeof style === 'object') {
    // The spec's own `focusring` example uses this, and CSS has no answer for
    // it: `dashArray` is SVG geometry a border cannot carry. The spec lets a
    // tool fall back to "the closest approximation"; approximating in silence
    // is the one thing this product does not do.
    unwritable('its style is written as an object, which a CSS border cannot express')
  }
  return join([sub(raw['width'], 'width'), sub(style, 'style'), sub(raw['color'], 'color')], ' ')
}

/**
 * `duration timingFunction delay` — the tail of the `transition` shorthand.
 *
 * The token never says *which* property is animated, so what is emitted is
 * everything else, used as `transition: opacity var(--…)`. In that shorthand
 * the first time is the duration and the second is the delay, which is why the
 * order is not the one the object is written in.
 */
function transitionToParts(raw: Record<string, unknown>): Part[] {
  require_(raw, ['duration', 'delay', 'timingFunction'], 'transition')
  return join(
    [
      sub(raw['duration'], 'duration'),
      sub(raw['timingFunction'], 'timing function'),
      sub(raw['delay'], 'delay'),
    ],
    ' ',
  )
}

/**
 * The stop list of a gradient, without an axis.
 *
 * A DTCG gradient is stops and nothing else — no direction, no angle. Emitting
 * `linear-gradient(…)` would mean inventing an axis the token never stated, so
 * the value is the stops, used as `background: linear-gradient(to right, var(--…))`.
 *
 * `position` is 0–1 in the token and a percentage in CSS, and the spec says an
 * out-of-range number is clamped rather than refused.
 */
function gradientToParts(raw: readonly unknown[]): Part[] {
  if (raw.length === 0) unwritable('it is an empty gradient')
  const stops = raw.map((stop) => {
    if (typeof stop === 'string') {
      const whole = WHOLE_REFERENCE.exec(stop.trim())
      if (whole) return [ref(whole[1]!.split('.'))] as Part[]
      return unwritable('one of its stops is neither a stop nor a reference')
    }
    if (stop === null || typeof stop !== 'object' || Array.isArray(stop)) {
      return unwritable('one of its stops is not a gradient stop')
    }
    const record = stop as Record<string, unknown>
    require_(record, ['color', 'position'], 'gradient stop')
    const position = record['position']
    if (typeof position !== 'number' || !Number.isFinite(position)) {
      return unwritable('one of its stop positions is not a number')
    }
    const clamped = Math.min(1, Math.max(0, position))
    return join([sub(record['color'], 'colour'), `${clamped * 100}%`], ' ')
  })
  return join(stops, ', ')
}

/** True for `[{...}, ...]` — a list of shadows rather than one. */
const isObjectList = (raw: readonly unknown[]): boolean =>
  raw.length > 0 && raw.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e))

/**
 * What reading a composite produced.
 *
 * Three outcomes, and the middle one is why this is not just `Part[] | null`: a
 * shadow missing its `spread` is a different thing from a typography block, and
 * telling the developer which sub-property is absent is the difference between
 * a message they can act on and one they cannot.
 */
export type CompositeResult =
  /** Converted. */
  | { readonly kind: 'parts'; readonly parts: readonly Part[] }
  /** Recognized, but this version cannot write it, and here is why. */
  | { readonly kind: 'unwritable'; readonly reason: string }
  /** Not one of these composites at all. */
  | { readonly kind: 'unrecognized' }

/** Dispatches on shape. Throws {@link Unwritable} for a recognized-but-broken value. */
function build(raw: unknown): readonly Part[] | null {
  if (Array.isArray(raw)) {
    if (!isObjectList(raw)) return null
    const first = raw[0] as Record<string, unknown>
    if ('position' in first) return gradientToParts(raw)
    if ('offsetX' in first || 'offsetY' in first) {
      return join(raw.map((s) => shadowToParts(s as Record<string, unknown>)), ', ')
    }
    return null
  }

  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>

  if ('offsetX' in record || 'offsetY' in record || 'blur' in record) return shadowToParts(record)
  if ('width' in record && 'style' in record) return borderToParts(record)
  if ('duration' in record || 'timingFunction' in record) return transitionToParts(record)
  return null
}

/**
 * Converts a composite that fits one CSS value.
 *
 * Recognition is by shape, never by `$type` — the same rule the object and
 * array scalars follow. A shadow has offsets and a blur; a border has a width
 * and a style; a transition has a duration and a timing function; a gradient is
 * a list of stops. Nothing else is any of those.
 */
export function compositeToParts(raw: unknown): CompositeResult {
  try {
    const parts = build(raw)
    return parts === null ? { kind: 'unrecognized' } : { kind: 'parts', parts }
  } catch (err) {
    if (err instanceof Unwritable) return { kind: 'unwritable', reason: err.message }
    throw err
  }
}

/**
 * Sub-property to name suffix — public contract, seven entries.
 *
 * The 2026-09-02 design claimed the suffix would fall out of the existing
 * naming rule for free. It does not: that rule lowercases and splits on
 * non-alphanumerics, so `fontSize` becomes `fontsize`, and teaching it to split
 * camelCase would rename every token already emitted — a major version.
 *
 * So there is a table, and each entry is the **CSS property the sub-value
 * feeds**, which is the one mapping that is not arbitrary: the token is spelled
 * the way the declaration that uses it is spelled.
 *
 *   font-size: var(--type-body-font-size);
 *
 * Adding an entry later is additive. Changing one is a major version.
 */
const CSS_PROPERTY: Readonly<Record<string, string>> = Object.freeze({
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  letterSpacing: 'letter-spacing',
  lineHeight: 'line-height',
  dashArray: 'dash-array',
  lineCap: 'line-cap',
})

/**
 * The spec's closed alias table for font weights.
 *
 * A word outside it skips the token. Passing it through would emit
 * `font-weight: regular`, which is invalid CSS a browser ignores in silence —
 * and inventing a number for an unknown word would be worse.
 */
const FONT_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  thin: 100, hairline: 100,
  'extra-light': 200, 'ultra-light': 200,
  light: 300,
  normal: 400, regular: 400, book: 400,
  medium: 500,
  'semi-bold': 600, 'demi-bold': 600,
  bold: 700,
  'extra-bold': 800, 'ultra-bold': 800,
  black: 900, heavy: 900,
  'extra-black': 950, 'ultra-black': 950,
})

/** One custom property an expanded composite produces. */
export interface Expanded {
  /** Appended to the token's path, so the name follows the ordinary rule. */
  readonly suffix: string
  readonly parts: readonly Part[]
}

/** A font weight: a number, a reference, or one of the spec's words. */
function fontWeight(raw: unknown): Part[] {
  if (typeof raw === 'string' && !WHOLE_REFERENCE.test(raw.trim())) {
    const mapped = FONT_WEIGHTS[raw.toLowerCase()]
    if (mapped === undefined) {
      unwritable(`its font weight is "${raw}", which is not a weight the spec defines`)
    }
    return [String(mapped)]
  }
  return [sub(raw, 'font weight')]
}

/**
 * Typography: five CSS properties, so five custom properties.
 *
 * The `font` shorthand is not emitted, not even as an extra convenience
 * property. Used alone it drops `letter-spacing` in silence, which is the exact
 * failure this product exists to prevent.
 */
function typographyToExpansion(raw: Record<string, unknown>): Expanded[] {
  require_(raw, ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'], 'typography')
  return [
    { suffix: CSS_PROPERTY['fontFamily']!, parts: [sub(raw['fontFamily'], 'font family')] },
    { suffix: CSS_PROPERTY['fontSize']!, parts: [sub(raw['fontSize'], 'font size')] },
    { suffix: CSS_PROPERTY['fontWeight']!, parts: fontWeight(raw['fontWeight']) },
    { suffix: CSS_PROPERTY['letterSpacing']!, parts: [sub(raw['letterSpacing'], 'letter spacing')] },
    { suffix: CSS_PROPERTY['lineHeight']!, parts: [sub(raw['lineHeight'], 'line height')] },
  ]
}

/** Stroke style in object form: two SVG properties, so two custom properties. */
function strokeStyleToExpansion(raw: Record<string, unknown>): Expanded[] {
  require_(raw, ['dashArray', 'lineCap'], 'stroke style')
  const dashes = raw['dashArray']
  if (!Array.isArray(dashes) || dashes.length === 0) {
    unwritable('its dash array is not a list of lengths')
  }
  return [
    {
      suffix: CSS_PROPERTY['dashArray']!,
      parts: join((dashes as unknown[]).map((d) => [sub(d, 'dash length')]), ' '),
    },
    { suffix: CSS_PROPERTY['lineCap']!, parts: [sub(raw['lineCap'], 'line cap')] },
  ]
}

/** What reading a composite that needs several properties produced. */
export type ExpansionResult =
  | { readonly kind: 'expanded'; readonly expanded: readonly Expanded[] }
  | { readonly kind: 'unwritable'; readonly reason: string }
  | { readonly kind: 'unrecognized' }

/**
 * Converts a composite that describes more than one CSS property (FR-25).
 *
 * Recognition is by shape, as everywhere else: only typography has a font size
 * and a line height, and only an object-form stroke style has a dash array.
 */
export function compositeToExpansion(raw: unknown): ExpansionResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'unrecognized' }
  const record = raw as Record<string, unknown>

  try {
    if ('fontFamily' in record || 'fontSize' in record || 'lineHeight' in record) {
      return { kind: 'expanded', expanded: typographyToExpansion(record) }
    }
    if ('dashArray' in record || 'lineCap' in record) {
      return { kind: 'expanded', expanded: strokeStyleToExpansion(record) }
    }
    return { kind: 'unrecognized' }
  } catch (err) {
    if (err instanceof Unwritable) return { kind: 'unwritable', reason: err.message }
    throw err
  }
}
