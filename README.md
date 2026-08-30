# tokens-to-css

Convert design-token JSON into a CSS custom-properties stylesheet.

One job: you hand it a token file — a path or a URL — and it writes a stylesheet
of `:root` custom properties your app can link, with alias relationships kept as
`var(--…)` rather than flattened. It is not a multi-platform token pipeline and
does not try to become one.

> **Status: in development.** Nothing is published yet, but every input shape now
> converts end to end — DTCG (including the object notation the current spec
> uses for colours and dimensions), Style Dictionary legacy and Tokens Studio,
> from a path or a URL. What remains is documentation and release — see
> [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md).

```js
import { generateCss } from 'tokens-to-css'

await generateCss('design/tokens.json')
// wrote assets/css/tokens.css

await generateCss('https://tokens.example.com/design.json')
// same, fetched over https
```

## Probarlo

```bash
npm run demo
```

Abre un servidor local con un campo para una URL y otro para un archivo del
ordenador, y muestra las primeras 200 líneas del CSS junto a un enlace de
descarga. Trae varios sistemas de diseño publicados como ejemplos de un clic,
incluido uno que **falla** — porque leer un mensaje de error es la mitad de
saber si esta herramienta sirve.

La librería es Node y escribe a disco, así que la demo necesita ese servidor:
no hay forma de correrla en una página suelta, y simularla sería mentir sobre
lo que hace.

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
