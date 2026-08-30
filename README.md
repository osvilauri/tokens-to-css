# tokens-to-css

Convert design-token JSON into a CSS custom-properties stylesheet.

One job: you hand it a token file — a path or a URL — and it writes a stylesheet
of `:root` custom properties your app can link, with alias relationships kept as
`var(--…)` rather than flattened. It is not a multi-platform token pipeline and
does not try to become one.

> **Status: in development.** Nothing is published yet. Local DTCG files convert
> end to end today; vendor dialects and URL sources are still to come — see
> [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md).

```js
import { generateCss } from 'tokens-to-css'

await generateCss('design/tokens.json')
// wrote assets/css/tokens.css
```

## Working on it

```bash
npm install
npm run check     # lint + typecheck + tests
npm run build
```

`npm run lint` is the architecture boundary check, not a style linter: it fails
the build if a pure stage (`src/dialects/`, `src/validate/`, `src/emit/`,
`src/model/`, `src/pipeline.ts`) reaches for the filesystem or the network. Only
`src/source/` and `src/write/` may do that. The rule comes from AD-1 in the
architecture spine.

**Node 22.12 or newer.** Development and CI target 24 (Active LTS); CI also runs
22 and 26. Node 25 is end-of-life and untested here.

### TypeScript 7

The stack pins TypeScript 7.0.x — the release built on the Go-native compiler.
Verified 2026-08-30: tsdown 0.22 builds and emits declarations against it, and
Vitest 4.1 runs the suite. tsdown does print `TypeScript 7.0 does not yet have a
stable API and is experimental. Some options will be unavailable.` Nothing this
package needs is among them today, so the planned fallback to TypeScript 6.x was
not taken. Revisit if a build option turns out to be unavailable.

## Where the decisions live

| What | Where |
| --- | --- |
| What it does and refuses to do | `_bmad-output/planning-artifacts/prds/prd-tokens-to-css-2026-08-06/prd.md` |
| How it is built, and why | `_bmad-output/planning-artifacts/architecture/architecture-tokens-to-css-2026-08-29/ARCHITECTURE-SPINE.md` |
| The work, in order | `_bmad-output/planning-artifacts/epics.md` |

## License

MIT — see [LICENSE](LICENSE).
