# tokens-to-css

Convert design-token JSON into a CSS custom-properties stylesheet.

You hand it a token file — a path or a URL — and it writes a stylesheet of
`:root` custom properties your app can link, with alias relationships kept as
`var(--…)` rather than flattened. It is not a multi-platform token pipeline and
does not try to become one.

Zero runtime dependencies.

```bash
npm i -D tokens-to-css
```

## Use it

```js
import { generateCss } from 'tokens-to-css'

await generateCss('design/tokens.json')
// wrote assets/css/tokens.css
```

That is the whole integration. No config file, no CLI: you own the invocation
site, so it goes wherever your build already lives — an npm script, a build
step, a bootstrap file.

Given this:

```json
{
  "color": {
    "brand": { "$value": "#5A4FCF", "$type": "color" },
    "ink":   { "$value": "#191627", "$type": "color" },
    "text":  { "$value": "{color.ink}" }
  },
  "space": {
    "md": { "$value": { "value": 16, "unit": "px" }, "$type": "dimension" }
  }
}
```

you get this:

```css
:root {
  --color-brand: #5A4FCF;
  --color-ink: #191627;
  --color-text: var(--color-ink);
  --space-md: 16px;
}
```

Look at `--color-text`. Your token file said *text is ink*, and so does the
stylesheet — the relationship survived instead of being flattened to `#191627`.
Change the primitive and everything pointing at it moves, which is the reason to
keep tokens in a hierarchy at all.

Composite tokens work too. Shadow, border, transition and gradient become one
custom property each, and typography becomes one per property it describes:

```css
  --elevation-low: 0px 2px 6px 0px var(--color-shadow);
  --motion-emphasized: 200ms cubic-bezier(0.2, 0, 0, 1) 0ms;
  --type-body-font-size: 0.875rem;
  --type-body-letter-spacing: 0.16px;
```

An aliased sub-value stays an alias there too, so a shadow still moves when its
colour does. And where the token genuinely does not say something — a transition
never says *which* property it animates — the missing part is yours to supply
rather than ours to invent:

```css
.panel { transition: opacity var(--motion-emphasized); }
```

A URL works wherever a path does:

```js
await generateCss('https://tokens.example.com/design.json')
```

## What it reads

Three shapes, checked in this order. The first that matches decides how the
document is read.

| | |
| --- | --- |
| **Tokens Studio** | Exports with `$themes` / `$metadata`. The token set wrapper is dropped from the name, so you get `--color-brand`, not `--global-color-brand`. |
| **DTCG** | `$value`, `$type`, aliases — including the object notation the current spec uses for colours and dimensions. |
| **Style Dictionary legacy** | `value` / `type` without the dollar. Converts to a byte-identical stylesheet. |

Hierarchy is not a separate concern: three-tier, CTI, EightShapes-like or any
other nesting all flatten through the same naming rule.

Full detail, including everything it refuses, is in
[docs/formats.md](docs/formats.md).

## When it fails

It either writes a correct stylesheet or writes nothing at all. There is no
partial output, and a failed run never touches the stylesheet already there.

```
TokenCssError [ALIAS_DANGLING]
1 reference points nowhere:
  "color.text" references "color.inkk", which does not exist
```

Every failure carries a stable code you can branch on:

```js
try {
  await generateCss('design/tokens.json')
} catch (error) {
  error.code        // e.g. 'ALIAS_DANGLING'
  error.source      // the Token Source, as you passed it
  error.tokenPaths  // the offending tokens
}
```

The eight codes are listed in [docs/failures.md](docs/failures.md), generated
from the source that defines them.

## Options

All optional.

```js
await generateCss('design/tokens.json', {
  outDir: 'public/styles',       // default: assets/css
  fileName: 'design-tokens.css', // default: tokens.css
  baseDir: process.cwd(),        // what relative paths resolve against
  http: {                        // only used when the source is a URL
    allowInsecure: false,        // https only, unless you say otherwise
    timeoutMs: 10_000,
    maxBytes: 10_000_000,
    maxRedirects: 3,
  },
})
```

A remote source is fetched under a guard: `https` by default, one deadline
across the whole exchange, a size cap enforced while the body streams, redirects
re-validated at every hop, and loopback, private, link-local and cloud-metadata
addresses refused — including when the URL names one literally.

## Documentation

| | |
| --- | --- |
| [Getting started](docs/getting-started.md) | Five steps from install to a stylesheet, including breaking it on purpose |
| [What it accepts](docs/formats.md) | The three shapes, the order they are checked, and everything refused |
| [The naming rule](docs/naming.md) | How `color.brand` becomes `--color-brand`, and why that is a promise |
| [Failure codes](docs/failures.md) | The nine codes and what each one means |

## What it will not do

Some of these are on purpose and stay that way; the rest are recorded as
deferred, not forgotten.

- **Invent units.** A token whose value is `16` emits `16`, never `16px`,
  whatever its `$type` says.
- **Flatten references.** `var(--…)` all the way down.
- **Evaluate expressions.** `{spacing.md} * 2` is refused rather than computed.
  There is no evaluator in this package. `calc()` and `clamp()` are valid CSS
  and pass through untouched.
- **Guess at a token it cannot write.** A composite missing a sub-property the
  spec marks required, a border whose style is SVG geometry, a font weight that
  is not a weight — each is **skipped**: left out of the stylesheet, listed in
  `skipped` on the result, and named in a comment above `:root`, while the rest
  of the file converts.
- **Emit the `font` shorthand.** Used alone it drops `letter-spacing` in
  silence, so a typography token becomes five properties rather than five plus a
  trap.
- **Pick a winner on a collision.** Two token paths that produce the same
  custom-property name fail the conversion rather than one quietly overwriting
  the other.

## Requirements

Node **22.12 or newer**. Development and CI target Node 24; CI also runs 22 and
26. ESM only, with TypeScript types included.

Conversion writes to disk, so it needs a writable filesystem. There is no
browser build.

## Contributing

```bash
npm install
npm run check     # lint + typecheck + tests
npm run build
```

`npm run lint` is not a style linter. It enforces the architecture: the build
fails if a pure stage (`src/dialects/`, `src/validate/`, `src/emit/`,
`src/model/`, `src/pipeline.ts`) reaches for the filesystem or the network, and
it checks that the generated fixtures and documentation still match the code
they came from.

The [fixtures](fixtures/README.md) are the specification — nine files that must
convert byte for byte, seventeen that must fail with a named code. Where the
documentation and the fixtures disagree, the fixtures are right.

The requirements, the architecture and the work breakdown live under
[`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/).

## License

MIT — see [LICENSE](LICENSE).
