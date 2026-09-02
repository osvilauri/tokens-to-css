---
title: "Composite tokens — emission design"
status: decided; pending survey, PRD §12.6, fixtures
created: 2026-09-02
feeds: prd.md §12.6
supersedes: the three-options passage in addendum.md
measured_by: survey-2026-09-02/
---

# Composite tokens — emission design

Input to the PRD revision the addendum requires. Decisions are settled; the
survey numbers and the fixtures land in the same change as the revision, the way
FR-23 did (§12.5, SM-C3).

Sub-property names, required/optional status and value grammars below were read
from the DTCG spec (2025.10 draft) on 2026-09-02, not from memory.

## The rule that decides the shape

One question, asked of the type and not of the token:

**Does this type describe one CSS property, or several?**

- **One** → one custom property, one value. Shadow, border, transition, gradient,
  and the string form of strokeStyle.
- **Several** → expansion, one custom property per sub-property. Typography and
  the object form of strokeStyle.

This keeps "one token, one custom property" true wherever CSS lets it be true,
and breaks it only where CSS itself has no single property to hold the value.

## Naming under expansion

The suffix is **not a new table**. It is the sub-property key from the spec, run
through the existing naming rule (FR-9, `src/emit/name.ts`), appended to the
token's path:

```
typography.body-sm  +  fontSize   →  --typography-body-sm-font-size
```

Nothing new to freeze: the contract is "path + sub-key, same rule". A collision
between an expanded name and a real token is caught by the existing pass, which
already runs after naming (FR-21, `NAME_COLLISION`).

## Per-type emission

### typography — expands (5 required sub-properties)

`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight` — all
required by the spec.

```json
{ "typography": { "body-sm": { "$type": "typography", "$value": {
  "fontFamily": "{font.family.sans}",
  "fontSize": "{font.size.sm}",
  "fontWeight": 400,
  "letterSpacing": { "value": 0.16, "unit": "px" },
  "lineHeight": 1.42857
} } } }
```

```css
  --typography-body-sm-font-family: var(--font-family-sans);
  --typography-body-sm-font-size: var(--font-size-sm);
  --typography-body-sm-font-weight: 400;
  --typography-body-sm-letter-spacing: 0.16px;
  --typography-body-sm-line-height: 1.42857;
```

The `font` shorthand is not emitted, not even as an extra convenience property:
used alone it drops `letter-spacing` silently, which is the failure this product
exists to prevent.

### shadow — one value

Component order is **`offsetX offsetY blur spread color`**, `inset` prefixed when
true. This order is public contract from the moment it ships.

```css
  --shadow-md: 0px 2px 6px 0px var(--color-shadow-base);
  --shadow-inner: inset 0px 1px 2px 0px rgb(0 0 0 / 0.05);
```

An array of shadows joins with `, ` and stays one value.

### border — one value, with one refusal

Component order is **`width style color`**.

```css
  --border-focus: 2px solid var(--color-border-focus);
```

**A border whose `style` is a strokeStyle *object* is skipped**, naming the
sub-property. The spec allows it — its own `focusring` example uses it — but
`dashArray` is SVG geometry and a CSS border cannot carry it. The spec permits
tools to fall back to a "closest approximation"; approximating in silence is
exactly what this product does not do.

### transition — one value, deliberately partial

Component order is **`duration timingFunction delay`**, which is the tail of the
CSS `transition` shorthand.

```css
  --transition-emphasized: 200ms cubic-bezier(0.2, 0, 0, 1) 0ms;
```

The token never says *which* property is animated, so the consumer supplies it:
`transition: opacity var(--transition-emphasized)`. Nothing is invented.

### gradient — one value, deliberately partial

The DTCG gradient is an array of `{color, position}` stops with **no direction**.
Emitting `linear-gradient()` would require inventing an axis the token never
stated, so what is emitted is the stop list, on the same precedent as transition:

```css
  --gradient-brand: var(--color-blue-500) 0%, var(--color-red-500) 100%;
```

```css
.hero { background: linear-gradient(to right, var(--gradient-brand)); }
```

`position` is `0`–`1` in the token and a percentage in CSS; out-of-range values
are clamped to `[0, 1]`, as the spec requires.

### strokeStyle — string is one value, object expands

String form (`solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `outset`,
`inset`) is already a legal CSS line-style keyword and emits as-is.

Object form is two SVG properties, so it expands. `dashArray` joins with spaces.

```css
  --focus-ring-dash-array: 0.5rem 0.25rem;
  --focus-ring-line-cap: round;
```

## Array-form scalars — added after the 2026-09-02 survey

Two types are refused today for being arrays, in exactly the way object-form
colours were refused for being objects before FR-23. They are not composites:
each describes one CSS value.

**`fontFamily`** as an array of names joins with `, `:

```json
{ "font": { "family": { "mono": { "$type": "fontFamily",
  "$value": ["Monaco", "Consolas", "Lucida Console", "monospace"] } } } }
```

```css
  --font-family-mono: Monaco, Consolas, "Lucida Console", monospace;
```

**`cubicBezier`** as four numbers becomes the CSS function:

```json
{ "base": { "easing": { "linear": { "$type": "cubicBezier", "$value": [0, 0, 1, 1] } } } }
```

```css
  --base-easing-linear: cubic-bezier(0, 0, 1, 1);
```

Both are shape-identifiable — an array of strings under `fontFamily`, four
numbers under `cubicBezier` — so nothing here infers from `$type` either. The
same `cubicBezier` conversion serves `transition`'s `timingFunction`.

## Cross-cutting rules

**Aliased sub-values stay aliases.** A sub-value that is a reference emits
`var(--target)`, never the target's value. This is what keeps expansion from
duplicating the primitives: the relationship the token file expressed survives
into the CSS, exactly as it does for scalars today.

**A missing required sub-property skips the token**, under the partial-conversion
rule below. The spec draws the line — every sub-property of every composite is
`MUST` except shadow's `inset` — and it is not renegotiated here. No sub-property
is ever defaulted: a `spread` assumed to be `0` would be the product's first
inference, and there is no second place to stop. What changed on 2026-09-02 is
not whether such a token is emitted (it is not) but whether the rest of the file
dies with it (it no longer does).

**`inset` is the one optional sub-property in the set.** Absent or `false`, no
prefix; `true`, the `inset` keyword leads the value.

**`fontFamily` quoting**, corrected by the 2026-09-02 survey, which found four
notations in the wild rather than one.

A **string** value is emitted verbatim. The spec calls it a single font name,
but Microsoft Fluent and GitHub Primer both write an entire pre-quoted stack
there — `"'Segoe UI', -apple-system, sans-serif"` — and a quoting rule applied to
that would wrap the whole stack in quotes and produce one bogus font name, in
silence. Verbatim is also correct for a genuine single name: CSS accepts an
unquoted sequence of identifiers, so `San Francisco` needs no quotes.

An **array** joins with `, `, and each element is quoted only when the element is
plainly one font name — no comma and no quote character in it — **and** quoting
is needed: it contains something outside `[a-zA-Z0-9- ]`, starts with a digit, or
is a CSS-wide keyword (`inherit`, `initial`, `unset`, `revert`, `revert-layer`,
`default`). An element that already contains a comma or a quote is CSS the author
wrote, and is emitted unchanged, on the same reasoning as the string form.

Generic families (`serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`,
`system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`,
`emoji`, `fangsong`) are **never** quoted — quoting one turns the generic family
into the name of a font that does not exist.

**`fontWeight` written as a word** is translated through the spec's closed alias
table. A word outside it is refused; it is not passed through, because
`font-weight: regular` is invalid CSS that a browser ignores in silence.

| Value | Aliases |
|---|---|
| 100 | `thin`, `hairline` |
| 200 | `extra-light`, `ultra-light` |
| 300 | `light` |
| 400 | `normal`, `regular`, `book` |
| 500 | `medium` |
| 600 | `semi-bold`, `demi-bold` |
| 700 | `bold` |
| 800 | `extra-bold`, `ultra-bold` |
| 900 | `black`, `heavy` |
| 950 | `extra-black`, `ultra-black` |

**`lineHeight` is emitted as written**, without a unit. The unitless number is
semantic in CSS — it inherits as a ratio rather than a computed length — so
adding `em` would change behaviour.

**Dimension sub-values arrive in three notations**, sometimes in one file: the
object form `{ "value": 0.16, "unit": "px" }`, a plain string `"0.16px"`, and a
bare `0` — IBM Carbon's typography uses the last two. Object form goes through
the existing conversion (`src/dialects/values.ts`), so a non-CSS unit still
refuses; strings and numbers are emitted verbatim, as they are today. All three
must appear in the fixtures.

## Partial conversion — decided 2026-09-02

Until now a token this library could not represent killed the whole conversion.
A design system with two hundred good colours and one malformed typography token
produced no stylesheet at all. That changes here, and it is the largest
conceptual change in this revision: **success stops being all-or-nothing.**

### What is skipped, and what still kills the run

Skipping applies to exactly one class: **a single token whose value cannot be
written as CSS.** Missing required sub-properties, a border with an object-form
style, an unrecognized object or array, a `fontWeight` word outside the table, a
non-CSS unit.

Everything else stays fatal, unchanged: source unreadable, invalid JSON, a shape
the library does not accept, alias cycles, dangling references, name collisions,
write failures. Those are not "this token cannot be drawn" — they are "this
document does not say what it appears to say", and there is no partial answer to
give.

### The danger, and the two places the omission shows

A token that vanishes quietly is the exact failure this product exists to
prevent. A caller who writes `await generateCss(src)` and ignores the return
value must not end up with a stylesheet that is missing tokens they never heard
about. So the omission is recorded in two places, and one of them is the artifact
itself:

**1. In the result**, machine-readable:

```ts
interface GenerateCssResult {
  readonly outputPath: string
  readonly tokenCount: number
  readonly skipped: readonly SkippedToken[]   // new; empty when nothing was skipped
}

interface SkippedToken {
  readonly path: string        // dotted token path, as in TokenCssError.tokenPaths
  readonly code: FailureCode   // why, in the same vocabulary as failures
  readonly reason: string      // human sentence; wording is not contract
}
```

The `code` reuses `FailureCode` rather than forking a second vocabulary. One
consequence worth stating: `COMPOSITE_VALUE` stops being thrown and becomes a
skip reason. It stays in the enum — removing it would be a major version — and
its documentation changes to say so.

**2. In the stylesheet**, as a comment block above `:root`:

```css
/* 2 tokens were skipped:
 *   type.display01 — typography is missing letterSpacing
 *   focus.ring — a border style in object form has no CSS equivalent
 */
:root {
  --type-body01-font-size: 0.875rem;
```

This is the mitigation that actually works. The stylesheet is a generated file
that lands in a repository, so the comment shows up in code review and in the
diff the next time it regenerates. A token that silently stopped being emitted
becomes a visible line in a pull request.

### Rules that keep partial from becoming lossy

**A conversion that would declare zero custom properties fails** rather than
writing an empty stylesheet. An empty `:root {}` is a silent no-op wearing the
costume of a success.

**Skipping cannot break a reference chain.** Skips happen during normalization;
the alias graph is validated afterwards. So if anything references a token that
was skipped, that reference is dangling and the run fails — fatally, as it does
today. It is not possible for a skipped token to quietly hollow out a token that
survived.

**Nothing that converts today changes.** A file with no skipped tokens emits no
comment block and gets an empty `skipped` array, so its bytes are identical. That
is the test that keeps this a minor version, and it belongs in the corpus as a
golden.

### What was rejected

- **Defaulting the missing sub-value** (`spread: 0`, `delay: 0ms`) — the
  product's first inference, and there is no principled second place to stop.
- **Emitting what is present** (four properties instead of five, a shadow with
  three lengths) — it degrades cleanly in CSS, but it makes the emitted shape
  depend on the input's completeness, and `--x-letter-spacing` existing for one
  token and not another is a worse contract than its absence being announced.
- **An option** (`onUnrepresentable: 'refuse' | 'skip'`) — the product has
  refused configuration everywhere else; two behaviours would mean two golden
  corpora.

### Exhaustive reporting, in the same change

`pipeline.ts` states that each pass is exhaustive within its class (AD-5), and
two of three passes honour it: the alias graph reports all forty dangling
references at once, and so do collisions. Normalization does not — it throws on
the first unrepresentable token, so a file with eleven of them reports one.

Under partial conversion this stops being a nuisance and becomes a requirement:
every skipped token has to be collected before the stylesheet is written, because
they all have to appear in the comment block and in `skipped`. Exhaustiveness is
no longer a separate fix — it is how the feature works.

## Out of scope for this revision

- **Property-level references** (spec §7.3.3) — `{type.body.fontSize}` now has a
  real destination, but resolving one means the alias graph, cycle detection and
  collision detection all start operating on sub-paths. Still refuses with
  `ALIAS_DANGLING`. Adding it later is additive.
- **Approximating what CSS cannot express** — the border-with-object-style case
  above, and anything like it.
- **Inventing a gradient axis, a shadow default, or a transition property.**
- **Skipping anything that is not a single unrepresentable token.** In
  particular, dangling references stay fatal. The 2026-09-02 survey found them to
  be the dominant blocker in published files — 53 of the 58 that still fail — but
  the answer to a cross-file reference is multi-file merge, not skipping the
  token that made the reference.

## Public surface this adds

- Expanded custom-property names (path + sub-key).
- Component order for shadow, border, transition, gradient.
- The `fontWeight` alias table and the quoting rule, insofar as they decide
  emitted text.
- `GenerateCssResult.skipped` and the `SkippedToken` shape.
- The skipped-token comment block, which is part of the emitted bytes.

Documented in `docs/formats.md` alongside the naming rule, and covered by the
semver clause: changing any of it afterwards is a major bump.

**This release is a minor.** Every one of these types refuses today with
`COMPOSITE_VALUE`; refusal → acceptance is additive. Nothing already emitted
changes, and the `--…-font-size` family of names cannot collide with anything
previously emitted, because nothing was previously emitted for these tokens.
Partial conversion is additive in the same way — it turns errors into successes,
never the reverse — and `skipped` is a new field on a result that gained no
constraints. The one thing to watch is the comment block: it must appear only
when something was skipped, or every existing golden changes and the claim above
stops being true.

## Before this can be written into the PRD

1. ~~Re-run the survey.~~ **Done 2026-09-02** — `survey-2026-09-02/`. The corpus
   has grown to 98 files and 6,086 tokens across seven design systems:
   **29/98 today → 40/98 projected**, all eleven gained files blocked today by
   `COMPOSITE_VALUE` alone. The projection is structural, not executed, so it is
   re-run against the implementation before §12.6 is final. Two findings changed
   this document (array-form scalars; the `fontFamily` notations), and one
   changed nothing but is worth knowing: **cross-file references are now the
   dominant blocker, 53 of the 58 files that still fail.**
2. **Fixtures in the same change.** The corpus gains a third category: today it
   has `accept/` (input + golden stylesheet) and `reject/` (input + failure
   code), and partial conversion fits neither. Cases:

   - **accept**: all six composite types; both array-form scalars; `fontFamily`
     in each of the four notations found in the survey; dimension sub-values in
     all three notations (object, string, bare number); an aliased sub-value and
     a literal one side by side.
   - **partial** (new): input + golden stylesheet *including its comment block* +
     the expected `skipped` array. At least one with several skipped tokens, to
     pin exhaustiveness.
   - **reject**: a document where every token is skipped (zero properties is a
     failure, not an empty stylesheet); a reference pointing at a skipped token
     (must stay `ALIAS_DANGLING`).
   - **retire**: `fixtures/reject/composite-typography` and
     `fixtures/reject/composite-shadow` stop being rejections.
   - **regression guard**: a golden proving a file with nothing skipped emits no
     comment block and is byte-identical to what 1.0.0 produced.
3. **Write it as PRD §12.6**, following the shape of §12.5.
