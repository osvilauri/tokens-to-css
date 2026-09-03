---
'tokens-to-css': minor
---

Shadow, border, transition and gradient tokens now convert.

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
