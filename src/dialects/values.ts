/**
 * Scalars the spec writes in an expanded notation (FR-23, FR-26).
 *
 * Four values in this format are one CSS value each, written as an object or an
 * array rather than a string:
 *
 *   { "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 1, "hex": "#000" }
 *   { "value": 0.25, "unit": "rem" }
 *   ["Monaco", "Consolas", "monospace"]
 *   [0, 0, 1, 1]
 *
 * All four are scalars written with more ceremony, not composites. FR-23
 * accepted the two written as objects, because refusing them meant refusing
 * every design system published against the current spec; the 2026-09-02 survey
 * found the same mistake still standing for the two written as arrays.
 *
 * Two properties of this module matter more than the conversion itself:
 *
 * **It reads the shape, never the `$type`.** `{colorSpace, components}` can only
 * be a colour; `{value, unit}` can only be a dimension. So nothing here infers
 * anything from a declared type, and the rule that a `16` never becomes `16px`
 * survives untouched.
 *
 * **It runs at normalization.** What reaches the internal representation is
 * still a plain string, so no stage downstream learns that object values exist.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath } from '../model/index.js'

/** Units CSS understands. `dp` and friends belong to other platforms. */
const CSS_UNITS = new Set([
  'px', 'rem', 'em', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh',
  '%', 'vw', 'vh', 'vmin', 'vmax', 'svw', 'svh', 'lvw', 'lvh', 'dvw', 'dvh',
  'cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax',
  'cm', 'mm', 'q', 'in', 'pt', 'pc',
  'deg', 'grad', 'rad', 'turn',
  's', 'ms',
  'fr',
])

const refuse = (message: string, path: readonly string[], source: string): never => {
  throw new TokenCssError(message, {
    code: FailureCode.FORMAT_NOT_ALLOWED,
    source,
    tokenPaths: [formatPath(path)],
  })
}

/** `{ value, unit }` — a dimension or a duration. */
function isDimension(raw: Record<string, unknown>): boolean {
  const keys = Object.keys(raw)
  return keys.includes('value') && keys.every((key) => key === 'value' || key === 'unit')
}

function dimensionToCss(raw: Record<string, unknown>, path: readonly string[], source: string): string {
  const { value, unit } = raw

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    refuse(
      `token "${formatPath(path)}" has a dimension whose value is not a number`,
      path,
      source,
    )
  }
  if (typeof unit !== 'string') {
    refuse(`token "${formatPath(path)}" has a dimension whose unit is not text`, path, source)
  }
  // No unit means no unit. `{ value: 0, unit: "" }` is a real thing in published
  // catalogues and `0` is a perfectly good CSS length; writing the number alone
  // is the same thing this does for a plain number token — say what the token
  // said, add nothing.
  if (unit === '') return String(value)

  if (!CSS_UNITS.has(unit as string)) {
    // `dp` is Android, `sp` is Android type. Emitting them verbatim would
    // produce a declaration a browser silently ignores.
    refuse(
      `token "${formatPath(path)}" is measured in "${unit}", which is not a CSS unit`,
      path,
      source,
    )
  }
  return `${value}${unit}`
}

/** `{ colorSpace, components, alpha?, hex? }`. */
function isColor(raw: Record<string, unknown>): boolean {
  return 'colorSpace' in raw && 'components' in raw
}

/**
 * Renders a colour.
 *
 * sRGB becomes `rgb()`, which every browser has understood for decades. The
 * components are 0–1 in the token and 0–255 in CSS, and across every published
 * design system checked while deciding this, that multiplication reproduces the
 * `hex` the file itself declares — exactly, in all 689 cases. So the familiar
 * notation costs nothing.
 *
 * Any other colour space becomes `color(space …)` with the numbers untouched,
 * because there is no lossless shorter form.
 *
 * `hex` is read and ignored, the way `$description` is. It is optional in the
 * spec, and a value that changed shape depending on whether an optional field
 * happened to be present would be worse than one that never uses it.
 */
function colorToCss(raw: Record<string, unknown>, path: readonly string[], source: string): string {
  const space = raw['colorSpace']
  const components = raw['components']
  const alpha = raw['alpha']

  if (typeof space !== 'string' || space === '') {
    refuse(`token "${formatPath(path)}" has a colour with no colour space`, path, source)
  }
  if (!Array.isArray(components) || components.length !== 3) {
    refuse(
      `token "${formatPath(path)}" has a colour with ${
        Array.isArray(components) ? `${components.length} components` : 'no components'
      }; three are expected`,
      path,
      source,
    )
  }

  const rendered = (components as unknown[]).map((component, index) => {
    if (component === 'none') return 'none'
    if (typeof component !== 'number' || !Number.isFinite(component)) {
      refuse(
        `token "${formatPath(path)}" has a colour whose component ${index + 1} is not a number`,
        path,
        source,
      )
    }
    return component
  })

  const suffix =
    typeof alpha === 'number' && alpha !== 1 ? ` / ${alpha}` : alpha === 'none' ? ' / none' : ''

  if (space === 'srgb') {
    const bytes = rendered.map((c) => (c === 'none' ? 'none' : Math.round((c as number) * 255)))
    return `rgb(${bytes.join(' ')}${suffix})`
  }
  return `color(${space} ${rendered.join(' ')}${suffix})`
}

/**
 * Families CSS resolves itself. Quoting one turns the generic family into the
 * name of a font that does not exist, so these are never quoted.
 */
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
])

/** Quoted, or they are read as the keyword rather than as a family name. */
const CSS_WIDE_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'default'])

/** A name that needs no quotes: one identifier, no spaces, not starting with a digit. */
const BARE_NAME = /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/

/** A comma or a quote means the author already wrote CSS here, not one font name. */
const ALREADY_CSS = /[,'"]/

/**
 * Renders one entry of a font family list.
 *
 * The 2026-09-02 survey found four notations in the wild, and two of them —
 * Microsoft Fluent's and GitHub Primer's — put an entire pre-quoted stack where
 * the spec says one name goes. A quoting rule applied to those would wrap the
 * whole stack in quotes and produce a single bogus font name, in silence. So an
 * entry that already contains a comma or a quote is passed through as written:
 * it is CSS the author wrote, and it is correct as it stands.
 */
function fontFamilyEntry(name: string): string {
  if (ALREADY_CSS.test(name)) return name
  if (GENERIC_FAMILIES.has(name.toLowerCase())) return name
  if (CSS_WIDE_KEYWORDS.has(name.toLowerCase())) return `"${name}"`
  return BARE_NAME.test(name) ? name : `"${name}"`
}

/** An array of names — every element a non-empty string with no reference in it. */
function isFontFamily(raw: readonly unknown[]): boolean {
  return (
    raw.length > 0 &&
    raw.every((n) => typeof n === 'string' && n.trim() !== '' && !/[{}]/.test(n))
  )
}

/** Four finite numbers, and nothing else in DTCG is written that way. */
function isCubicBezier(raw: readonly unknown[]): boolean {
  return raw.length === 4 && raw.every((n) => typeof n === 'number' && Number.isFinite(n))
}

/**
 * Converts a scalar written in an expanded notation into stylesheet text.
 *
 * Recognition reads the **shape** and never the declared `$type`, which is what
 * keeps "a `16` never becomes `16px`" true: `{colorSpace, components}` can only
 * be a colour, `{value, unit}` can only be a dimension, an array of names can
 * only be a font family, and four numbers can only be a curve.
 *
 * @returns The CSS value, or `null` when this is not a scalar in disguise — a
 * typography block, a shadow list, an array holding a reference. The caller
 * skips those (FR-24) rather than guessing at them.
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` when the value *is* one of these
 * shapes but is malformed or unusable in CSS, which is a different thing from
 * being unrecognized and gets its own message.
 */
export function scalarToCss(raw: unknown, path: readonly string[], source: string): string | null {
  if (typeof raw !== 'object' || raw === null) return null

  if (Array.isArray(raw)) {
    if (isFontFamily(raw)) return (raw as string[]).map(fontFamilyEntry).join(', ')
    if (isCubicBezier(raw)) return `cubic-bezier(${(raw as number[]).join(', ')})`
    return null
  }

  const record = raw as Record<string, unknown>
  if (isColor(record)) return colorToCss(record, path, source)
  if (isDimension(record)) return dimensionToCss(record, path, source)
  return null
}
