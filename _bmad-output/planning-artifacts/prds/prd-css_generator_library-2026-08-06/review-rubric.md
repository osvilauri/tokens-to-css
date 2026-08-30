# PRD Quality Review — css_generator_library

## Overall verdict
This PRD is a coherent capability-focused product definition for a JSON-tokens → CSS Styles File library: the thesis is sharp, Non-Goals and counter-metrics honestly protect scope, and form-factor narrowing vs the brief is explicit. At **public launch** stakes, it is not yet a sufficient engineering contract — Supported Format / “clear failure” done-ness, DTCG/dialect boundaries, and URL-fetch security remain placeholders that epics will invent.

## Decision-readiness — adequate

Trade-offs are stated as decisions, not smoothed away. Vision and Non-Goals name what was given up (“not a full design system and not a multi-platform token orchestrator”; “Complement Style Dictionary when CSS-only is the job”). The addendum’s override table records brief/research → v1 choices with reasons (no Conversion CLI; Vendor Dialects elevated into v1; no configurable prefix; `:root` only). Open Questions (§11) are genuinely open — dangling aliases and CSS name collisions — and Q1 carries a real `[NOTE FOR PM]` recommendation rather than a rhetorical placeholder.

For public launch, decision-readiness is undercut where product risk is deferred without a stance. §9 Security says remote URL fetch “must follow a generic security NFR” and “Concrete policy is owned by architecture” — that dodges the product question (what is *unacceptable* for an installable package that fetches URLs). Two launch-relevant behaviors remain Open Questions. Capability contract for Main Entry is correctly PRD-owned, but packaging/publish surface for a public library (registry identity, license) is absent as a decision.

### Findings
- **high** URL-fetch security has no product stance (§9 Cross-Cutting NFRs) — Phrase “generic security NFR (timeouts, scheme/host constraints, no unsafe redirect abuse)” + “Concrete policy is owned by architecture” leaves SSRF/abuse policy undecided for a public package. *Fix:* Add a product-level constraint (e.g. file/URL schemes allowed, redirects refused or capped, timeouts required) and leave only mechanism detail to architecture.
- **medium** Dangling-alias policy still open at launch (§11 Open Questions #1) — Failure vs fallback affects FR-15 consistency and public API semantics. *Fix:* Close before epics with the recommended fail-clear default, or mark `[NON-GOAL for MVP]` + explicit deferred behavior.
- **medium** Custom-property name-collision policy still open (§11 Open Questions #2) — “Architecture default OK if documented” is weak for public semver surface (§8). *Fix:* Lock fail vs last-wins vs path-prefix as a v1 product rule in §4.3 / Non-Goals.
- **low** Public distribution decisions missing (§8 / §6) — Semver is stated; npm package name, license, and “public launch” publish bar are not. *Fix:* One short “Public package surface” bullet (name TBD OK; license + registry required).

## Substance over theater — strong

Content is earned. Vision is not swappable into any CSS tool — it pins “structure-aware enough to recognize common token architectures and Vendor Dialects, then emit predictable CSS — a focused last-mile helper.” Differentiation is scope discipline, not novelty theater. A single UJ (Alex) and intentionally open roles avoid persona furniture. JTBD are concrete (install → Main Entry → Styles File). NFRs are product-shaped (no silent empty Styles File; URL Token Source; naming predictability) rather than “scalable / secure / reliable” boilerplate. Counter-metrics SM-C1 / SM-C2 actively protect Non-Goals.

Residual soft spots are measurement language, not empty sections: SM-3 “integrate using published docs… without reading library source” and repeated “clear failure” without a definition of “clear.”

### Findings
- **medium** SM-3 is activity-shaped, not falsifiable (§7 Success Metrics) — “Docs sufficiency” has no method, sample, or pass bar (unlike SM-2’s scripted checklist). *Fix:* Tie SM-3 to the same onboarding checklist / external reviewer pass, or demote to qualitative note.
- **low** “Clear failure” recurs without product meaning (§4.4, SM-4) — Useful intent, furniture-adjacent until error shape is specified. *Fix:* See Done-ness finding on FR-12–FR-15.

## Strategic coherence — strong

The PRD bets on a single thesis: last-mile **Token JSON → Styles File** inside the developer toolchain, winning by taxonomy fluency and CSS-only scope — not platform breadth. Features §4.1–4.5 all serve that arc (load → recognize/normalize dialects → emit `:root` + `var(--…)` → fail loudly → installable package). MVP scope kind is problem-solving / capability, and In/Out (§6) matches. SM-1 (fixture pass rate) and SM-2 (time-to-first-CSS) validate the thesis; SM-C1 / SM-C2 are real counter-metrics against emitter sprawl and Style Dictionary parity creep. Elevating Vendor Dialects into v1 (vs research’s secondary shim) is an explicit product move, documented in the addendum — coherent, not backlog creep by stealth.

### Findings
*(none — dimension holds without additive findings.)*

## Done-ness clarity — thin

Most FRs have consequence bullets, defaults are concrete (`assets/css/`, `tokens.css`, `:root`, aliases as `var(--…)`), and four failure classes are enumerated — better than adjective-only PRDs. For public launch and story creation, that is not enough. Hierarchy and dialect FRs define “done” as “representative fixtures… Conversion-eligible / convert successfully” without stating what correct CSS looks like, how detection is judged, or which DTCG/dialect subset is in. FR-14’s “Recognizably unsupported Token JSON” is circular. “Clear error / clear failure” (FR-12–FR-15, SM-4) has no testable consequence (typed error? includes Token Source? distinguishes classes?). §9 Predictability defers the naming algorithm entirely while FR-9/10 depend on stable `--*` names. Local-path Token Source resolution base (cwd vs project root) is unspecified in FR-1. Downstream will invent acceptance criteria — the dimension stories lean on hardest.

### Findings
- **critical** Supported Format acceptance is fixture-shaped, not specified (§4.2 FR-5–FR-8, FR-17–FR-18; SM-1) — Phrases like “Representative 3-tier fixtures are detected/normalized and successfully Conversion-eligible” and “Tokens Studio–shaped… wrappers/metadata typical of that export” do not define correct emission or dialect bounds. *Fix:* Require a named v1 fixture suite (or acceptance matrix) per format: input → required CSS properties / alias shape; pin “Tokens Studio–shaped” and “SD-legacy” to documented examples.
- **high** DTCG support boundary unpinned (§4.2 FR-4; Glossary Supported Format) — “`$value`, `$type`, and related DTCG conventions as used in the brief” does not pin Format Module version or exclude composites / multi-file Resolver (addendum defers Resolver 2025.10, but PRD FR-4 does not say so). *Fix:* State v1 DTCG subset explicitly (e.g. single-file `$value`/`$type`/`$description` + `{alias}` only; no composites / no Resolver).
- **high** “Clear failure” is not testable (§4.4 FR-12–FR-15; SM-4) — Consequences only require “a clear failure to the caller” and “No successful empty Styles File write.” *Fix:* Add one shared consequence: failures throw/reject with distinguishable class (or code) for the four cases; success never writes empty Styles File; optional: message includes Token Source path/URL.
- **high** Unsupported-format gate is circular (§4.2 FR-14) — “If the Token JSON is not a Supported Format” / “Recognizably unsupported” needs a positive definition of Supported Format completeness. *Fix:* Define rejection triggers (e.g. non-object root; no recognizable token nodes after normalize) or defer FR-14 until fixture classifier exists and reference it.
- **medium** Local Token Source path semantics unspecified (§4.1 FR-1) — “valid local path” without resolution base breaks cross-environment tests. *Fix:* Specify path resolved relative to `process.cwd()` (or documented option) and absolute paths accepted.
- **medium** Naming predictability NFR has no bounds (§9; FR-9–FR-10) — “consistent with the recognized hierarchy” + “Exact naming algorithm is architecture-owned” leaves SM-1 “correct Styles File” underspecified. *Fix:* PRD-level rule (e.g. path segments → kebab `--a-b-c`; collisions per closed Open Q #2); algorithm detail may stay in architecture.

## Scope honesty — strong

Omissions do real work. §5 Non-Goals and per-feature Out of Scope callouts (mixins; Conversion CLI; SCSS/JS emitters; prefix; multi-theme) are explicit. §6.2 lists deferred capabilities (in-memory ingest, multi-file merge, taxonomy confidence report, theme selectors) a reader might otherwise assume from the brief. Form-factor note (§1) and addendum override table make the CLI descope honest, not silent. Assumptions are tagged inline and indexed (§12). Open Questions and `[NOTE FOR PM]` sit on real tensions. For public-launch green-light, open-item density is moderate (2 OQs + security/signature deferrals) — not a scope-honesty failure, but it reinforces Decision-readiness / Done-ness gaps above.

### Findings
- **low** Locked defaults listed as assumptions (§12 vs FR-3 / FR-11) — Index entries “Default output path `assets/css/tokens.css`…” and “Custom-property naming prefix is not user-configurable” are product decisions already in FRs/Non-Goals. *Fix:* Remove from Assumptions Index or rephrase as confirmed decisions; keep only unverified inferences tagged `[ASSUMPTION]`.

## Downstream usability — adequate

Chain-top consumers (architecture, epics/stories) can source-extract: Glossary anchors domain nouns; FRs nest under features with stable IDs; UJ-1 names protagonist Alex and carries context; SMs cite FR ranges; §8 separates capability contract from signature; addendum holds ANRE pipeline / fixtures / performance backlog. Vocabulary is mostly consistent (Token Source, Main Entry, Styles File, Conversion, Vendor Dialect).

Gaps for extraction: SM-1 depends on an “agreed fixture suite” that is not named or linked; FR-17/FR-18 are numerically after FR-16 but live under §4.2 (unique but non-contiguous by feature order — workable, slightly noisy); §12 Assumptions Index includes items not tagged `[ASSUMPTION]` inline (security/signature deferral; prefix decision). No separate Acceptance section — consequences substitute if tightened (see Done-ness).

### Findings
- **medium** Fixture suite is referenced but not identified (§7 SM-1; addendum Fixtures / TDD) — Architecture backlog mentions suite coverage; PRD Success Metric cannot be verified without a canonical list. *Fix:* Name or link `fixtures/` contract in PRD or addendum as the SM-1 source of truth.
- **low** Assumptions Index roundtrip incomplete (§12 vs body) — “URL fetch security details and Main Entry TypeScript signature live in architecture” and prefix non-configurability appear in the index without matching `[ASSUMPTION: …]` tags (signature deferral is prose in §8; prefix is a Non-Goal). *Fix:* Tag true assumptions inline; drop decisions/deferrals from the index or label them “Deferred to architecture.”

## Shape fit — strong

Shape matches the product: installable Node/TS library with a thin UJ form (“Library/CLI product — light form”) and a capability-spec FR core — appropriate for a single-operator developer tool, not a multi-stakeholder B2B UX PRD. Over-formalization is avoided (one journey, no persona farm). Under-formalization relative to public launch is mild (distribution/license), already noted under Decision-readiness. Brief’s library+CLI+API is consciously reshaped to Installable Package + Main Entry; research depth is parked in addendum rather than forcing architecture into the PRD narrative. Chain-top intent (§0) is stated and mostly honored.

### Findings
*(none beyond the public-package note under Decision-readiness.)*

## Mechanical notes

- **Glossary:** “CLI” is deliberately redefined as install channel only (§3) — correct for this PRD, but conflicts with brief/research usage; addendum documents the override. “Supported Format” includes Vendor Dialects; FR-14 depends on that union being crisp (see Done-ness).
- **ID continuity:** FR-1–FR-16 sequential by narrative; FR-17 / FR-18 appended under §4.2 (Supported Formats). IDs unique; no broken FR/UJ/SM cross-refs spotted. SM-C1 / SM-C2 counter-metric IDs are clear.
- **Assumptions Index roundtrip:** Inline tags at §1 (single Styles File), FR-16 Notes (CLI meaning), SM-2 (15 minutes), §10 (no hard SD/Terrazzo dependency). Index adds default path, security/signature deferral, and prefix — not all tagged or all true assumptions (see Downstream / Scope findings).
- **UJ protagonists:** UJ-1 — Alex (frontend engineer); edge case for unreachable/invalid Token Source present.
- **Required sections for stakes:** Vision, users/UJ, Glossary, FRs, Non-Goals, MVP, Success Metrics (+ counters), API surface, NFRs, Open Questions, Assumptions — present. Public-launch packaging/license thin. No dedicated Acceptance section; consequences intended to carry that load if strengthened.
