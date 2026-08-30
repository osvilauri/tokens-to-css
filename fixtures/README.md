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
```

Network failures are not shaped like a file — a timeout is a response, not a
document — so they live in `network/scenarios.ts` instead (AD-23), served by an
in-process `node:http` server the tests start and stop. SM-4's coverage claim is
the union of both mechanisms.

Adding a network case is a single-file change, the same way adding a fixture is
a single-folder change.

## The v1 freeze

Nine accept fixtures: three dialects (`dtcg`, `sd-legacy`, `tokens-studio`)
across three hierarchies (`three-tier`, `cti`, `eightshapes`). One of the nine
exists so far — `dtcg/three-tier`; the rest arrive with their dialects in Epic 2.

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

### A note on `reject/sd-legacy-not-yet`

Style Dictionary legacy documents are refused *today* and become an accept
fixture in Epic 2. Moving it is an allowlist addition, not a golden change, so
it is a minor release — see the rule below.

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
