# Survey — tokens hidden behind `$`-prefixed keys (2026-09-14)

Measures the silent drop described in `../root-tokens-2026-09-14.md`: nodes that
carry `$value` but hang off a key starting with `$`, which the DTCG reader
discards without recording.

```sh
git clone --depth 1 https://github.com/terrazzoapp/dtcg-examples
node dollar-scan.mjs dtcg-examples
```

`dollar-scan.mjs` mirrors the reader's own recursion — it stops at any node
carrying `$value`, so a token node's `$type` and `$description` are never
mistaken for groups — and reports by key, by file, and by site.

## Result, corpus @ `main`, 2026-09-14

```
scanned 108 .json files
$root   56 tokens          ← the only $-prefixed key carrying $value, corpus-wide
  figma-sds/theme-dark.tokens.json    28
  figma-sds/theme-light.tokens.json   28
all direct (child itself carries $value)? true
```

No alias anywhere in the corpus targets a `$root` token, and figma-sds uses
neither `$ref` nor `$extends`.

## What this measurement does not count

- **`$extends`.** A group inheriting tokens it never receives is a silent loss of
  the same class, and this scan says nothing about it — it counts only nodes that
  already carry a `$value`.
- **Values that would fail later.** A `$root` node counted here can still be
  skipped downstream as a composite (FR-24) or refuse to name. The 56 is the
  number of tokens *seen*, not the number emitted.
- **Anything outside this corpus.** Seven design systems is evidence, not a
  census; `$root` is spec-reserved, so it may appear anywhere.
