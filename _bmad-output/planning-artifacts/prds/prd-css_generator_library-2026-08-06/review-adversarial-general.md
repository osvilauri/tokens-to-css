# Adversarial Review — css_generator_library PRD

**Reviewed:** `prd.md` + `addendum.md` (draft, 2026-08-06)  
**Also considered:** `reconcile-research.md`, `reconcile-brief.md` (known gaps; some already mitigated by addendum, many not)  
**Reviewer stance:** Cynical product/requirements review. Assume the PRD will be treated as the launch contract.

---

## Overall stance

This PRD is a tidy capability brochure pretending to be a launch contract. The happy path (install → call Main Entry → get `tokens.css`) is sketched; the hard edges of “Supported Format,” recognition vs conversion, alias semantics, disk/URL failure modes, and Vendor Dialect reality are left as architecture homework or open questions. Shipping against this document as-written invites untestable FRs, silent broken CSS on “success,” and an MVP that quietly contradicts its own JTBD (“avoid one-off conversion scripts”) by forcing every CI user to write a wrapper because Conversion CLI was deleted.

Addendum correctly parks some research overrides. It does **not** close product holes. Several reconcile findings remain live risks.

---

## Findings

- **[critical]** “Supported Format” is circular; FR-14 is untestable (§3 Glossary, FR-14, §6.1) — Glossary defines Supported Format as “a Token JSON variant that v1 must accept,” then FR-14 says fail when input is “not a Supported Format” / “recognizably unsupported.” That is a tautology, not an acceptance criterion. *Attack:* QA invents fixtures; eng invents detector heuristics; PM declares “fixture suite agreed” after the fact (SM-1). Ambiguous DTCG-ish hybrids, Theo dumps, and half-normalized Tokens Studio exports become infinite FR-14 vs FR-8 arguments. *Fix:* Replace circular definition with an explicit allowlist (formats + fixture corpus + rejection examples). FR-14 consequences must cite named reject fixtures, not “recognizably unsupported.”

- **[critical]** Alias “resolve” vs “preserve as `var(--…)`” — contradictory success criteria (FR-4, FR-10, SM-1) — FR-4 requires alias chains “resolve without cycles or silent drops.” FR-10 requires emitted semantic properties remain `var(--…)` references, not flattened literals. “Resolve” in token pipelines usually means compute concrete values; here it is overloaded to mean “graph-walk for validity while emitting references.” *Attack:* Implementer flattens to pass FR-4 “resolve”; another implements only `var()` and claims resolve. SM-1 “correct Styles File” cannot arbitrate. *Fix:* Split vocabulary: **validate/resolve graph** (detect cycles/dangling) vs **emit references** (default `var(--…)`). State explicitly that v1 emission is reference-preserving, not value-inlining, and that “resolve” never means flatten-by-default.

- **[critical]** Dangling aliases and name collisions left open — silent broken CSS on success path (§11 OQ1–2, Reliability NFR §9, FR-12–FR-15) — Reliability promises Conversion writes a “correct” Styles File or fails clearly. Only four failure classes exist. Dangling aliases and `--name` collisions are open questions; addendum shrugs to architecture. *Attack:* Emit `var(--missing)` and overwrite colliding names; Conversion “succeeds”; app ships broken theme. Contradicts UJ-1 edge case spirit and SM-1 “correct.” *Fix:* Close OQ1–2 in the PRD before epics: fail-clear on dangling aliases and on custom-property name collisions (or document last-wins as an explicit, testable policy with a warning channel — still a product decision, not “architecture OK”).

- **[critical]** Composite / typed token behavior undefined — Supported Format hole (FR-4, FR-14, §6; reconcile G8) — DTCG composites (typography, shadow, border) and non-scalar `$type`s are neither in-scope nor deferred with a rule. *Attack:* Real Tokens Studio / DTCG fixtures contain composites. Eng either stringifies junk into `--foo: [object Object]`, drops silently (violates FR-4 “no silent drops”), or invents expansion — silent scope creep. FR-14 cannot decide without a product rule. *Fix:* Explicit v1 rule per token shape: reject (FR-14), passthrough literal string `$value` only, or expand (and if expand, that is new scope — write FRs). Name composites/Color Module 4 in Deferred (addendum partially does; PRD MVP must still state the reject/passthrough rule).

- **[high]** FR-5–FR-8 “recognize / analyze / normalize” have no observable product outcome — untestable differentiation (FR-5–FR-8, Vision, reconcile G1) — Consequences only require fixtures be “detected/normalized” and “Conversion-eligible.” No required signal that a hierarchy model was identified; no confidence; no override; no analyze-only path. *Attack:* Ship a dumb flattener that emits CSS from any nested JSON; claim FR-5–FR-8 satisfied because fixtures convert. The brief’s taxonomy-fluency wedge evaporates into marketing language. *Fix:* Either (a) define testable recognition outputs (e.g. fixture matrix asserts expected model label in diagnostics / metadata returned by Main Entry), or (b) demote FR-5–FR-7 to implementation notes and stop claiming structure-awareness as a product FR — convert-only with named fixtures.

- **[high]** FR-8 unbounded “common structures” — silent scope creep (FR-8, Glossary Supported Format) — “Analyzes and normalizes common Token JSON structures enough to emit a Styles File” has no boundary. *Attack:* Every failed customer file becomes a “normalization bug,” not FR-14. Scope expands until the library is a general token ETL. *Fix:* Bound FR-8 to the allowlisted Supported Formats and fixture corpus. Anything outside → FR-14. Delete “common” as a weasel word.

- **[high]** Tokens Studio Vendor Dialect elevated without expression / math / multi-file reality (FR-17, §9 Security, addendum; reconcile G2/G6) — FR-17 requires “Tokens Studio–shaped” fixtures convert without preprocess. Real exports often include math expressions, metadata wrappers, and multi-file sets. Security NFR covers URL fetch only. *Attack:* Supporting “dialect” forces unsafe expression evaluation or silent drop of `$extensions` math; multi-file Studio projects fail as “unsupported” after marketing claimed Studio support. Prototype pollution / deep merge risks ignored. *Fix:* Define Tokens Studio v1 subset (which wrappers, which value forms). Explicitly reject or sandbox expressions. State multi-file Studio projects out of scope (already deferred) **in FR-17 notes** so “converts successfully” cannot be read as full Studio parity. Extend NFRs: no `eval`; identifier sanitization; path confinement if `$ref`/includes appear.

- **[high]** JTBD vs no Conversion CLI — self-inflicted workflow hole (§2.1, FR-16, §5, addendum C1) — Functional job: avoid one-off conversion scripts; keep conversion in the project’s integration path. Product deletes Conversion CLI and offers only Main Entry that loads Token Source and **writes disk**. *Attack:* CI/CD users write `node scripts/generate-tokens.js` — the exact one-off script class the JTBD rejects. Brief promised library + CLI for local/CI; override is documented but the JTBD was not rewritten to match. *Fix:* Rewrite JTBD to admit “thin project wrapper around Main Entry is expected in v1,” **or** restore a minimal Conversion CLI/bin as in-scope. Do not claim script avoidance while forcing scripts.

- **[high]** Disk-write-only success + relative path cwd undefined (FR-2, FR-3, FR-11, §8) — Success requires writing a Styles File; no in-memory CSS return. Default/custom paths are not anchored (cwd? package root? caller-specified `baseDir`?). *Attack:* Same call from different cwd writes different places; monorepos and Next/Vite layouts miss `assets/css/`; tests pollute disk; serverless/read-only FS cannot use the “library.” Partial write on crash leaves corrupt `tokens.css` with no failure class. *Fix:* Specify path resolution root in the capability contract; add FR for write failures (EACCES, ENOSPC) and atomic replace (write temp + rename). Decide whether Main Entry also returns CSS string/Buffer (even if disk write remains default) — if not, document Node+writable-FS as a hard runtime constraint in Target User / Non-Users.

- **[high]** SM-1 “100% of agreed fixture suite” is circular and “correct” is undefined (§7 SM-1) — Target is 100% of a suite that does not exist yet; “correct Styles File” = `:root` + `var(--…)` where applicable — no golden naming, ordering, or type formatting rules. *Attack:* Suite is negotiated downward until green; naming algorithm changes break consumers without failing SM-1 if fixtures are updated in lockstep. *Fix:* Freeze a versioned fixture corpus (inputs + golden CSS or snapshot policy) as a PRD appendix or linked artifact before calling SM-1 a launch gate. Define “correct” beyond vibes (naming determinism, alias emission rules, stable ordering or explicit non-guarantee).

- **[medium]** URL Token Source as first-class equal to local path without product security bar (§9, FR-1, reconcile G7) — Remote URL is in MVP; concrete policy “owned by architecture.” *Attack:* SSRF via user-controlled Token Source; redirect to metadata endpoints; unbounded download size; hang without timeout — all while FR-1 “parity” language pressures treating URL like local file. Launch risk for any host that passes through untrusted URLs. *Fix:* Product-level NFR minimums in PRD (https-only default, timeout, max bytes, redirect cap, no link-local/metadata ranges) — architecture details the mechanism, PRD states the bar. Clarify FR-1 “parity” = post-load Conversion parity only, not error-shape parity.

- **[medium]** Local Token Source as directory / glob — unspecified (FR-1, FR-12, §6.2) — Multi-file merge is out of scope; behavior when Token Source is a directory path is undefined. *Attack:* Users pass `./tokens`; library may throw opaque FS errors, attempt to parse a directory as JSON (FR-13), or silently pick one file. *Fix:* Explicit FR-12/FR-14 consequence: directory/glob Token Source is unsupported → clear failure with message pointing to single-file constraint.

- **[medium]** No performance / scale NFR while Vendor Dialects and “large” catalogs are in-scope (§7, §9, addendum Performance bullet; reconcile G3) — Addendum says “set concrete targets in architecture”; PRD has none. *Attack:* 10k-token Studio export hangs bootstrap; SM-2 15-minute onboarding uses toy fixtures; production fails the job. *Fix:* Add secondary metric or NFR (e.g. convert N-token fixture under T ms on reference hardware) owned as a launch bar, not a vague backlog note.

- **[medium]** Overwrite / existing `tokens.css` policy missing (FR-2, FR-11) — *Attack:* Clobber hand-edited CSS; or fail intermittently if file locked. No FR. *Fix:* Document overwrite-by-default (testable) or opt-in flag — product choice.

- **[medium]** DTCG version / `$description` / non-`$` mixed documents unspecified (FR-4; brief listed `$description`) — “Related DTCG conventions as used in the brief” is hand-wavy. *Attack:* Spec drift (Resolver 2025.10 deferred in addendum but FR-4 sounds like “DTCG”). `$description` ignore vs comment emission bikeshed. Mixed `$value` and `value` in one file — FR-18 vs FR-4 vs FR-14. *Fix:* Pin DTCG subset/version for v1; state `$description` ignored (or emitted as comments); state mixed-key documents: normalize if dialect rules apply, else FR-14.

- **[medium]** Hierarchy model collisions / mixed architectures (FR-5–FR-7, FR-17–FR-18) — A Tokens Studio file can also look 3-tier or CTI. Recognition order undefined. *Attack:* Two “Supported Formats” claim the same fixture; normalization differs; SM-1 flakes. *Fix:* Define precedence (e.g. Vendor Dialect detect → else hierarchy heuristics → else DTCG generic) and fixture expectations per path.

- **[medium]** SM-2 / SM-3 soft or unmeasurable (§7) — SM-2 assumes 15 minutes via “scripted onboarding checklist” that is not attached. SM-3 “without reading library source” has no method (survey? moderator?). *Attack:* Metrics never fail launch; docs rot. *Fix:* Attach checklist steps to SM-2; for SM-3 require task-based validation (pass/fail tasks on fixtures) or demote to qualitative non-gate.

- **[medium]** Semver vs architecture-owned naming algorithm (§8, §9 Predictability, Non-Goals no prefix) — Naming is fixed but unspecified; changes are breaking for CSS consumers. *Attack:* “Patch” renames `--color-primary` → `--primitive-color-primary`; apps break; eng argues not a public API. *Fix:* Declare emitted custom-property names part of the public contract for a given major version; any naming change = major bump. Point to naming algorithm doc as normative.

- **[medium]** Audience bait-and-switch vs brief (Target User §2; reconcile-brief) — Brief primary: DS engineers maintaining catalogs + secondary structural-read. PRD primary: app-under-construction developers; no secondary journey. *Attack:* Positioning still sells “taxonomy fluency” / DS practice while shipping app-bootstrap disk writer with no analyze path — disappointed DS-lead adopters. *Fix:* Align Vision/Target User with actual v1 job, or add the secondary journey and the FRs it needs.

- **[low]** Stale “Library/CLI product — light form” journey label (§2.3) — CLI conversion removed; label confuses. *Fix:* Delete CLI from UJ framing.

- **[low]** Glossary redefines “CLI” as install channel (§3) — Fighting ordinary language. *Attack:* Docs/stakeholders keep asking where `cssgen build` is. *Fix:* Say “package-manager install”; reserve “CLI” for Conversion CLI in Non-Goals only.

- **[low]** Counter-metrics SM-C1/C2 do not prevent Vendor Dialect scope inflation (§7) — They block emitters/platforms, not “one more dialect/parser.” *Fix:* Add counter-metric: do not grow Supported Format allowlist without PRD change + fixtures.

- **[low]** Reconcile docs claim addendum missing; addendum now exists — process debt (`reconcile-*.md`) — Stale reconcile status can mislead Finalize. *Fix:* Re-stamp reconciles or note supersession.

- **[low]** Single user journey only (UJ-1) — No journey for failed Conversion beyond one edge sentence; no DS-lead inspect journey. *Fix:* Add UJ for failure triage and/or explicitly non-goal the inspect job.

---

## What would make you withdraw objections

1. **Allowlist, not slogan:** Versioned Supported Format list + reject corpus; FR-14 tied to named fixtures; FR-8 bounded to that list.
2. **Alias semantics closed:** Graph validation language separated from `var(--…)` emission; dangling aliases and name collisions decided in-PRD with testable consequences (prefer fail-clear).
3. **Composite / expression / multi-file rules explicit** for DTCG + Tokens Studio subset — reject, passthrough, or expand — no silence.
4. **Recognition made falsifiable** (diagnostics/metadata assertions) **or** taxonomy claims removed from FRs/Vision until a later version.
5. **JTBD rewritten** to match Main Entry–only reality, **or** Conversion CLI restored; path/cwd/write-failure/atomic-write specified; URL security minimums in the PRD.
6. **SM-1 backed by a frozen golden fixture suite**; naming treated as semver-public; a scale NFR exists.

Until then: do not treat this PRD as implementation-ready. It is a scoped intent memo with aspirational FRs.
