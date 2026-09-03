# The naming rule

A token's path becomes a custom-property name. This is the rule, and it is
**part of the public contract**: the names emitted here end up in your
stylesheets, so changing any of this is a major release.

There is no option to change it and no configurable prefix.

## The rule

`color.brand.primary` → `--color-brand-primary`

Each path segment is normalized, then the segments are joined with `-` and
prefixed with `--`. A segment is normalized in this order:

1. **Unicode NFC.** The same word can arrive composed or decomposed depending on
   which tool wrote the file — `é` as one code point, or `e` followed by a
   combining accent. Without this, two files that look identical would emit
   different names.
2. **Lowercased**, locale-independently. A Turkish locale maps `I` to a dotless
   `ı`; the emitted names must not depend on the machine that ran the build.
3. **Every run of characters outside `[a-z0-9]` becomes a single `-`.**
4. **Leading and trailing `-` are trimmed** from each segment.

## What that means in practice

| Token path | Custom property |
| --- | --- |
| `color.brand.primary` | `--color-brand-primary` |
| `colorBrand` | `--colorbrand` |
| `Color Brand` | `--color-brand` |
| `color___brand` | `--color-brand` |
| `spacing.2xl` | `--spacing-2xl` |
| `café` | `--caf` |

Two things worth reading twice:

**Case is discarded, not converted.** `colorBrand` becomes `--colorbrand`, not
`--color-brand`. The rule has no way to know where a word boundary was meant,
and guessing would be worse than being predictable.

**The rule is lossy.** `café` becomes `--caf` because the accent is outside
`[a-z0-9]`. That is deliberate, and it has a consequence.

## Tokens that become more than one property

A typography token describes five CSS properties, and an object-form stroke
style describes two. Each sub-value becomes its own custom property, named by
appending a suffix to the token's path — so the rule above still decides the
name, and the suffix is the only thing added:

```
type.body  +  fontSize   →  --type-body-font-size
```

| Sub-property | Suffix |
| --- | --- |
| `fontFamily` | `-font-family` |
| `fontSize` | `-font-size` |
| `fontWeight` | `-font-weight` |
| `letterSpacing` | `-letter-spacing` |
| `lineHeight` | `-line-height` |
| `dashArray` | `-dash-array` |
| `lineCap` | `-line-cap` |

**These seven are public contract**, like everything else on this page. The
suffix is the CSS property the sub-value feeds, not the DTCG key — the rule
above lowercases and splits on non-alphanumerics, so `fontSize` would otherwise
become `fontsize`, and the token would be spelled differently from the
declaration that uses it.

An expanded name collides like any other. A document holding both a `type.body`
typography token and a `type-body-font-size` token claims `--type-body-font-size`
twice, and fails exactly as below.

## Collisions

Because the rule is lossy, two different token paths can arrive at the same
custom property:

```
color.brand.primary  ┐
color.brand-primary  ├─→  --color-brand-primary
color.brand_primary  ┘
```

**This fails the conversion.** It does not pick a winner, and it does not
silently drop one of them — a stylesheet missing a token while reporting success
is the failure this library exists to prevent.

```
NAME_COLLISION
1 custom property is claimed by more than one token:
  --color-brand-primary ← "color.brand.primary", "color.brand-primary"
Rename one of each pair — this version will not pick a winner for you.
```

## A segment with nothing left

A segment that normalizes to an empty string — punctuation only, whitespace
only, or empty in the file — is a failure rather than a silent rename:

```
FORMAT_NOT_ALLOWED
token "color.!!!.primary" has a path segment ("!!!") with no letters or
digits, so it cannot become part of a custom-property name
```

## Order

Declarations appear in **document order** — the order the tokens are written in
the source file. Nothing is sorted or regrouped: CSS custom properties resolve
regardless of declaration order, so reordering would only break the
correspondence between your token file and the stylesheet it produces.

Converting the same file twice produces byte-identical output.
