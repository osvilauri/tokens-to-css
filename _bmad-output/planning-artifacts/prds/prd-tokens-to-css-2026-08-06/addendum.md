---
title: "Addendum: tokens-to-css PRD"
status: draft
created: 2026-08-06
updated: 2026-08-27
---

# Addendum — tokens-to-css

Depth that belongs in architecture / solution design / later phases — not the PRD narrative.

## Intentional overrides vs brief / research

| Source said | PRD v1 decision | Why |
| --- | --- | --- |
| Brief: library + CLI + API for local/CI generation | Installable Package + Main Entry only; **no Conversion CLI** | User: CLI = install channel only |
| Research: CLI `analyze` / `build` | Same — Main Entry only | Same |
| Research: optional naming prefix | No configurable prefix in v1 | User decision |
| Research: layered CSS / theme selectors / `@theme` | Single Styles File, `:root` only | User / Vision |
| Research: Vendor Dialects as secondary shim | Vendor Dialects **in** v1 (Tokens Studio + SD legacy) | User elevation |
| Mixins from JSON | Out | User non-goal |
| Research: composites / Color Module 4 | **Rejected input** in v1 (FR-20) — not passthrough, not expanded | Review C4A |
| Research: Tokens Studio math / expressions | **Rejected input** (FR-17); no expression evaluation, no `eval` | Review H3 |
| Brief/PRD v1: "recognize" 3-tier / CTI / EightShapes as FRs | Retired to implementation note + fixture coverage (FR-5/6/7 retired) | Review H1B |
| PRD v1: Main Entry returns nothing / disk-only, runtime unstated | Disk-only made a **hard runtime constraint** (Node + writable FS) in Non-Users | Review H5 |

## Architecture backlog (from research)

- **ANRE pipeline:** Analyze → Normalize → Resolve → EmitCss; public surface may expose subset; Main Entry orchestrates write-to-disk.
- **Token graph:** Map-based Alias Graph Validation; cycle detection (FR-15) and dangling detection (FR-22) — both fail-clear. Name-collision detection (FR-21) runs after the naming rule, so it must catch collisions introduced by character normalization, not just identical paths.
- **Naming algorithm:** The path→kebab rule is now **normative in the PRD** (FR-9) and semver-public (§8). Architecture owns only edge cases (unicode, leading digits, segment separators) — they must stay deterministic and documented, and any change to observable names is a major bump.
- **URL fetch security:** PRD §9 now states the product minimums (https-only default, required timeouts, max response size, redirect cap with re-validation, link-local/metadata range refusal). Architecture owns the mechanism that implements them, plus identifier sanitization and prototype-pollution-safe normalization.
- **Packaging:** TypeScript ESM library for Node; small dependency surface; no hard SD/Terrazzo dependency.
- **Fixtures / TDD — OQ-1, owned here:** Freeze the versioned **Fixture Corpus**: accept fixtures (input + golden Styles File) for DTCG subset, SD legacy, Tokens Studio subset, each at 3-tier / CTI / EightShapes-like nesting; reject fixtures (input + expected failure code) for every rejection trigger in PRD §4.2.0 and every failure class FR-12–FR-15, FR-19–FR-22. Define directory layout and the golden-file update protocol. SM-1 cannot gate until this lands.
- **Atomic write:** temp file in target directory + rename (FR-2); no stray temp files on failure (FR-19); pre-existing Styles File untouched on failure.
- **Failure codes:** stable machine-distinguishable code per class (PRD §4.4/§8); codes are public surface — design the enum before epics.
- **Performance — OQ-2:** PRD now carries an assumed bar (SM-5: 10k-token fixture under 2s on reference hardware). Confirm or replace with measurements; PM signs off on the launch bar.

## Deferred product capabilities (post-v1 unless PRD revised)

- Conversion CLI for CI (`build` / `analyze`).
- In-memory Token JSON ingest (no Token Source file/URL).
- Multi-file / directory merge Token Sources; DTCG Resolver 2025.10.
- Taxonomy confidence report + model override as a first-class product feature (beyond normalize-for-Conversion).
- Theme selectors, multi-file CSS splits, Tailwind `@theme`.
- **Composite tokens — deferred to the first version after release. Decided 2026-08-30.**
  Typography, shadow, border, gradient, transition and stroke-style stay rejected in
  v1 (FR-20). Object-form colours and dimensions were moved *out* of this bucket and
  are accepted (FR-23, PRD §12.5); what remains is genuinely different.

  A typography token is five values for five CSS properties:

  ```json
  { "fontFamily": ["system-ui","sans-serif"], "fontSize": { "value": 0.875, "unit": "rem" },
    "fontWeight": 400, "letterSpacing": "0.16px", "lineHeight": 1.42857 }
  ```

  There is no line it fits on, so accepting it means choosing one of three things,
  each with consequences that do not come back:

  1. **Expand into several properties.** Breaks "one token, one custom property" —
     the sentence the product is built on — and freezes a set of new name suffixes
     (`-font-size`, `-line-height`, …) as public contract. IBM Carbon's 58 typography
     tokens would become roughly 290 declarations.
  2. **Use the `font` shorthand.** Fits on one line, but `letterSpacing` has no place
     in it and would be dropped silently. That is the exact failure this product
     exists to prevent.
  3. **Pass it through.** `[object Object]`. Never on the table.

  Shadow, border and transition have the same shape of problem in milder form: they
  *do* fit a single value, but the component order would become contract too.

  **Cost of deferring:** measured at four of thirteen published files in the 2026-08-30
  survey. Every file that converts today is colour, size or spacing; typography usually
  lives in its own file, so a fail-closed refusal costs that file rather than the system.

  **If it is picked up:** expansion (option 1), not the shorthand — losing `letterSpacing`
  quietly contradicts everything else here. It needs its own PRD revision, with a survey
  and fixtures in the same change, the way FR-23 did.
- Tokens Studio expressions / math and multi-file Studio sets.
- In-memory CSS return from the Main Entry (disk write is the only v1 success path).
- Taxonomy diagnostics: reporting the recognized hierarchy model, confidence, or model override.
- Collision recovery strategies (last-wins, auto-prefix) — v1 fails clear.
- Configurable custom-property prefix.
- Mixins from Token JSON.

## Rejected / not pursued

- Becoming a Style Dictionary replacement (multi-platform).
- Figma plugin / multi-brand theme UI in this product.
- Browser runtime in v1.

## Review disposition (2026-08-27)

Rubric + adversarial reviews (2026-08-07) were dispositioned by PM: recommended package accepted
(**C1A · C2A · C3A · C4A · H1B · H2 · H3 · H4A · H5 · H6**), plus the mechanical medium/low fixes.
The disposition table and the "not adopted" list live in `prd.md` §13; this addendum carries only the
architecture consequences above.
