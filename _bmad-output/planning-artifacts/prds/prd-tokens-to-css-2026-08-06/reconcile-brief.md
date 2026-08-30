---
title: "Brief ↔ PRD reconciliation"
input: "briefs/brief-tokens-to-css-2026-07-26/brief.md"
prd: "prds/prd-tokens-to-css-2026-08-06/prd.md"
addendum: none (file not present)
status: complete
created: 2026-08-06
updated: 2026-08-06
verdict: gaps-material
---

# Brief ↔ PRD Reconciliation — Finalize Step 2

**Inputs compared**

| Artifact | Path | Status |
| --- | --- | --- |
| Product brief | `_bmad-output/planning-artifacts/briefs/brief-tokens-to-css-2026-07-26/brief.md` | complete (2026-07-26) |
| PRD | `_bmad-output/planning-artifacts/prds/prd-tokens-to-css-2026-08-06/prd.md` | draft (2026-08-06) |
| PRD addendum | `…/prd-tokens-to-css-2026-08-06/addendum.md` | **missing** — no addendum reconciled |

**Method:** Walk brief sections (problem, solution, differentiation, audience, success, scope, vision) against PRD vision, users, glossary, FRs, non-goals, MVP, metrics, and assumptions. Tag each finding as **aligned**, **gap** (brief idea absent or under-specified in PRD), **contradiction**, or **intentional override** (PRD deliberately changes brief).

---

## 1. Executive alignment (what matches)

Core product thesis is shared:

- Developer-facing **library** that turns design-token JSON into **CSS custom properties**.
- **Structure-aware** path: recognize/normalize common hierarchies, respect **DTCG**, resolve aliases, emit CSS.
- Foundation models: **3-tier**, **CTI**, **EightShapes-like**.
- CSS-first; not a full Style Dictionary replacement; no Figma plugin / theme UI in MVP.
- Success hinges on correct alias resolution (no cycles / silent drops), hierarchy recognition, consumable `:root`-style CSS, and docs/fixtures usable without reading source.

PRD correctly cites the brief and expands operational detail (Token Source URL/path, disk write defaults, failure classes, metrics, NFRs).

---

## 2. Gaps — brief ideas missing or weakened in PRD

### 2.1 Qualitative tone / positioning (material for Finalize)

| Brief signal | PRD treatment | Gap |
| --- | --- | --- |
| Personal / passion project aimed at **professional design-system practice** — not investor pitch or consumer product | Absent; PRD is capability/contract tone only | Positioning voice and “why this exists” framing not carried forward |
| **Structure-aware analysis first, CSS generation second** | Analysis/normalize FRs exist (FR-5–FR-8) but as pre-steps to Conversion, not a product philosophy | Sequential “analysis-first” positioning soft; no standalone analysis outcome |
| Differentiation via **scope discipline + taxonomy fluency**, not platform moat | Partially implied by Non-Goals / counter-metrics; **Theo** competitor and “taxonomy fluency” language missing | Competitive/positioning table not reflected; moat framing diluted |
| Style Dictionary / Theo / Tokens Studio comparison table | SD: non-goal + Vendor Dialect; Tokens Studio: Vendor Dialect; **Theo: unmentioned** | Incomplete competitive story vs brief |
| Vision: **trusted piece of modern token toolchain**; longer-term optional emitters, tighter DTCG as spec evolves, **CI-friendly token-graph validation** — still library-first, CSS-core | Vision = installable Node/TS JSON→CSS bridge; longer-term brief vision not stated | Forward-looking roadmap tone lost (acceptable if intentional deferral — should be marked) |

**Recommendation:** Add a short PRD “Positioning / Product character” (or Vision subsection) that restates analysis-first, CSS-core, taxonomy fluency, and passion/DS-practice framing — even if non-normative for FRs.

### 2.2 Audience & jobs

| Brief | PRD | Gap |
| --- | --- | --- |
| **Primary:** DS engineers + frontend devs who **maintain token catalogs** | **Primary:** web developers integrating tokens into an **app/site under construction**; roles open | Catalog-maintainer / DS-pipeline job underweighted vs app-bootstrap job |
| **Secondary:** DS leads wanting a **quick structural read** of a JSON dump before committing to a pipeline | No secondary persona; no “inspect structure only” journey | Structural-read job from brief is missing as a user outcome |

PRD UJ-1 is a strong single journey but does not absorb the brief’s secondary “architecture evaluation” use.

### 2.3 Input surface

| Brief | PRD | Gap |
| --- | --- | --- |
| Ingest **files or in-memory structures** | Token Source = **URL or local path** only; Main Entry writes Styles File to disk | **In-memory Token JSON** (programmatic object) not in v1 contract |
| **One or more** token files | Single Token Source implied | Multi-file / merge ingestion not specified |

### 2.4 Theming language

| Brief | PRD | Gap |
| --- | --- | --- |
| Success: consumable in `:root` / **themed stylesheet** workflow | `:root` only; multi-theme selectors out of scope | “Themed” path from brief narrowed; OK if override is explicit (see §4) |

### 2.5 DTCG surface detail

Brief lists `$value`, `$type`, `$description`, `{path.to.token}`. PRD FR-4 covers `$value`/`$type` and “related DTCG conventions”; `$description` is not called out (preservation or ignore). Minor — confirm ignore vs emit as comment is architecture-owned.

### 2.6 Addendum pointer

Brief Scope says “Out of MVP (see addendum for options).” No PRD/brief addendum was found at the expected PRD path. Deferred options remain only in the brief’s Out-of-MVP list; no cross-doc options ledger.

---

## 3. Contradictions

### 3.1 Library + CLI + API vs Main Entry–only (material)

| Brief | PRD |
| --- | --- |
| Solution & MVP: **library + CLI + API**; success assumption: usable as **Node/TS library API and a CLI** for local/CI generation | Glossary + FR-16 + Non-Goals: **no Conversion CLI**; “CLI” = package-manager install only; Conversion via **Main Entry** only |

This is a direct product-shape conflict unless treated as an intentional PRD override (PRD Assumptions Index does so). For reconciliation: **contradiction resolved only if override is accepted as authoritative.**

### 3.2 Soft contradiction — “API” breadth

Brief “programmatic API” + in-memory structures vs PRD Main Entry that **loads from Token Source and writes Styles File to disk**. An in-memory-in / string-or-AST-out API is not described. Not a named contradiction, but the brief’s API form factor is narrower in the PRD than the brief implies.

No other hard contradictions found on hierarchy models, DTCG alias resolve, CSS custom properties, or out-of-MVP exclusions (Figma, multi-brand UI, SCSS/JS dual emitters, multi-platform SD parity).

---

## 4. Intentional PRD overrides of the brief

Treat these as **PRD-wins** (product decisions after brief), not accidental omissions — provided Finalize accepts them:

| Override | Brief | PRD decision | Notes |
| --- | --- | --- | --- |
| **No Conversion CLI** | Explicit MVP in-scope | Explicit non-goal; install channel only | Documented in Assumptions Index; largest form-factor change |
| **Token Source = URL + path** | Files / in-memory | Remote URL + local path; URL security NFR | Expansion vs brief for remote; contraction vs in-memory |
| **Vendor Dialects in MVP** | Formats vary (problem narrative); SD interop desirable not hard | **FR-17 / FR-18** Tokens Studio–shaped + SD legacy `value`/`type` | Scope **expansion** beyond brief’s numbered success bullets |
| **Disk write + defaults** | Emit CSS (unspecified path) | Always write Styles File; default `assets/css/tokens.css` | Operationalization |
| **Failure taxonomy** | Cycles / silent drops called out | Four classes FR-12–FR-15 | Strengthening |
| **Audience framing** | Catalog maintainers + secondary DS leads | App-under-construction developers; non-users for Figma-only / native | Narrower secondary |
| **`:root` only** | `:root` / themed | No multi-theme selectors in v1 | Narrowing |
| **No naming prefix config** | Naming “consistent with hierarchy” | Fixed algorithm; no user prefix | Clarification / constraint |
| **Node-only runtime** | Not explicit | Browser runtime out of v1 | Clarification |
| **Complementary to SD, not dependency** | Same assumption | Explicit in §10 / Assumptions | Aligned override of “build on SD” |

---

## 5. Coverage map (brief success / scope → PRD)

| Brief criterion / scope item | PRD coverage | Status |
| --- | --- | --- |
| Parse DTCG + resolve `{alias}` without cycles/silent drops | FR-4, FR-15, SM-1 | Aligned |
| Detect/normalize 3-tier, CTI, EightShapes-like | FR-5–FR-7, SM-1 | Aligned |
| Emit CSS custom properties for `:root` / themed workflow | FR-9; themed narrowed | Aligned with override |
| Library API + CLI | FR-16 Main Entry; CLI out | **Override / contradiction** |
| Docs + fixtures without reading source | SM-3, NFR Documentation | Aligned |
| Analyze/normalize common structures | FR-8 | Aligned |
| Preserve referential structure (semantic → primitive) | FR-10 | Aligned |
| Out: Figma plugin, theme UI, SCSS/JS dual, multi-platform | §5 / §6.2 | Aligned |
| SD interop desirable not MVP hard requirement | Assumptions + counter-metric; dialects in-scope | Aligned (refined) |

---

## 6. Severity & verdict

**Material gaps / conflicts**

1. **Conversion CLI** promised in brief MVP/success vs **explicitly removed** in PRD.
2. **Positioning / qualitative tone** (passion project, analysis-first, taxonomy fluency, toolchain vision, competitive table) largely absent from PRD.
3. **Secondary user** (structural read for DS leads) and **in-memory / multi-file** ingest not carried into PRD.

**Minor gaps**

- `$description` handling unspecified.
- “Themed stylesheet” wording vs `:root`-only.
- Missing addendum for deferred options.

**Verdict: `gaps-material`**

Core technical MVP (DTCG + three hierarchies → `:root` CSS with alias `var(--…)`) is well aligned, but the **CLI form-factor contradiction** and **loss of brief positioning / secondary jobs / in-memory API** are material for Finalize step 2. Accept PRD overrides explicitly in PRD Vision/Assumptions (and optionally restore a Conversion CLI or in-memory entry as a dated deferred item) before treating brief and PRD as closed-aligned.

---

## 7. Suggested Finalize actions (non-blocking for this note)

1. Confirm **Main Entry–only** as authoritative; update brief or add “Brief superseded” note for CLI language.
2. Restore a short **Positioning** paragraph from brief Executive Summary + What Makes This Different.
3. Decide: **in-memory Token JSON** in v1 API contract or explicitly out of MVP.
4. Decide: secondary **structure-inspect** capability deferred vs dropped.
5. Create or drop the brief’s referenced **addendum** so Out-of-MVP options have a home.

---

> **Supersession note (2026-08-27).** This reconcile was written before `addendum.md` existed and before the
> 2026-08-07 reviews were dispositioned. Gaps recorded here that are now closed in `prd.md` v2 (§13) — Supported
> Format allowlist, alias semantics, dangling/collision policy, composites, Tokens Studio bounds, JTBD vs CLI,
> path/write semantics, URL security bar — should be read as historical, not as open items. Remaining open items
> are tracked as OQ-1 – OQ-3 in `prd.md` §11.
