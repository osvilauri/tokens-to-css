---
title: "Multi-file merge survey — 2026-09-12"
status: measured
corpus: terrazzoapp/dtcg-examples @ 2026-09-12
library: tokens-to-css 1.1.0 (built from main, e27b154)
feeds: prd.md §12.7, merge-2026-09-12.md
---

# Multi-file merge survey, 2026-09-12

The measurement the merge revision quotes. Same corpus as `survey-2026-09-02/` —
98 files across seven design systems, 6,086 tokens — asked a different question:
not *which files convert*, but **what happens when the files a design system is
actually made of are merged the way the system says to merge them.**

## How to reproduce

```bash
git clone --depth 1 https://github.com/terrazzoapp/dtcg-examples.git
npm run build                       # in tokens-to-css
node survey.mjs dtcg-examples       # manifests, merge, and what the library makes of it
node probe.mjs  dtcg-examples       # the three systems that still fail, and what each would take
```

`survey.mjs` runs the **real library** on the merged document. The merge itself
and the manifest reading are projected in `resolve.mjs`, statically, because the
implementation does not exist yet — the library will merge on the internal
representation rather than on raw JSON, and for the questions asked here (which
files a manifest names, whether the references land) the two agree. Re-run this
against the implementation before §12.7 is final, the way story 4.5 did.

## The finding that reframes the epic

**Every design system in the corpus ships a DTCG Resolver 2025.10 manifest**, and
the corpus README lists `<system>.resolver.json` as the import for each one. The
merge order is declared by the authors of the tokens; it is not a convention this
library has to invent.

Of the 98 files, **93 are named by a manifest** under some context, and **71**
under the default ones. The five that no manifest names are all GitHub Primer
files.

That is also why "40 of 98 files" stops being the right scoreboard. After a
merge, the unit that converts is the **system**, not the file: `button.tokens.json`
alone is not a thing anyone wants converted, and it was never going to convert —
it is 40 references into files it does not contain.

## Result — merge only, nothing else changed

Each system merged from its own manifest, default context where the manifest
declares one, first context where it does not.

| System | Files in dir | Named by the manifest | Merged tokens | Result |
| --- | ---: | ---: | ---: | --- |
| figma-sds | 5 | 4 | 270 | **OK** — 346 properties |
| ibm-carbon | 6 | 3 | 356 | **OK** — 588 properties |
| microsoft-fluent | 6 | 5 | 179 | **OK** — 231 properties |
| shopify-polaris | 3 | 3 | 67 | **OK** — 67 properties |
| adobe-spectrum | 5 | 3 | 1,579 | FAIL — `FORMAT_NOT_ALLOWED`, one `dp` token |
| github-primer | 61 | 52 | 1,473 | FAIL — `FORMAT_NOT_ALLOWED`, three embedded references |
| apple-hig | 12 | 2 | 29 | FAIL — `ALIAS_DANGLING`, 11 references |

**4 of 7 systems convert whole, on the merge alone.** Zero dangling references in
six of the seven once merged: the 53 cross-file failures were exactly what they
looked like.

## What the other three would take

From `probe.mjs`. The transforms are projections — they stand in for capabilities
that do not exist — so they size the prize, not the design.

| System | Blocker | Instances | Properties behind it | Verdict |
| --- | --- | ---: | ---: | --- |
| adobe-spectrum | a token measured in `dp`, today fatal | **1** | **1,578** | in scope — FR-29 |
| github-primer | a reference inside a larger value | **3** | **1,458** | out — its own design (AD-20) |
| apple-hig | its manifest declares a `typography` set and never orders it | 1 manifest | 78 | out — the source is incomplete |

One token costs Adobe Spectrum fifteen hundred properties. That is FR-24's
argument in one line, and it is why the non-CSS unit joins the skippable codes in
this epic rather than the next one.

Apple HIG converts whole (78 properties) the moment the declared-but-unordered
set is included — which this library will not do on its own, because
`resolutionOrder` is what the spec says decides. It is named in the output
instead. The system is the one honest failure in the corpus: a manifest that does
not name all of its own tokens.

## What this measurement does not count

Found on 2026-09-14 while building a worked example out of Figma SDS, and
recorded here because it qualifies a number above rather than because it belongs
to this epic.

Figma SDS writes a group's own value under the key `$root`:

```json
"brand": {
  "$root": { "$type": "color", "$value": "{color.brand.800}" },
  "hover": { "$type": "color", "$value": "{color.brand.900}" }
}
```

`dialects/dtcg.ts` treats every `$`-prefixed key as metadata, so that node is
dropped — **and dropped in silence**: a two-token document of this shape returns
`tokenCount: 1, skipped: []`. In the corpus it is **28 tokens per theme file**,
and they are the base colour of each group: the emitted stylesheet has
`--color-background-brand-hover` and no `--color-background-brand`.

So "figma-sds converts whole, 346 properties" means *of what the reader saw*. It
is not a merge failure — it reproduces on 1.1.0 against the single file — and it
is not what this epic is about, but it does contradict the sentence FR-20 and
FR-24 both rest on: **no silent drop on a success path.**

Two things it needs that this survey does not supply: a decision (is `$root` the
group's own value, emitted as the group's name — or an out-of-subset key that is
skipped out loud?) and a count across the whole corpus. `$root` is not in the v1
DTCG subset the PRD fixes, and in these 98 files only Figma SDS uses it. Tracked
separately, ahead of Epic 5.

## Redefinitions: measured at zero, and the reason the rule exists anyway

| System | Sources applied | Same source twice | Identical redefinitions | **Value-changing** |
| --- | ---: | ---: | ---: | ---: |
| github-primer | 52 | 1 | 98 | **0** |
| every other system | 2–5 | 0 | 0 | **0** |

Primer lists `light.tokens.json` in `sets/base` *and* in `modifiers/theme/light`,
so 98 tokens are defined twice with identical values. **No token anywhere in the
corpus is redefined with a different value under default contexts.**

Both halves of the rule in `merge-2026-09-12.md` earn their place from this one
table: last-wins is free (nothing contends), and announcing only *value-changing*
redefinitions is what keeps the announcement from firing 98 times on the first
real manifest it meets.

## Contexts

| System | Modifiers | Default declared? |
| --- | --- | --- |
| shopify-polaris | none | — |
| figma-sds | theme | yes (`light`) |
| apple-hig | theme, size | yes (`light`, `medium`) |
| github-primer | theme, size | yes (`light`, `default`) |
| adobe-spectrum | theme, size | **no** |
| ibm-carbon | breakpoint | **no** |
| microsoft-fluent | theme | **no** |

**Three of seven manifests decline to choose.** Under the design those three
fail with `CONTEXT_REQUIRED` until the caller names a context — a one-line option
for IBM Carbon and Microsoft Fluent, both of which then convert whole. The
alternative, picking the first context in document order, would mean this library
selecting a theme on a team's behalf and writing it into a file that ships.

## Timing

Nothing here is near the 300 ms bar (NFR9, SM-5): reading and parsing Primer's
51 sources takes **5 ms**, and converting IBM Carbon's merged document — 3
sources, 588 properties — takes **13 ms**. Measured on the same laptop as the
2026-08-30 run, which is not the reference hardware; the epic ratifies a merged
bar in CI the way story 3.3 did for the single-document one.

## Summary

| | Systems converting whole |
| --- | ---: |
| Today, no merge | **0 of 7** |
| Merge only | **4 of 7** |
| Merge + the non-CSS unit skip (this epic) | **5 of 7** |
| \+ embedded references (next) | **6 of 7** |
| \+ a manifest Apple HIG would have to fix | 7 of 7 |
