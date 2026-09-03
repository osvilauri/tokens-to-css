# Fixture Corpus

This corpus is the primary test suite and the operational definition of **SM-1**.
"Correct" means "matches the golden here" — not a reviewer's judgement.

## Layout

Fixtures are discovered by walking these directories. There is no registration
file: adding a folder adds a case.

```
accept/<dialect>/<hierarchy>/
  input.json      the token document
  expected.css    the golden, compared byte for byte

reject/<trigger>/
  input.json      the token document
  expected.json   { "code": "...", "tokenPaths": ["..."] }

partial/<case>/
  input.json      the token document
  expected.css    the golden, comment block included
  expected.json   { "skipped": [{ "path": "...", "code": "..." }] }
```

**Why there is a third category.** A partial conversion (FR-24) is neither of
the other two: the document converts, so it is not a rejection, and the
stylesheet is deliberately missing tokens, so an accept fixture would assert
only half of what happened. A partial fixture pins both halves — the bytes, and
the skip report — because either one alone can be right while the other is
wrong. A `partial/` fixture whose `skipped` list is empty is refused by the
harness: that is an accept fixture that wandered into the wrong directory.

Network failures are not shaped like a file — a timeout is a response, not a
document — so they live in `network/scenarios.ts` instead (AD-23), served by an
in-process `node:http` server the tests start and stop. SM-4's coverage claim is
the union of both mechanisms.

Adding a network case is a single-file change, the same way adding a fixture is
a single-folder change.

## The v1 freeze

Nine accept fixtures: three dialects (`dtcg`, `sd-legacy`, `tokens-studio`)
across three hierarchies (`three-tier`, `cti`, `eightshapes`). **The matrix is
complete and frozen.**

Within a hierarchy the three dialects emit byte-identical stylesheets — asserted,
not assumed. Across hierarchies the names differ, because the paths do: the same
colour is `--primitive-purple-500`, `--color-palette-purple-500` or
`--esds-color-purple-500` depending on how the catalogue is arranged.

**DTCG is the source; the other two are generated.**

```bash
npm run fixtures:derive          # rewrite the derived dialects
node scripts/derive-dialects.mjs --check   # what lint and CI run
```

Three hand-written copies of one catalogue drift the first time somebody edits
one, and the drift would surface months later as a confusing golden mismatch. So
only the DTCG files are edited by hand, and a check in `npm run lint` fails if a
derived file has fallen out of step.

A separate test asserts that all nine really do say the same thing: the same
values, the same number of references, however they are spelled or arranged.
Without that, comparing goldens would be comparing two different documents and
proving nothing.

**All nine express the same token catalogue.** Dialect and hierarchy are the only
variables, which is what makes their goldens comparable — two fixtures differing
only by dialect must produce byte-identical output.

The catalogue is deliberately small and deliberately awkward in the right places:

| What | Why it is there |
| --- | --- |
| A colour, a dimension, a font stack | The three value shapes teams actually have |
| A unitless number (`1.4`) | Proves no unit is invented for a value that must not have one |
| A key of `050` | Proves a numeric-looking key is not coerced to `50` |
| A three-hop chain (component → semantic → primitive) | Proves each hop emits its own `var()` rather than collapsing |
| A `$description` at document level and on a token | Proves both are read and ignored |

### Why the typography reject fixtures stay

`composite-typography` and `composite-shadow` are not placeholders for something
unfinished. Composite tokens are deferred to the first version after release
(decided 2026-08-30), because a typography token is five CSS properties and
accepting it is a product decision rather than a parsing one — see
`addendum.md`. Until that decision is made, refusing them clearly is the
behaviour, and these fixtures are what holds it.

### Why a Tokens Studio fixture is worth having

Read as an ordinary legacy document, such an export converts perfectly happily
and folds the token set name into every custom property — `--global-color-brand`
where `--color-brand` was meant. It reports success and is wrong everywhere at
once, which is the failure this corpus exists to make impossible.

Reject fixtures: one per rejection trigger in the PRD's allowlist section, and
one per failure class.

## Changing a golden

```bash
UPDATE_GOLDEN=1 npm test
```

CI never sets that variable, and the harness refuses to write under CI anyway —
a run that rewrites its own expectations proves nothing.

**A diff to an existing `expected.css` needs a `major` changeset in the same pull
request.** A golden changing means emitted output changed, and emitted names are
public contract. A *new* fixture's first golden is not a breaking change.

## The performance measurement (SM-5, OQ-2)

Taken 2026-08-30, at the close of Epic 1, while the pipeline could still change.

**Reference hardware:** Apple M3 Pro × 12 · 18 GB RAM · darwin 25.6.0 arm64 · node 24.20.0

| Tokens | Best of 3 | JSON size |
| ---: | ---: | ---: |
| 1,000 | 7 ms | 38 KB |
| **10,000** | **30 ms** | 395 KB |
| 50,000 | 127 ms | 2.0 MB |
| 200,000 | 590 ms | 8.3 MB |

Measured end to end through `generateCss` — read, parse, normalize, validate,
emit, write — because that is what a caller actually waits for.

**The assumed bar was 2,000 ms for 10,000 tokens. The real number is 30 ms.**

### The ratified bar: 300 ms

Set on 2026-08-30, from the slowest hardware it has to pass on rather than the
fastest. Twelve samples on CI, three Node lines:

| | best of 3 | worst single sample |
| --- | ---: | ---: |
| Developer laptop, M3 Pro | 30 ms | 41 ms |
| CI, shared AMD EPYC | 46–83 ms | 301 ms |

300 ms is roughly 3.5× the slowest *best-of-three* ever recorded. It is judged on
the best of three and never on a single sample: one CI run measured 301 ms where
the same commit measured 74 ms twice. Gating on any sample would make the build
flake, and a flaky performance gate gets ignored — which is worse than not having
one.

`node bench/run.mjs` exits non-zero over the bar. `BENCH_BAR_MS` overrides it for
an experiment; changing it for real means changing SM-5 in the PRD.

Scaling is linear: twenty times the tokens takes twenty times as long from 10k
to 200k, so there is no quadratic hiding at a size nobody tested.

Two things follow, both for the story that ratifies the bar:

1. **OQ-2 is answered.** The bar is not at risk and nothing in the pipeline
   needs redesigning for it.
2. **A 66× margin is not a bar, it is a formality.** At 2,000 ms the emitter
   could get sixty times slower and still pass, which means the metric would
   never catch the regression it exists to catch. Something around 300 ms
   leaves room for slower CI hardware and ordinary variance while still
   noticing if something goes badly wrong.

Regenerate with `node bench/run.mjs`, or `BENCH_TOKENS=50000 node bench/run.mjs`.
The document is generated rather than stored: it is fully determined by
`bench/generate.mjs`, and ten thousand tokens of JSON is a lot of file to review.
