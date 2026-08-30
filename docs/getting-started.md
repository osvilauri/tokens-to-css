# Getting started

Five steps. If any of them needs you to read the library's source, that is a bug
in this page — please say so.

## 1. Install it

```bash
npm i -D tokens-to-css
```

A dev dependency: it runs when you build, never in the browser. It installs no
dependencies of its own.

## 2. Have a token file

Copy [`tokens.json`](./example/tokens.json) into your project as
`design/tokens.json`, or point at your own. It looks like this:

```json
{
  "color": {
    "brand": { "$value": "#5A4FCF", "$type": "color" },
    "text":  { "$value": "{color.ink}" }
  }
}
```

## 3. Write the three lines that call it

`scripts/build-tokens.mjs`:

<!-- example:start -->
```js
import { generateCss } from 'tokens-to-css'

await generateCss('design/tokens.json')
```
<!-- example:end -->

That is the whole integration. There is no config file and no CLI — you own the
invocation site, which is why it goes wherever your build already lives.

Wire it in:

```json
{
  "scripts": {
    "tokens": "node scripts/build-tokens.mjs",
    "predev": "npm run tokens",
    "prebuild": "npm run tokens"
  }
}
```

## 4. Run it and look at what you got

```bash
npm run tokens
```

`assets/css/tokens.css` now exists:

```css
:root {
  --color-brand: #5A4FCF;
  --color-ink: #191627;
  --color-text: var(--color-ink);
  --space-md: 16px;
  --space-lg: 1.5rem;
  --button-background: var(--color-brand);
  --button-padding: var(--space-md);
}
```

Look at `--color-text`. Your token file said *text is ink*, and so does the
stylesheet — the relationship survived instead of being flattened to `#191627`.
Change `--color-ink` and everything pointing at it moves.

Link it once and use it like any other CSS:

```css
.button {
  background: var(--button-background);
  padding: var(--button-padding);
}
```

## 5. Break it on purpose

Change `{color.ink}` to `{color.inkk}` and run it again:

```
TokenCssError [ALIAS_DANGLING]
1 reference points nowhere:
  "color.text" references "color.inkk", which does not exist
```

Two things to notice, because they are the point of the whole library:

- It **named the token and the typo**. You do not have to go looking.
- **Your previous `tokens.css` is untouched.** A failed run never costs you the
  last good output — check it, it is still there.

---

## Where to go next

| | |
| --- | --- |
| [What it accepts](./formats.md) | DTCG, Style Dictionary legacy, Tokens Studio — and everything it refuses |
| [The naming rule](./naming.md) | How `color.brand` became `--color-brand`, and why that is a promise |
| [Failure codes](./failures.md) | The eight ways it can fail, and what each one means |

## Options

Every one is optional.

```js
await generateCss('design/tokens.json', {
  outDir: 'public/styles',      // default: assets/css
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

A URL works wherever a path does:

```js
await generateCss('https://tokens.example.com/design.json')
```
