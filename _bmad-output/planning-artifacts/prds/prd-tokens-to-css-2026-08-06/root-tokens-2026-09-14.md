---
title: "Root tokens (`$root`) — reading design"
status: decided; pending fixtures, changeset, PRD §4.2 revision
created: 2026-09-14
feeds: prd.md §4.2 (V1 DTCG subset), §12.7
measured_by: survey-root-2026-09-14/
independent_of: Epic 5 (merge multi-archivo, PR #22)
---

# Root tokens (`$root`) — reading design

The DTCG reader drops a token when its key starts with `$`, even when that node
carries `$value`. The drop is silent: it is not counted, not reported in
`skipped`, and not named in the comment block above `:root`. That is precisely
what FR-20 and FR-24 exist to forbid — a disappearance on a success path.

`$root` was read from the DTCG spec (2025.10 draft) on 2026-09-14, not from
memory, because the decision below turns on what the spec says it is.

## The bug, exactly

`src/dialects/dtcg.ts` declares every `$`-prefixed key metadata:

```ts
const isDollarKey = (key: string): boolean => key.startsWith('$')
```

and `src/dialects/walk.ts` does `continue` on any key the reader calls metadata
— before it ever looks at the child. A child that *is* a token is therefore
never seen, so it cannot be recorded as skipped either.

Reproduced against the compiled 1.1.0:

```json
{ "color": { "brand": {
  "$root":  { "$type": "color", "$value": "#ff0000" },
  "hover":  { "$type": "color", "$value": "#cc0000" }
} } }
```

→ `{ tokenCount: 1, skipped: [] }`, and a stylesheet holding only
`--color-brand-hover`. Two tokens went in; one came out; nothing said so.

## What the spec actually says

This is the fact that decides the rest, and it cuts against the framing this
work started from — **`$root` is not a Terrazzo or Figma SDS convention.**

§6.2 *Root Tokens in Groups*: groups "MAY contain a root token alongside child
tokens and nested groups", and "Groups support root tokens using the reserved
name `$root` as the token name". It is a reserved *token name*, listed in §6.7.1's
resolution order between local tokens and extended tokens.

Two further clauses constrain the design:

- **§6.7.2 Path Construction** — "The reserved token name `$root` **is included
  in the path** to maintain explicit, unambiguous references." The spec's own
  table gives `/color/accent/$root` → path `color.accent.$root`.
- **§6.2 / §6.7.2** — `{color.accent}` is an *invalid* token reference; it names a
  group. `/color/accent` is "Invalid for token resolution, valid for groups".

So the group's own value is reachable only as `…group.$root`, never as `…group`.

## Measurement (whole corpus, not just Figma SDS)

`terrazzoapp/dtcg-examples` @ `main`, cloned 2026-09-14. The scan walks every
`.json` file, mirrors the reader's own recursion (never descending into a token
node's `$` keys), and counts nodes carrying `$value` anywhere beneath a
`$`-prefixed key. Harness: `survey-root-2026-09-14/dollar-scan.mjs`.

| | |
| --- | --- |
| Files scanned | 108 |
| `$`-prefixed keys carrying `$value` | **`$root`, and nothing else** |
| Tokens hidden behind them | **56** |
| Where | `figma-sds/theme-light.tokens.json` (28), `figma-sds/theme-dark.tokens.json` (28) |
| Shape | all **direct** — the child itself carries `$value`; none buried deeper |
| Aliases targeting a `$root` token | **0**, corpus-wide |
| `$ref` / `$extends` in figma-sds | none |

The hidden tokens are the base colour of each semantic group —
`color.background.brand.$root`, `color.text.danger.$root`, and so on — each an
alias into the primitive ramp (`{color.brand.800}`).

### A correction to how this was first framed

This work started from "the emitted sheet has `--color-background-brand-hover`
but not `--color-background-brand`". Measured, that overstates it: **there is no
emitted sheet for those files.** The primitive ramps live in a *sibling* file, so
both theme files fail `ALIAS_DANGLING` today and always have.

What the fix actually changes there, measured before and after:

| | `theme-light` | `theme-dark` |
| --- | --- | --- |
| dangling references, 1.1.0 | 98 | 98 |
| dangling references, this change | **126** | **126** |

Exactly +28 each: the `$root` tokens are now *read*, so they reach the alias
graph and are named in the failure instead of vanishing before it. The silent
drop is fixed; the 56 tokens reach a stylesheet only once Epic 5 makes the
primitives resolvable. The minimal repro at the top of this document — a
self-contained file — is where the emission is proved, and it now returns
`tokenCount: 2` with `--color-brand: #ff0000` present.

Note the survey harness from 2026-09-02 carries the same blind spot in its own
`countTokens` (`if (!k.startsWith('$'))`), so every token count this project has
published to date under-counts figma-sds by 28 per theme file.

## Decision

### 1. `$root` is a token. The path keeps it; the name drops it.

Supported, because it is a spec feature with defined semantics and a real system
depends on it. But the two halves are separated, and that separation is the
whole design:

- **The token path keeps the `$root` segment** — `color.background.brand.$root`.
  This is §6.7.2 verbatim. It keeps `{color.brand.$root}` resolvable in the alias
  graph, and it makes `skipped` entries and error messages name the token the way
  the document wrote it.
- **The naming rule elides the `$root` segment** — `--color-background-brand`.
  In CSS there are no groups, so the natural name for a group's own value is the
  group's name.

Eliding at the *path* level instead — the shape this work was originally framed
around — would have been wrong: it makes `{color.brand.$root}` dangle, and it
asserts a token at `color.brand`, which §6.7.2 declares invalid.

**This does not change `src/emit/name.ts`'s behaviour for any input that can
reach it today.** No token path can currently contain a `$root` segment, because
every such token is dropped before naming. The rule is purely additive — a minor
version, not a break of the semver-frozen naming contract. `--color-brand-root`
was the alternative; it is honest but names nothing anyone wants to consume.

Collisions are not this rule's problem to solve: two paths normalizing onto one
name is exactly what FR-21's pass already catches, after naming, by failing
clearly (`NAME_COLLISION`).

### 2. Any other `$`-prefixed key carrying `$value` is refused by name.

`$root` is the *only* reserved token name. Every other `$`-prefixed key is a
spec property, so a `$`-prefixed node carrying a direct `$value` is a document
shape this version does not accept, and it is refused as one
(`FORMAT_NOT_ALLOWED`) rather than dropped.

This keeps the FR-24 contract intact: `COMPOSITE_VALUE` remains the only
skippable code, and this failure gets its own sentence rather than a shrug, the
way `walk.ts` already argues for every other token-scoped failure.

**The known metadata keys are exempt and are never inspected:** `$type`,
`$description`, `$extensions`, `$deprecated`, `$extends`, `$ref`. `$extensions`
above all — it holds vendor data the spec says tools "MUST preserve … they do
not themselves understand", and that payload may legitimately contain a nested
`$value` that is not a token. Only a *direct* `$value` under an unknown `$` key
trips the refusal, so an extension payload cannot.

Zero documents in the corpus exercise this path. It is closed anyway, because
the criterion driving this work is general: nothing leaves the stylesheet
without saying so.

## Out of scope, noted here so it is not lost

**`$extends` is silently ignored.** §6.7.1 makes group inheritance part of
resolution, and this version treats `$extends` as metadata — so a document using
it converts "successfully" while every inherited token is missing. That is the
same class of bug as this one, is not measured here, and is not fixed here.

**`$ref`** is already caught before dialect detection, by
`findMultiFileConstruct`, and is Epic 5's subject.
