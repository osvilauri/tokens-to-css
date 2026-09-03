# tokens-to-css

## 1.1.0

### Minor Changes

- f34ccc4: Font families and easing curves written as arrays now convert.
  
  ```json
  { "font": { "mono": { "$type": "fontFamily", "$value": ["Monaco", "Consolas", "monospace"] } },
    "easing": { "in": { "$type": "cubicBezier", "$value": [0.2, 0, 0, 1] } } }
  ```
  
  ```css
    --font-mono: Monaco, Consolas, monospace;
    --easing-in: cubic-bezier(0.2, 0, 0, 1);
  ```
  
  Neither is a composite: an array of names and four numbers describe exactly one
  CSS value each. They were refused for being arrays, in the same way colours and
  dimensions were refused for being objects before the previous release — the same
  mistake standing in the other notation.
  
  Recognition reads the shape and never the declared `$type`, so a `16` still
  never becomes `16px`.
  
  A family name is quoted only when it needs to be, and a generic family never is:
  `"sans-serif"` in quotes names a font that does not exist. An entry that already
  contains a comma or a quote is passed through untouched — Microsoft Fluent and
  GitHub Primer both write a whole pre-quoted stack where the spec says one name
  goes, and quoting that would produce a single bogus font name.
  
  An array that is neither shape — empty, mixed, a shadow list, or holding a
  reference — is skipped rather than guessed at.
- 5f654ca: Typography and object-form stroke-style tokens now convert.
  
  These describe more than one CSS property, so each becomes several custom
  properties — one per sub-value, named by appending the property it feeds:
  
  ```css
    --type-body-font-family: var(--font-sans);
    --type-body-font-size: 0.875rem;
    --type-body-font-weight: 400;
    --type-body-letter-spacing: 0.16px;
    --type-body-line-height: 1.42857;
  ```
  
  The seven suffixes — `-font-family`, `-font-size`, `-font-weight`,
  `-letter-spacing`, `-line-height`, `-dash-array`, `-line-cap` — are public
  contract. Each is the CSS property the sub-value feeds, so the token is spelled
  the way the declaration that uses it is spelled.
  
  **The `font` shorthand is never emitted**, not even as an extra convenience
  property. Used alone it drops `letter-spacing` in silence, which is the exact
  failure this library exists to prevent.
  
  A `fontWeight` written as a word is translated through the spec's closed alias
  table, `thin`=100 through `ultra-black`=950. A word outside it skips the token
  rather than emitting `font-weight: regular`, which a browser ignores without
  saying so. A unitless `lineHeight` stays unitless, because the unitless number
  inherits as a ratio rather than as a length.
  
  An expanded name collides like any other: a document holding both
  `type.body` typography and a `type-body-font-size` token fails with
  `NAME_COLLISION` naming both.
  
  Measured against 98 published token files from seven design systems: **29 of 98
  converted before this release cycle, 40 now.** IBM Carbon converts completely.
- a2fe990: A token whose value cannot be written as CSS no longer fails the whole document.
  
  Until now a single composite — a typography block, a shadow list — cost the file
  it lived in, so a system with two hundred good colours and one malformed token
  produced no stylesheet at all. Such a token is now **skipped**: left out, and
  announced in two places.
  
  `GenerateCssResult` gains `skipped`, listing each omitted token with its path,
  its `FailureCode` and a reason. And the stylesheet itself carries a comment
  block above `:root` naming them — which is the half that matters, because a
  generated stylesheet lives in a repository and a token that stopped being
  emitted shows up in the next pull request's diff.
  
  Three rules keep partial from becoming lossy. A conversion that would declare
  zero custom properties fails with the new `NOTHING_EMITTED` code rather than
  writing an empty stylesheet. A reference to a skipped token is dangling, and
  still fatal. And a document with nothing skipped emits no comment block, so
  every conversion that succeeded before this change produces identical bytes.
  
  Only composite values are skipped. Everything else fails exactly as it did: an
  unreadable source, invalid JSON, a shape outside the allowlist, an alias cycle,
  a dangling reference, a name collision, Tokens Studio arithmetic, a non-CSS
  unit, a reference buried inside a larger value.
- 7404a35: Shadow, border, transition and gradient tokens now convert.
  
  ```css
    --elevation-low: 0px 2px 6px 0px var(--color-shadow);
    --elevation-stacked: 0px 1px 2px 0px #00000014, 0px 8px 16px -4px var(--color-shadow);
    --border-focus: var(--size-px2) solid var(--color-focus);
    --motion-emphasized: 200ms cubic-bezier(0.2, 0, 0, 1) 0ms;
    --gradient-hero: var(--color-focus) 0%, #FBFAFD 100%;
  ```
  
  Each describes one CSS value, so each becomes one custom property. **The
  component order is public contract** — `offsetX offsetY blur spread color` for a
  shadow, `width style color` for a border, `duration timingFunction delay` for a
  transition — and changing it is a major version.
  
  An aliased sub-value stays an alias: a shadow built on `{color.shadow}` emits
  `var(--color-shadow)` inside the larger value, so the shadow still moves when
  the colour does. Those sub-references are real edges in the reference graph, so
  one pointing at a token that does not exist is a dangling reference and fails
  the conversion, rather than emitting `var(--nothing)` under a successful run.
  
  Two are deliberately partial, because the token does not say the whole thing. A
  transition never says which property it animates and a DTCG gradient has no
  axis, so what is emitted is the part the token did state:
  
  ```css
  .panel { transition: opacity var(--motion-emphasized); }
  .hero  { background: linear-gradient(to right, var(--gradient-hero)); }
  ```
  
  A composite missing a sub-property the spec marks required is skipped, and the
  message now names which one — "its shadow is missing "spread"" rather than "it
  is an object". A border whose `style` is written as an object is skipped too:
  `dashArray` is SVG geometry a CSS border cannot carry, and the "closest
  approximation" the spec permits would be a silent guess.

## 1.0.0

### Major Changes

- e3426d1: First release.
  
  Converts design-token JSON into a CSS custom-properties stylesheet. Reads DTCG —
  including the object notation the current spec uses for colours and dimensions —
  Style Dictionary legacy, and Tokens Studio exports, from a local path or a URL.
  References are emitted as `var(--…)` rather than flattened.
  
  Published as 1.0.0 rather than 0.x deliberately: the emitted custom-property
  names and the eight failure codes are frozen public contract from this version
  on, and a `0.x` would have invited people not to rely on them.

### Minor Changes

- 58eef0f: Name collision detection: two token paths that arrive at the same custom
  property are refused by name rather than one quietly overwriting the other.
- 37ebd16: The public surface is settled: `generateCss`, `TokenCssError`, the eight
  `FailureCode` values, and the option and result types. The conversion behind the
  entry point arrives in Story 1.10; until then a publish guard refuses release.
