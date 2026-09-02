---
title: "Composite survey — 2026-09-02"
status: measured
corpus: terrazzoapp/dtcg-examples @ 2026-09-02
feeds: prd.md §12.6, composites-2026-09-02.md
---

# Composite survey, 2026-09-02

The measurement the composites revision quotes. Same corpus as the 2026-08-30
survey (`docs/proceso/cero-de-trece.html`), which had thirteen files; the corpus
has since grown to **98 files across seven design systems, 6,086 tokens** —
Adobe Spectrum, Apple HIG, Figma SDS, GitHub Primer, IBM Carbon, Microsoft
Fluent, Shopify Polaris.

## How to reproduce

```bash
git clone --depth 1 https://github.com/terrazzoapp/dtcg-examples.git
npm run build          # in tokens-to-css
node survey.mjs        # what the published library does today
node report.mjs        # today vs. projected, per design system
```

`survey.mjs` runs the real library. `classify.mjs` and `report.mjs` project the
new design **statically** — they check every composite against the rules in
`composites-2026-09-02.md` rather than running an emitter that does not exist
yet. The projected column is therefore a structural claim, not an execution
result, and must be re-run against the implementation before §12.6 is final.

## Result

| System | Files | Tokens | Convert today | Projected |
| --- | ---: | ---: | ---: | ---: |
| adobe-spectrum | 5 | 2,771 | 4 | 4 |
| apple-hig | 12 | 154 | 4 | 5 |
| figma-sds | 5 | 368 | 2 | 3 |
| github-primer | 61 | 2,028 | 13 | 15 |
| ibm-carbon | 6 | 416 | 2 | 6 |
| microsoft-fluent | 6 | 282 | 2 | 4 |
| shopify-polaris | 3 | 67 | 2 | 3 |
| **Total** | **98** | **6,086** | **29** | **40** |

**29/98 → 40/98.** Eleven files, every one of them blocked today by
`COMPOSITE_VALUE` alone.

## What is still blocked afterwards, and why

| Cause | Files | In scope? |
| --- | ---: | --- |
| Cross-file references | 53 | No — multi-file merge, deferred since v1 |
| Reference inside a larger value | 2 | No — embedded references, deferred since v1 |
| Non-CSS unit (`dp`) | 1 | No — a correct refusal |
| Missing required sub-property | 2 | Yes, and it costs nothing (below) |

**Cross-file references are now the dominant blocker by an order of magnitude**,
and they are not what this revision is about. Fifty-three of the fifty-eight
remaining failures are one deferred capability: a design system split across
files, where `bgColor.default` points at `base.color.neutral.6` defined in a
sibling file. Whatever is decided about composites, the next survey will be
dominated by this.

**The strict rule on missing required sub-properties costs zero files.** The two
files it blocks — GitHub Primer's `motion.tokens.json` (four transitions with no
`delay`) and `typography.tokens.json` (eleven typography tokens with no
`letterSpacing`) — both also carry cross-file references, so they do not convert
either way. The decision to obey the spec's `MUST` rather than default the
missing value is free in this corpus.

## What the survey changed in the design

Three things it found that the design did not have:

**1. Array-form scalars, the same mistake as FR-23 in different notation.**
Three of the eleven gained files are not composites at all:

- `fontFamily` as an array of names — `["Monaco","Consolas","monospace"]`
  (Shopify Polaris, Apple HIG). One CSS value.
- `cubicBezier` as an array of four numbers — `[0, 0, 1, 1]` (GitHub Primer
  easing). One CSS value: `cubic-bezier(0, 0, 1, 1)`.

Both are refused today for being arrays, exactly as object-form colours were
refused for being objects before FR-23. They are shape-identifiable and belong
in the same bucket: scalars written with more ceremony.

**2. Four notations for `fontFamily` in the wild, not one.**

| Convention | Example | Seen in |
| --- | --- | --- |
| Array of names | `["Monaco","Consolas","monospace"]` | Polaris, Apple HIG, Carbon |
| Array with one name | `["SF Pro"]` | Apple HIG |
| String, one whole stack, pre-quoted | `"'Segoe UI', -apple-system, sans-serif"` | Fluent |
| Array whose single element is a whole stack | `["'Mona Sans VF', …, sans-serif"]` | Primer |

A quoting rule applied blindly to the last two would wrap an entire stack in
quotes and produce one bogus font name — silently. The rule in
`composites-2026-09-02.md` was corrected accordingly.

**3. `letterSpacing` arrives in three notations**, sometimes in the same file:
the object form `{value: 0.16, unit: "px"}`, a plain string `"0.16px"`, and a
bare `0` (IBM Carbon uses the last two). All three already work — strings and
numbers are emitted verbatim today — but the fixtures must cover all three, or
the corpus will not represent what real files do.
