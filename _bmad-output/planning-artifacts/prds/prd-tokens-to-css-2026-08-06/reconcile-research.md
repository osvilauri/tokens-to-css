# Finalize Step 2 — Input Reconciliation: Technical Research

**Input:** `research/technical-design-token-json-to-css-generation-research-2026-07-26.md`  
**PRD:** `prds/prd-tokens-to-css-2026-08-06/prd.md`  
**Addendum:** *does not exist* (`addendum.md` not present)  
**Reconciled:** 2026-08-06  
**Scope:** Product-relevant capabilities/risks present in research but missing or under-specified in PRD; items that belong in architecture addendum (not PRD); contradictions where research recommendations diverge from locked PRD decisions.

---

## 1. Alignment Snapshot

| Theme | Research stance | PRD stance | Status |
| --- | --- | --- | --- |
| DTCG `$value` / `$type` / aliases | Core MVP | FR-4, FR-10, FR-15 | Aligned |
| 3-tier / CTI / EightShapes recognition | Core differentiator | FR-5–FR-8 | Aligned (capability); depth differs (see §2) |
| `:root` custom properties + `var()` preserve | Default emission | FR-9, FR-10 | Aligned |
| TypeScript / Node library; no SD hard dep | Recommended | §§8–10 | Aligned |
| Complement SD, not replace | Explicit | Non-goal + SM-C2 | Aligned |
| SCSS / multi-platform emitters | Out of MVP | Non-goals | Aligned |
| Mixins from tokens | Not a research MVP pillar (SCSS out) | Explicit non-goal | Aligned (PRD clearer) |
| Vendor dialects (Tokens Studio; SD legacy) | Secondary shim / preprocess | First-class Supported Format (FR-17, FR-18) | **PRD stronger** — not a conflict |
| Conversion CLI (`analyze` / `build`) | Phase 0 deliverable | Explicitly **out** (FR-16, §5) | **Contradiction** |
| Layered multi-file CSS + theme selectors | Default / Phase 1 | Single Styles File; `:root` only | **Contradiction** (scope) |
| Configurable CSS name prefix | Recommended option | Explicitly **out** v1 | **Contradiction** |
| Taxonomy confidence + override API | Product wedge | Recognize enough to convert only | **Gap** (product depth) |

**Verdict:** `gaps-material` — intentional PRD narrowing is documented, but research still surfaces product-relevant gaps (taxonomy productization, multi-file input, performance/security risks, deferred theming/Resolver) and several direct contradictions with research MVP recommendations.

---

## 2. Product-Relevant Gaps (research → missing or thin in PRD)

These are capabilities, risks, or success criteria in research that matter to product scope/UX and are not adequately reflected as FRs, non-goals, metrics, or explicit deferrals in the PRD.

### G1 — Taxonomy as a first-class product surface

**Research:** Differentiation = structure intelligence; ship taxonomy **reports with confidence scores** and user override (`--model=three-tier`); dry-run / analyze-only mode for DS leads; success KPI for detection precision.

**PRD:** FR-5–FR-8 / FR-8 require recognize/normalize enough for Conversion eligibility — no standalone Analyze report, confidence, override, or analyze-only journey.

**Impact:** Product wedge from research is reduced to internal preprocessing. If intentional, PRD should **explicitly defer** “taxonomy report / confidence / override” as post-v1. If not intentional, add FR or open question.

### G2 — Multi-file Token JSON / merge semantics

**Research:** Multi-file merge (later sources win), Resolver ordering, CI globs (`tokens/**/*.json`) are core pipeline concerns; alias resolve **after** merge.

**PRD:** Token Source is a singular URL **or** local path; no multi-file / directory / merge contract.

**Impact:** Common real-world token layouts may fail FR-14 (unsupported) or force users to pre-merge. Needs either v1 FR (directory/glob + merge rules) or explicit non-goal + guidance.

### G3 — Performance / scale NFR

**Research:** Map-based indexes required; historical multi-minute failures on nested walks; cold build of ~10k tokens under negotiated budget (e.g. &lt; 2s); smoke perf on 5k–20k fixtures.

**PRD:** No performance NFR or scale target in §7 or §9.

**Impact:** Large Vendor Dialect / DS exports are in-scope formats without a measurable reliability bar. Recommend at least a secondary metric or NFR placeholder owned by architecture with a product-agreed budget.

### G4 — Theming / layered CSS / Tailwind `@theme` not explicitly deferred as product backlog

**Research:** Phase 1 = theme selectors (`.dark`, `[data-theme]`), split files (`primitives.css` / `semantic.css` / `components.css`), optional `@theme`; Phase 2 = DTCG Resolver, composites, Color Module 4.

**PRD:** Assumption: single Styles File; out of scope notes cover multi-theme beyond `:root` and SCSS/JS — but **do not name** Resolver, composite expand, `@theme`, or OKLCH/gamut as deferred product capabilities.

**Impact:** Risk of silent scope creep or stakeholder surprise. Prefer explicit “Deferred (post-v1)” bullets mirroring research Phase 1–2.

### G5 — Alias / graph failure modes beyond cycles

**Research:** Fail loud on **dangling** aliases; collision report for CSS names; validate broken refs when `outputReferences` enabled.

**PRD:** FR-15 covers cycles only. No FR for unresolved/dangling refs or naming collisions.

**Impact:** Silent broken `var(--…)` or overwrite collisions possible on success path — conflicts with “no silent empty success” reliability spirit. Candidate FR or failure class for v1.

### G6 — Security / trust risks beyond URL fetch

**Research:** Path confinement for `$ref` / file includes; CSS identifier sanitization; no unsafe `eval` of token math (Tokens Studio–style expressions); prototype-pollution caution on deep merge.

**PRD:** §9 Security NFR only for remote URL fetch (timeouts, scheme/host). Math / `$ref` / sanitization absent.

**Impact:** With Vendor Dialects (Tokens Studio) in v1, expression/math and wrapper merge are product-relevant risk. URL NFR alone under-covers research risk table — at minimum call out in PRD cross-cutting NFRs and detail in architecture.

### G7 — Remote URL as primary Token Source vs research file-first model

**Research:** Primary interchange = Git-backed files; HTTP for hosted exporters / CI; library “no network by default” security pattern.

**PRD:** URL and local path are **equal** Token Source modes (FR-1) with security NFR for URL.

**Impact:** Not a missing capability (PRD has more product surface than research). Flag as **PRD expansion** that increases security/ops burden — ensure architecture addendum owns fetch policy; consider product note that URL is intentional v1, not research default.

### G8 — Composite tokens & color fidelity

**Research:** Composite expand (typography, shadow) Phase 2; Color Module 4 / gamut down-conversion; OKLCH trends.

**PRD:** Silent on composites and color spaces — neither in-scope nor deferred.

**Impact:** Ambiguous whether a typography/shadow composite DTCG token is Supported Format or FR-14. Needs explicit v1 rule (literal/`$value` passthrough vs expand vs reject).

---

## 3. Items for Architecture Addendum (not PRD)

Research content that should **not** inflate the PRD feature list; park in architecture / `addendum.md` when created.

1. **ANRE pipeline** (Analyze → Normalize → Resolve → EmitCss) and package layout (`parse/`, `graph/`, `analyze/`, `emit/css/`, `validate/`).
2. **TokenMap / Map-keyed graph**, memoized alias resolution, merge-then-resolve ordering, optional streaming writes — performance design.
3. **Exact Main Entry signature**, option names, error type shapes; default naming algorithm (kebab/path rules) given PRD forbids user-configurable prefix.
4. **URL fetch security policy** (timeouts, allowlists, redirect limits) and local `$ref` / include path confinement; CSS identifier sanitization; safe math/expression strategy for Tokens Studio dialect.
5. **ESM-first packaging**, `exports` map, dual-publish decisions, zero/hard-deps policy vs optional `jsonc-parser`; Vitest + golden fixture matrix (research must-test list).
6. **Phased tech backlog:** DTCG Resolver document, theme-selector emitters, layered file split, Tailwind `@theme` correctness, composite expand, Color Module 4 — implementation sequencing after PRD defers product scope.
7. **Interop positioning docs** (“complement SD/Terrazzo via DTCG”) and fixture strategy for Vendor Dialect normalization internals.
8. **CLI as future optional bin** — if ever revisited; must not contradict v1 Main Entry–only Conversion without a PRD change.

---

## 4. Contradictions (research recommendation vs PRD decision)

Recorded so architecture does not reintroduce research defaults that PRD rejected.

| ID | Research | PRD decision | Resolution guidance |
| --- | --- | --- | --- |
| C1 | Ship CLI `cssgen analyze\|build` wrapping same API (Phase 0) | **No Conversion CLI**; Conversion via Main Entry only; “CLI” = package-manager install | Architecture must not require a conversion binary for MVP. Analyze-only CLI also out unless PRD revised. |
| C2 | Default layered CSS files + theme selectors; Phase 1 theming | **Single** Styles File; `:root` only; multi-theme beyond `:root` out | Do not implement `.dark` / split files in v1 without PRD change. Document as deferred. |
| C3 | Prefix option + collision report for CSS names | **No** configurable naming prefix in v1 | Fixed naming algorithm only; collision handling → architecture (± product FR if fail-loud required — see G5). |
| C4 | Taxonomy report + confidence + override as product feature | Recognition/normalization **for Conversion** only | Either defer explicitly in PRD Non-Goals/Deferred or add FRs; do not invent public Analyze API from research alone. |
| C5 | Domain grounding / brief era: “library + CLI + API” | Library + Main Entry; install channel only | Research frontmatter is **stale relative to PRD** on packaging surface. |
| C6 | Optional SCSS variables out of MVP; mixins not emphasized | **Mixins** explicit non-goal | Consistent direction; PRD is stricter/clearer — no conflict to resolve. |
| C7 | Vendor dialects as shim / secondary parser (Theo low priority; Tokens Studio preprocess) | Vendor Dialects **in** v1 Supported Format (FR-17, FR-18) | Not a rollback of research — **PRD elevates** priority. Architecture must treat dialect normalization as first-class, not “nice later.” |

**Note on mixins:** Research does not argue for mixins-in; PRD “mixins out” is consistent. Listed only because Finalize checklist flags it as a decision axis.

---

## 5. Research Items Already Covered Adequately by PRD

- DTCG-style parse + `{alias}` resolve; cycle failure (FR-4, FR-15).
- Three hierarchy models as Conversion-eligible inputs (FR-5–FR-7).
- `:root` emission + preserve aliases as `var(--…)` (FR-9, FR-10).
- Clear failure for bad source / invalid JSON / unsupported format (FR-12–FR-14).
- Installable TS/Node package; no Figma plugin; no iOS/Android; no SD replacement (FR-16, §§5–6).
- Prefer no hard dependency on Style Dictionary / Terrazzo (§10).
- Time-to-first-CSS &lt; 15 minutes (SM-2) matches research KPI direction.
- Fixture correctness 100% (SM-1) matches research alias correctness goal.

---

## 6. Recommended PRD Follow-ups (optional, for PM)

Not required to complete this reconciliation file; for gap closure if desired:

1. Add **Deferred post-v1** list: Conversion CLI; taxonomy confidence report/override; multi-file merge; theme selectors / layered CSS; `@theme`; DTCG Resolver; composite expand; Color Module 4; configurable prefix.
2. Clarify **multi-file** and **composite** Token JSON: in, out, or “passthrough literal only.”
3. Add failure class or FR for **dangling aliases** (and optionally naming collisions).
4. Add lightweight **performance** NFR/metric or “architecture-owned budget.”
5. Extend security NFR bullet to **expression safety / path confinement / identifier sanitization** (detail in addendum).

---

## 7. Addendum Status

`addendum.md` **does not exist**. Section 3 items should seed the architecture addendum when Finalize / architecture workflow creates it. Do not treat this reconcile file as a substitute addendum.

---

## 8. Verdict

**`gaps-material`**

Rationale: Core Conversion story (DTCG + hierarchies + `:root` + `var()` + failures + installable API) is aligned, and several research recommendations were **consciously overridden** (no Conversion CLI, single file, no prefix, mixins out, vendor dialects in). Remaining material gaps are product-relevant: taxonomy product depth vs internal-only normalize, multi-file/composites ambiguity, missing performance and dangling-ref/security risk coverage, and undeclared deferral of research Phase 1–2 theming/Resolver work. Architecture must follow PRD over research on C1–C4 while elevating Vendor Dialect work per C7.

---

> **Supersession note (2026-08-27).** This reconcile was written before `addendum.md` existed and before the
> 2026-08-07 reviews were dispositioned. Gaps recorded here that are now closed in `prd.md` v2 (§13) — Supported
> Format allowlist, alias semantics, dangling/collision policy, composites, Tokens Studio bounds, JTBD vs CLI,
> path/write semantics, URL security bar — should be read as historical, not as open items. Remaining open items
> are tracked as OQ-1 – OQ-3 in `prd.md` §11.
