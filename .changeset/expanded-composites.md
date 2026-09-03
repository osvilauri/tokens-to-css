---
'tokens-to-css': minor
---

Typography and object-form stroke-style tokens now convert.

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
