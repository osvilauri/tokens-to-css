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
document — so they live in the in-process scenario harness instead (AD-23).
SM-4's coverage claim is the union of both mechanisms.

## The v1 freeze

Nine accept fixtures: three dialects (`dtcg`, `sd-legacy`, `tokens-studio`)
across three hierarchies (`three-tier`, `cti`, `eightshapes`).

**All nine express the same token catalogue.** Dialect and hierarchy are the only
variables, which is what makes their goldens comparable — two fixtures differing
only by dialect must produce byte-identical output. The shared catalogue is
recorded here as fixtures land.

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

## Reference hardware

Recorded when Story 1.14 takes the first measurement for SM-5.
