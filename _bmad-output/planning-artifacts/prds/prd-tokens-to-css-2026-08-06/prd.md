---
title: "PRD: tokens-to-css"
status: draft
created: 2026-08-06
updated: 2026-08-29
review_disposition: "C1A C2A C3A C4A H1B H2 H3 H4A H5 H6 applied (see §13)"
---

# PRD: tokens-to-css

## 0. Document Purpose

This PRD defines the product requirements for **tokens-to-css** for PM, architecture, and epic/story workflows. It builds on the product brief (`briefs/brief-tokens-to-css-2026-07-26`) and technical research (`research/technical-design-token-json-to-css-generation-research-2026-07-26`). Vocabulary is Glossary-anchored; features group nested FRs with stable IDs; assumptions are tagged inline and indexed. Implementation mechanism detail belongs in architecture / addendum, not here.

**Review status:** rubric + adversarial reviews (2026-08-07) are dispositioned in §13. Critical and high findings are closed in this revision; residual items are Open Questions with named owners.

## 1. Vision

**tokens-to-css** is an installable Node/TypeScript library (via package manager) meant to integrate into any app or website under construction. Developers call the Main Entry with a Token Source to convert design-token JSON into a Styles File ready for the project to consume.

It is not a full design system and not a multi-platform token orchestrator. It is the **JSON tokens → CSS styles file** bridge inside the developer’s toolchain: it accepts the token shapes teams actually have — DTCG plus the Vendor Dialects listed in the **Format Allowlist (V1)** (§4.2.0) — and emits predictable CSS. A focused last-mile helper, not a multi-platform transform stack.

Differentiation is scope discipline and breadth of *accepted input shapes* (complement Style Dictionary when CSS-only is the job), not platform breadth. V1 claims **conversion coverage over an allowlist**, not taxonomy diagnostics: the library does not report which hierarchy model it recognized, and structure-awareness is an implementation means, not a user-facing V1 capability (see §13 / H1). [ASSUMPTION: V1 primary outcome is a single CSS styles file (typically custom properties); multi-file theme/layer splits are not required for V1 unless later confirmed.]

**Form-factor note:** The product brief described library + CLI + API. v1 intentionally narrows to an **Installable Package + Main Entry API** (no Conversion CLI); see Non-Goals and `addendum.md`.

## 2. Target User

Primary audience is **web developers** integrating token-to-CSS into an app or site under construction. Roles are intentionally open in v1: product frontend engineers, design-system engineers, and freelancers/contractors who inherit a token JSON.

### 2.1 Jobs To Be Done

- **Functional:** From app/bootstrap code (or a thin project-owned wrapper), call the Main Entry, pass a Token Source (URL or local path) for the Token JSON, and obtain a Styles File the app can consume.
- **Contextual:** Replace *bespoke conversion logic* — hand-rolled parsers, normalizers and CSS emitters — with a library call. A thin project wrapper (a few lines invoking the Main Entry from a build step, npm script, or bootstrap file) is **expected and in-scope for v1**; what the product removes is the need to write and maintain the conversion itself, not the need for an invocation site. A Conversion CLI that removes the wrapper is deferred (§5, `addendum.md`).
- **Social / professional:** Ship a predictable CSS styles artifact teammates (and the app) can rely on without learning a full multi-platform token pipeline.

### 2.2 Non-Users (v1)

- Native **iOS / Android** token pipelines (non-CSS targets).
- **Figma-only designers** who do not work in code or a developer-owned JSON→CSS integration.
- **Read-only / non-Node runtimes.** V1 requires Node.js and a writable filesystem: the Main Entry’s success path writes the Styles File to disk and returns no in-memory CSS (§5, §8). Browser, edge, and read-only-FS serverless targets are out of v1.

### 2.3 Key User Journeys

*Library product — light form. (Conversion CLI is out of v1; the earlier “Library/CLI” framing is retired.)*

- **UJ-1. Alex wires token JSON into the web app’s styles.** Alex, a frontend engineer starting a web app with an existing design-token JSON (remote URL or local path), installs the library, calls the Main Entry from app core or a thin wrapper with a Token Source, and gets a Styles File the app consumes. Value lands when the UI can use the generated custom properties without a hand-written converter.
  **Edge cases (all must fail clearly, never as a silent or partial success):** Token Source unreachable/missing (FR-12); invalid JSON (FR-13); input outside the Format Allowlist (FR-14); alias cycle (FR-15); dangling alias (FR-22); custom-property name collision (FR-21); composite / non-scalar token (FR-20); Styles File write failure (FR-19).

## 3. Glossary

- **Token JSON** — A JSON document of design tokens used as Conversion input.
- **Token Source** — Locator passed to the Main Entry to load the Token JSON. Accepts a remote **URL** or a **local file path** (single file only; directories and globs are unsupported — FR-1).
- **Main Entry** — The library’s primary function the app calls to run Conversion.
- **Styles File** — The CSS output file the app consumes (generated custom properties / styles).
- **Conversion** — The process of turning Token JSON into a Styles File.
- **Format Allowlist (V1)** — The closed, versioned list of Token JSON shapes v1 accepts, defined in §4.2.0. Anything outside it is rejected (FR-14). Growing the allowlist requires a PRD change plus fixtures (SM-C3).
- **Supported Format** — A Token JSON shape on the Format Allowlist (V1). The term is now defined by that list, not by intent.
- **Vendor Dialect** — A Token JSON shape marked by the exporting tool (Tokens Studio wrappers; Style Dictionary legacy `value`/`type` without `$`) rather than pure DTCG. Allowlisted subsets are defined in FR-17 / FR-18.
- **Fixture Corpus** — The versioned set of *accept* fixtures (input Token JSON + golden Styles File) and *reject* fixtures (input + expected failure class) that operationally defines the Format Allowlist and is the source of truth for SM-1.
- **Alias Graph Validation** — Walking `{alias}` / reference edges to verify the graph is sound: every reference target exists (dangling → FR-22) and no cycle exists (FR-15). It **never** means computing or inlining literal values.
- **Reference Emission** — Emitting a token whose value is a reference as `var(--target)` in the Styles File (FR-10). V1 emission is reference-preserving; value-inlining (flattening) is not a v1 behavior.
- **Composite Token** — A token whose `$value` is a non-scalar structure (DTCG typography, shadow, border, gradient, transition, stroke-style; object-form colors). Rejected in v1 (FR-20).
- **Dangling Alias** — A reference whose target token does not exist in the Token JSON.
- **Name Collision** — Two or more tokens that would emit the same `--custom-property` name.
- **Installable Package** — The distributable library artifact installable via the project’s package manager (e.g. npm/pnpm/yarn). Installing via `npm i …` is a *package-manager install*, not a “CLI” — in this document **CLI** means only a Conversion CLI, which is a Non-Goal (§5).

## 4. Features

*Feature list locked for v1. FRs carry stable IDs; retired IDs are never reused.*

### 4.1 Token Source Loading
**Description:** The developer passes a Token Source into the Main Entry; the library loads the Token JSON from a remote URL or a single local file path with the same post-load Conversion behavior. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Load Token JSON from Token Source

The developer can pass a Token Source (remote URL or single local file path) to the Main Entry. Realizes UJ-1.

**Consequences (testable):**
- Given a valid remote URL Token Source, the library reads the Token JSON and proceeds to Conversion.
- Given a valid local file path Token Source, the library reads the Token JSON and proceeds to Conversion.
- **Parity is post-load only:** once the Token JSON is loaded, Conversion behaves identically for URL and local path. Load-time failures and error shapes are *not* required to be identical (a URL timeout and a missing file are distinguishable failures — FR-12).
- **Path resolution:** absolute local paths are used as given; relative local paths resolve against `process.cwd()` unless the caller supplies an explicit base directory option. The same relative Token Source from two different working directories is expected to resolve differently, and that behavior is documented.
- **Directory / glob Token Source is unsupported:** a Token Source that resolves to a directory, or contains glob syntax, fails clearly under FR-14 with a message naming the single-file constraint. It must not be parsed as JSON, and must not silently pick a file.

#### FR-2: Write Styles File to disk

The Main Entry writes the Styles File to disk as part of a successful Conversion. Realizes UJ-1.

**Consequences (testable):**
- On successful Conversion, a Styles File exists at the configured output location on disk.
- The Main Entry does not complete successfully without writing the Styles File when Conversion succeeds.
- **Atomic replace:** the Styles File is written to a temporary file in the target directory and renamed into place, so an interrupted or failed write never leaves a truncated or partially-written Styles File at the target path.
- **Overwrite by default:** an existing file at the target path is replaced. V1 exposes no “fail if exists” flag; the caller owns not pointing the output at hand-edited CSS. [ASSUMPTION: overwrite-by-default matches the build-step usage pattern; revisit if users report clobbering.]

#### FR-3: Default and custom output path

The developer can rely on a default Styles File output directory of `assets/css/`, or supply a custom output path. Realizes UJ-1.

**Consequences (testable):**
- When no custom output path is provided, the Styles File is written under `assets/css/`.
- When a custom output path is provided, the Styles File is written to that path instead of the default.
- Relative output paths resolve on the same base as FR-1 (`process.cwd()` unless a base directory option is supplied); absolute output paths are used as given.
- If the output directory does not exist, the Main Entry creates it (including default `assets/css/`) before writing the Styles File.

**Notes:** Exact default filename inside `assets/css/` is `tokens.css` (see FR-11).

### 4.2 Supported Formats
**Description:** Conversion accepts exactly the Token JSON shapes on the **Format Allowlist (V1)** below, normalizes them, validates the alias graph, and emits CSS. Everything else is rejected (FR-14). Realizes UJ-1.

#### 4.2.0 Format Allowlist (V1)

Conversion accepts a Token JSON document that, after dialect normalization, is a **single-file, nested-object tree of scalar tokens**, in one of these shapes:

| # | Allowlisted shape | Marker | FR |
| --- | --- | --- | --- |
| A1 | **DTCG single-file** — `$value`, `$type`, `$description`, `{path.to.token}` aliases | `$value` keys | FR-4 |
| A2 | **Style Dictionary legacy** — `value` / `type` without `$`, `{path.to.token}` aliases | `value` keys, no `$value` | FR-18 |
| A3 | **Tokens Studio export (subset)** — A1 or A2 nodes inside Tokens Studio group wrappers | `$themes` / `$metadata` / set wrappers | FR-17 |

Token *hierarchy* (3-tier primitive→semantic→component, CTI, EightShapes-like namespace→object→base→modifier, or any other nesting depth) is **not a separate allowlist axis**: any nesting depth is accepted and flattened by the naming rule in FR-9. Hierarchy models are documented in the Fixture Corpus as coverage, not as distinct FRs (see §13 / H1).

**Detection precedence** (first match wins, deterministic): (1) Tokens Studio wrappers → A3; (2) any `$value` present → A1; (3) any `value` present → A2; (4) no recognizable token node → reject (FR-14). A document mixing `$value` and `value` keys is normalized under the first precedence match; keys of the other dialect at token level are a reject (FR-14), not a silent drop.

**Rejection triggers (FR-14), positively defined:** non-object JSON root; no node containing a recognizable token value key after normalization; directory/glob Token Source; composite or non-scalar `$value` (FR-20); Tokens Studio math/expression values (FR-17); DTCG Resolver / multi-file constructs (`$ref`, resolver manifests); mixed-dialect token nodes.

**Fixture Corpus contract:** every allowlisted shape has at least one *accept* fixture (input + golden Styles File) and every rejection trigger has at least one *reject* fixture (input + expected failure class). The corpus is versioned with the package and is the operational definition of this allowlist. Freezing its initial contents is an architecture deliverable with a named owner (OQ-1); SM-1 gates on it.

**Functional Requirements:**

#### FR-4: Parse DTCG single-file Token JSON (A1)

The developer can convert DTCG Token JSON restricted to the v1 subset. Realizes UJ-1.

**V1 DTCG subset:** single-file documents using `$value`, `$type`, `$description`, group nesting, and `{path.to.token}` aliases. `$description` is parsed and **ignored** (not emitted as CSS comments in v1). Out of subset → FR-14 or FR-20: composites and object-form colors (FR-20); DTCG Resolver / multi-file manifests (deferred, `addendum.md`); `$extensions` content beyond being ignored.

**Consequences (testable):**
- Valid DTCG-subset Token JSON is accepted as Conversion input.
- `{path.to.token}` alias chains pass **Alias Graph Validation** (no cycle — FR-15; no dangling target — FR-22) and are emitted as references (FR-10), not inlined literals.
- `$description` present on a token does not change the emitted CSS.
- A DTCG document containing a composite `$value` is rejected per FR-20, not partially converted.

#### FR-5 / FR-6 / FR-7 — retired (2026-08-27)

**These IDs are retired and must not be reused.** They previously required the library to “recognize” 3-tier, CTI, and EightShapes-like hierarchies. Review finding H1 established that recognition had no observable product outcome — the FRs were satisfiable by any flattener, so they measured nothing. Disposition **H1B**: hierarchy support is now an **implementation note plus Fixture Corpus coverage**, not a product FR. Those hierarchies must convert correctly (they are accept fixtures under FR-8/SM-1); the library makes no user-facing claim about identifying which model it saw. Taxonomy diagnostics / model override remain deferred (`addendum.md`).

#### FR-8: Normalize allowlisted Token JSON shapes

The library normalizes the shapes on the Format Allowlist (V1) — and only those — into the internal token tree used for emission. Realizes UJ-1.

**Consequences (testable):**
- Every *accept* fixture in the Fixture Corpus converts to its golden Styles File without the developer hand-normalizing hierarchy, dialect, or nesting depth first.
- Nesting depth is not bounded by hierarchy model: 3-tier, CTI, and EightShapes-like accept fixtures each convert.
- Input outside the Format Allowlist is **not** a normalization gap: it is an FR-14 rejection. Extending normalization to a new shape requires a PRD change plus new fixtures (SM-C3), so a failing customer file is never triaged as a normalization bug by default.

#### FR-17: Normalize Tokens Studio Vendor Dialect (A3 subset)

The library accepts the v1 subset of Tokens Studio–shaped Token JSON and normalizes it for Conversion. Realizes UJ-1.

**V1 Tokens Studio subset — in:** token set / group wrappers around A1 or A2 token nodes; `$themes` and `$metadata` top-level keys (parsed and ignored for emission); scalar `value` / `$value` tokens; `{alias}` references within the same document.
**V1 Tokens Studio subset — out (reject, FR-14):** math or expression values (`{spacing.md} * 2`, `roundTo(...)`, arithmetic strings) — v1 performs **no expression evaluation of any kind**; multi-file / multi-set projects requiring merge across documents; `$extensions` payloads used to carry semantics.

**Consequences (testable):**
- Representative Tokens Studio accept fixtures convert successfully without a separate user preprocess step.
- A Tokens Studio fixture containing a math/expression value is rejected with a clear failure naming expressions as unsupported — it is neither evaluated nor silently dropped.
- `$themes` / `$metadata` presence does not change the emitted custom properties.
- **Not Studio parity:** “converts successfully” means the subset above. Multi-file Studio projects are out of v1 (`addendum.md`) and docs must not claim general Tokens Studio support.

#### FR-18: Normalize Style Dictionary legacy Vendor Dialect (A2)

The library accepts legacy Style Dictionary Token JSON using `value`/`type` (without `$`) and normalizes it for Conversion. Realizes UJ-1.

**Consequences (testable):**
- Representative SD-legacy accept fixtures convert successfully without requiring the user to rewrite tokens to `$value`/`$type` first.
- SD-legacy `{path.to.token}` aliases are validated and emitted as references identically to A1 (post-normalization parity).
- A token node carrying both `value` and `$value` is rejected per the mixed-dialect trigger (FR-14).

#### FR-20: Reject composite and non-scalar tokens

If any token’s value is a composite or otherwise non-scalar structure, Conversion fails clearly. Realizes UJ-1.

**Rationale (C4A):** v1 emits one custom property per token from a scalar value. Composite expansion is new scope, and stringifying an object produces broken CSS.

**Consequences (testable):**
- A token whose value is an object or array (DTCG typography, shadow, border, gradient, transition, stroke-style; object-form / Color Module 4 colors) produces a clear failure identifying the offending token path and its type.
- No `--token: [object Object]`-style output, and no silent drop of the offending token, is ever produced on a success path.
- Reject fixtures for at least the typography, shadow, and object-color cases exist in the Fixture Corpus.

**Out of Scope:** Composite expansion into multiple custom properties; passthrough of raw composite `$value` as an opaque string; mixins derived from Token JSON (explicit v1 non-goal).

### 4.3 Conversion to Styles File
**Description:** The library performs Conversion and writes a Styles File containing CSS custom properties under `:root`, preserving references as `var(--…)`. Default output directory `assets/css/`; default filename `tokens.css` unless a custom path/name is supplied. Realizes UJ-1.

**Functional Requirements:**

#### FR-9: Emit CSS custom properties in `:root`

On successful Conversion, the Styles File declares token values as CSS custom properties inside a `:root` rule. Realizes UJ-1.

**Naming rule (product-level, normative):** the custom-property name is the token’s path segments from the document root, lowercased, non-alphanumeric runs collapsed to a single `-`, joined with `-`, prefixed with `--` (`color.brand.primary` → `--color-brand-primary`). Dialect wrapper keys that are ignored for emission (Tokens Studio set/`$themes`/`$metadata` wrappers) are not path segments. No configurable prefix in v1 (§5). Declaration order follows document order (stable and deterministic across runs for identical input). Detailed algorithm edge cases (unicode, leading digits) are architecture-owned but must remain deterministic and documented.

**Public contract:** emitted custom-property names are part of the library’s public API surface for a given major version. Any change to the naming rule is a **breaking change requiring a major version bump** (§8).

**Consequences (testable):**
- The Styles File contains a `:root { … }` block with `--*` custom properties derived from the Token JSON, named per the rule above.
- Converting the same accept fixture twice produces byte-identical output.
- The Styles File is consumable by linking/importing it so the app can use `var(--…)` in its styles.

#### FR-10: Emit references as `var(--…)` (Reference Emission)

When a token’s value references another token, the Styles File emits that reference as `var(--target)` rather than inlining the target’s literal value. Realizes UJ-1.

**Vocabulary (C2A):** **Alias Graph Validation** (FR-4, FR-15, FR-22) checks that the reference graph is sound. **Reference Emission** (this FR) decides what is written. Validation never implies flattening; “resolve” in this PRD always means *validate the graph*, never *inline the value*.

**Consequences (testable):**
- For a known alias chain in fixtures (e.g. semantic → primitive), the emitted semantic custom property value is `var(--primitive-name)`, matching the golden Styles File.
- Value-inlining of alias targets does not occur in v1, under any input on the allowlist — there is no option that enables it.
- A multi-hop chain (component → semantic → primitive) emits one `var(--…)` hop per token, not a collapsed literal.

#### FR-11: Default Styles File name `tokens.css`

When the developer does not supply a custom output file name, the Styles File is written as `tokens.css` under the output directory (default `assets/css/`, or the custom directory from FR-3). Realizes UJ-1.

**Consequences (testable):**
- Default successful Conversion writes `assets/css/tokens.css` when no custom path/name is provided.
- A developer-supplied custom output path/name overrides this default.

#### FR-21: Fail clearly on custom-property name collision

If two or more tokens would emit the same `--custom-property` name, Conversion fails clearly. Realizes UJ-1.

**Rationale (C3A):** last-wins silently drops a token and ships a broken theme that reports success. Fail-clear is consistent with FR-12–FR-15 and with the Reliability NFR.

**Consequences (testable):**
- A fixture where two distinct token paths normalize to the same custom-property name produces a clear failure listing the colliding token paths and the shared name.
- No Styles File is written for a colliding input (per the shared failure consequence in §4.4).
- Collision detection covers collisions introduced by the naming rule’s character normalization, not only by literally identical paths.

**Out of Scope:** Mixins derived from Token JSON; first-class SCSS/JS emitters; multi-theme selector output beyond `:root`; configurable custom-property naming prefix in v1; last-wins or auto-prefix collision recovery.

### 4.4 Clear Failure Reporting
**Description:** When Conversion cannot complete, the library surfaces a clear, distinguishable failure and never leaves a silent empty, partial, or stale-looking Styles File as a success. Realizes UJ-1 edge cases.

**Shared consequences — apply to FR-12 through FR-15 and FR-19 through FR-22 (testable):**
- The Main Entry signals failure to the caller by throwing/rejecting with an error carrying a **stable, machine-distinguishable failure code** (one per failure class below), so a caller can branch on the class without string-matching prose.
- The error message names the Token Source (path or URL) and, where the failure is token-scoped (FR-15, FR-20, FR-21, FR-22), the offending token path(s).
- **No Styles File is written on any failure.** No empty file, no partial file, no truncated overwrite of a previously valid Styles File (FR-2 atomic replace).
- Every failure class has at least one reject fixture in the Fixture Corpus (SM-4).

#### FR-12: Fail clearly on missing or unreachable Token Source

If the Token Source (URL or local path) cannot be read, Conversion fails with a clear error.

**Consequences (testable):**
- Missing local path, permission-denied local path, and unreachable / non-2xx / timed-out URL each produce a clear failure to the caller.
- Load-time failure classes are distinguishable from each other and from FR-13 (a network failure is not reported as invalid JSON).

#### FR-13: Fail clearly on invalid JSON

If the Token Source content is not valid JSON, Conversion fails with a clear error.

**Consequences (testable):**
- Malformed JSON produces a clear failure to the caller, including parse position where the parser provides it.

#### FR-14: Fail clearly on input outside the Format Allowlist

If the Token JSON is not on the Format Allowlist (V1), Conversion fails with a clear error.

**Consequences (testable):**
- Each rejection trigger listed in §4.2.0 has a named reject fixture that produces a clear failure to the caller: non-object root; no recognizable token node; directory/glob Token Source; DTCG Resolver / multi-file constructs; mixed-dialect token nodes; Tokens Studio expressions (FR-17).
- The failure message states which allowlisted shapes are supported, so the developer can act without reading library source.
- FR-14 is decided against the allowlist, never against a heuristic judgment of “recognizably unsupported.”

#### FR-15: Fail clearly on alias cycles

If Alias Graph Validation detects a cycle, Conversion fails with a clear error.

**Consequences (testable):**
- Fixtures with cyclic `{alias}` chains produce a clear failure naming the tokens in the cycle.
- Cyclic aliases are never silently dropped or emitted as broken CSS on a success path.

#### FR-19: Fail clearly on Styles File write failure

If the Styles File cannot be written, Conversion fails with a clear error.

**Consequences (testable):**
- Unwritable output directory (EACCES), out-of-space (ENOSPC), and failure to create a missing output directory each produce a clear, distinguishable failure to the caller.
- A failed write leaves no temporary file behind and leaves any pre-existing Styles File at the target path untouched (FR-2 atomic replace).

#### FR-22: Fail clearly on dangling aliases

If Alias Graph Validation finds a reference whose target token does not exist, Conversion fails with a clear error.

**Rationale (C3A):** emitting `var(--missing)` would satisfy CSS syntax and ship a broken theme under a success result — the exact silent failure the Reliability NFR forbids.

**Consequences (testable):**
- A fixture referencing a non-existent token produces a clear failure naming the referring token path and the missing target.
- No Styles File containing an unresolvable `var(--…)` reference is written on a success path.
- Dangling-alias failures are distinguishable from cycle failures (FR-15).

### 4.5 Installable Package
**Description:** Developers can install the library into any Node project via the package manager so the Main Entry is available from application code. v1 does not ship a Conversion CLI. Realizes UJ-1.

**Functional Requirements:**

#### FR-16: Install via package manager

The developer can install the library as a package dependency in their project.

**Consequences (testable):**
- After install, the project can import/call the Main Entry from application code (or a thin project wrapper — §2.1).
- Installation does not require a separate Figma plugin or product UI.
- The published package carries TypeScript types for the Main Entry and its options.

**Out of Scope:** A CLI command that performs Conversion (Token Source → Styles File). Conversion is Main Entry–only in v1.
**Notes:** [ASSUMPTION: “CLI” in earlier brainstorming meant installable via package-manager (`npm i …`), not a `cssgen build` style binary.]

## 5. Non-Goals (Explicit)

- Mixins derived from Token JSON.
- A Conversion CLI (`build`/`convert` binary); Conversion is Main Entry–only.
- Native iOS / Android (or other non-CSS) emitters.
- Figma plugin or multi-brand runtime theme-switching UI.
- First-class SCSS and JS/TS dual emitters (CSS Styles File only).
- Replacing Style Dictionary as a full multi-platform token orchestrator.
- Configurable custom-property naming prefix in v1 (naming is fixed by the rule in FR-9).
- **Composite / non-scalar token support** — rejected, not expanded and not passed through (FR-20).
- **Expression or math evaluation** of any kind, including Tokens Studio expressions (FR-17). No `eval`, no expression parser in v1.
- **In-memory CSS return** — the Main Entry writes to disk and does not return the CSS string/Buffer in v1; Node + writable filesystem is a hard runtime constraint (§2.2, §8).
- **Taxonomy diagnostics** — the library does not report the recognized hierarchy model, confidence, or allow model override in v1 (§13 / H1).

## 6. MVP Scope

### 6.1 In Scope

- Installable Package + Main Entry API (Node/TypeScript, typed).
- Token Source as URL or single local file path (post-load parity; documented path resolution).
- Format Allowlist (V1): DTCG single-file subset; Style Dictionary legacy `value`/`type`; Tokens Studio subset — with deterministic detection precedence and a versioned accept/reject Fixture Corpus. Hierarchy models (3-tier, CTI, EightShapes-like) covered as fixtures, at any nesting depth.
- Alias Graph Validation (cycles, dangling) + Reference Emission as `var(--…)`.
- Write Styles File to disk atomically, overwrite by default; create output directory if missing; default `assets/css/tokens.css`; optional custom output path.
- `:root` CSS custom properties with the normative naming rule; deterministic, byte-identical output for identical input; no configurable prefix.
- Clear, code-distinguishable failures for: unreachable/missing Token Source, invalid JSON, off-allowlist input, alias cycles, composites, name collisions, dangling aliases, write failures.

### 6.2 Out of Scope for MVP

- Mixins from Token JSON — deferred beyond v1 by product decision.
- Conversion CLI — install-only package channel in v1 (intentional override of brief’s CLI/CI generator); a thin project wrapper is the expected invocation site.
- In-memory Token JSON ingest; in-memory CSS return; multi-file/directory/glob merge Token Sources — single URL or local file only.
- Composites / Color Module 4 object colors; Tokens Studio expressions and multi-file sets; DTCG Resolver 2025.10.
- Taxonomy confidence report / model override as a product feature — normalization is internal only.
- Theme selectors, multi-file CSS splits, Tailwind `@theme` — single `:root` Styles File.
- Figma plugin / theme UI — not a code-side generator concern.
- SCSS/JS emitters — CSS-first.
- iOS/Android / full Style Dictionary parity — web/CSS only.
- Configurable custom-property naming prefix.

## 7. Success Metrics

**Primary**

- **SM-1**: Fixture Corpus pass rate — every *accept* fixture converts to its **golden Styles File byte-for-byte**, and every *reject* fixture fails with its **expected failure code**. Target: **100%** of the frozen Fixture Corpus (version pinned in the repo; freeze owned per OQ-1). “Correct” is defined by the golden files — naming per FR-9, references per FR-10, document-order declarations — not by reviewer judgment. Golden files may only change together with a documented naming/emission change, which is a major-version event (§8). Validates FR-4, FR-8–FR-11, FR-17, FR-18.
- **SM-2**: Time-to-first-CSS — a new developer completes the **scripted onboarding checklist** in under **15 minutes** following published docs. Checklist steps (timed, pass/fail each): (1) install the package into a fresh Node project; (2) point the Main Entry at the sample Token Source shipped in docs; (3) run it from a thin wrapper; (4) verify `assets/css/tokens.css` exists and contains expected custom properties; (5) trigger one failure case from the docs (e.g. missing Token Source) and read the error. [ASSUMPTION: 15-minute target.] Validates FR-1–FR-3, FR-12, FR-16.

**Secondary**

- **SM-3**: Docs sufficiency — an external frontend/design-system engineer completes SM-2’s checklist **plus** two task-based exercises (convert an SD-legacy fixture; interpret one rejection message) using published docs and fixtures only, without reading library source. Pass = both tasks completed unaided. Not a launch gate; a docs-quality signal.
- **SM-4**: Failure-class coverage — each v1 failure class (FR-12–FR-15, FR-19–FR-22) has a reject fixture and a documented example producing a clear, code-distinguishable failure. Target: 100% of classes.
- **SM-5**: Conversion throughput — a 10k-token accept fixture converts in under **2 seconds** on reference developer hardware (documented in the corpus README). [ASSUMPTION: 2s / 10k-token bar derived from the research’s large-catalog figure; PM to confirm or architecture to revise with measurements — OQ-2.]

**Counter-metrics (do not optimize)**

- **SM-C1**: Emitter / platform surface area — do not optimize for number of output languages (SCSS/JS) or native platforms.
- **SM-C2**: Style Dictionary feature parity — do not optimize toward replacing or matching full multi-platform Style Dictionary capability.
- **SM-C3**: Format Allowlist growth — do not grow the allowlist (new dialects, new token shapes, expression support) without a PRD revision plus accept/reject fixtures landed in the same change. A failing customer file is an FR-14 rejection until that happens, not a bug.

## 8. API Contracts / Public Surface

- **Runtime target (v1):** Node.js with TypeScript. Browser, edge, and read-only-filesystem runtimes are out of v1 (hard constraint — the success path writes to disk).
- **Public Main Entry (capability contract):** accepts a Token Source and optional options (custom output path; base directory for relative resolution); on success writes the Styles File to disk and returns no CSS payload. Exact function signature and option names are deferred to architecture; this PRD owns the capability contract.
- **Error contract:** failures throw/reject with a stable, machine-distinguishable failure code per class (§4.4). Codes are part of the public surface; renaming or merging a code is a breaking change.
- **Emitted names are public:** custom-property names produced by the FR-9 naming rule are part of the public contract for a given major version; any naming change requires a major bump. The naming rule documentation is normative.
- **Install surface:** Installable Package via package manager; no Conversion CLI in v1; TypeScript types published with the package.
- **Public package surface:** published to the public npm registry as **`tokens-to-css`** under the **MIT** license. Confirmed 2026-08-29 (OQ-3 closed); npm availability verified at that date, and the name is unreserved until first publish.
- **Breaking-change policy:** Semantic Versioning. No breaking changes in minor or patch releases. Breaking includes: naming-rule changes, failure-code changes, allowlist removals, and default output path/filename changes.

## 9. Cross-Cutting NFRs

- **Reliability:** Conversion either writes a correct Styles File or fails clearly with a distinguishable code (§4.4). No silent empty success, no partial file, no unresolvable `var(--…)` on a success path.
- **Atomicity:** Styles File writes are atomic (temp file + rename); a crashed or failed run never corrupts an existing Styles File.
- **Security — remote Token Source (product minimums; mechanism owned by architecture):**
  - `https:` only by default; `http:` requires explicit opt-in by the caller.
  - Request timeout required (connect + total); no unbounded hang.
  - Maximum response size enforced; oversized responses fail under FR-12.
  - Redirects capped (small limit) and re-validated against the scheme/host rules; redirect to a disallowed target fails.
  - Link-local and cloud-metadata address ranges (e.g. `169.254.0.0/16`, `::1`-scoped metadata endpoints) are refused, including post-redirect, to limit SSRF exposure when a host passes through a user-supplied Token Source.
- **Security — parsing:** no `eval` and no expression evaluation on token values (FR-17); custom-property identifiers sanitized before emission; no prototype-polluting key assignment during normalization (`__proto__`, `constructor`, `prototype` keys are rejected or safely ignored); no filesystem traversal outside the resolved output path.
- **Predictability:** emitted custom-property names follow the FR-9 naming rule; identical input yields byte-identical output; declaration order is document order.
- **Performance:** see SM-5.
- **Documentation:** public docs + Fixture Corpus sufficient for SM-3, including the allowlist, the failure codes, and the naming rule.

## 10. Language / Runtime Targets and Dependency Policy

- **Language:** TypeScript.
- **Runtime:** Node.js only in v1.
- **Dependencies:** prefer a small dependency surface; no hard requirement to depend on Style Dictionary or Terrazzo for MVP. [ASSUMPTION: complementary to those tools, not built on them as a hard dependency.]

## 11. Open Questions

Closed in this revision (2026-08-27): dangling-alias policy → fail-clear (FR-22); name-collision policy → fail-clear (FR-21); composite policy → reject (FR-20); URL security bar → product minimums in §9.

1. **OQ-1 — Fixture Corpus freeze.** Initial contents, directory layout, and golden-file update protocol for the accept/reject corpus. **Owner: architecture** (`bmad-architecture`), due before epics; SM-1 cannot gate until frozen. PRD owns the corpus *contract* (§4.2.0); architecture owns the artifact.
2. **OQ-2 — SM-5 performance bar.** Confirm 2s / 10k tokens, or replace with a measured bar. **Owner: architecture**, with PM sign-off on the launch bar.
3. ~~**OQ-3 — Package identity.**~~ **Closed 2026-08-29:** package name `tokens-to-css`, license MIT. `token-css`, `css-tokens` and the Token CSS project's `@tokencss/*` scope were ruled out for collision; `dtcg-css` was rejected because naming the package after one accepted format understates an allowlist that also carries vendor dialects. The GitHub repository was renamed to match.

## 12. Assumptions Index

*Only unverified inferences appear here; product decisions live in the FRs and Non-Goals.*

- V1 primary outcome is a single Styles File; multi-file theme/layer splits not required unless later confirmed (§1).
- “CLI” in early brainstorming meant package-manager install, not a Conversion CLI (FR-16).
- SM-2 target of 15 minutes is an assumed launch bar (§7).
- SM-5 bar of 2s per 10k tokens is assumed pending measurement (§7, OQ-2).
- Overwrite-by-default matches the build-step usage pattern (FR-2).
- Interop with Style Dictionary is desirable positioning, not an MVP hard dependency (§10).

*Deferred to architecture (decisions, not assumptions):* Main Entry TypeScript signature and option names; URL-fetch mechanism implementing §9 minimums; naming-rule edge cases (unicode, leading digits); Fixture Corpus artifact (OQ-1).

## 13. Review Disposition (2026-08-07 reviews → 2026-08-27)

Reviews: `review-rubric.md`, `review-adversarial-general.md`. PM disposition: recommended package accepted.

| # | Finding | Disposition | Where |
| --- | --- | --- | --- |
| C1 | “Supported Format” circular; FR-14 untestable | **A** — explicit allowlist + accept/reject Fixture Corpus | §4.2.0, FR-14, Glossary |
| C2 | “Resolve” vs preserve `var(--…)` contradictory | **A** — vocabulary split: Alias Graph Validation ≠ Reference Emission | Glossary, FR-4, FR-10 |
| C3 | Dangling aliases + name collisions open | **A** — fail-clear both | FR-21, FR-22 |
| C4 | Composites undefined | **A** — reject in v1 | FR-20, §5 |
| H1 | FR-5–8 “recognize” unobservable | **B** — FR-5–7 retired to implementation notes; convert-only + fixtures | FR-5/6/7 retired, FR-8, §1 |
| H2 | FR-8 “common structures” unbounded | autofix — bound to allowlist; off-list = FR-14 | FR-8, SM-C3 |
| H3 | Tokens Studio dialect unbounded | subset defined + expressions rejected | FR-17, §5, §9 |
| H4 | JTBD claims script avoidance without CLI | **A** — JTBD rewritten (thin wrapper expected) | §2.1 |
| H5 | cwd/paths + write failures unspecified | autofix — path resolution, atomic write, FR-19 | FR-1, FR-2, FR-3, FR-19 |
| H6 | SM-1 circular | defer with owner — corpus contract in PRD, freeze owned by architecture | §4.2.0, SM-1, OQ-1 |

**Medium/low findings also applied:** DTCG subset pinned + `$description` ignored (FR-4); directory/glob Token Source rejected (FR-1); overwrite policy (FR-2); detection precedence for mixed/ambiguous shapes (§4.2.0); URL security product minimums + no-`eval` + prototype-pollution guard (§9); naming rule bounded and declared semver-public (FR-9, §8); SM-3 made task-based; SM-5 performance bar added; SM-C3 allowlist counter-metric added; Assumptions Index cleaned to true assumptions; stale “Library/CLI” journey label and Glossary “CLI” redefinition removed; UJ-1 edge cases enumerated across all failure classes; public package surface (license/registry) recorded.

**Not adopted:** last-wins collision recovery (C3 option B); composite passthrough or expansion (C4 options B/C); restoring a Conversion CLI (H4 option B); recognition diagnostics/metadata as a v1 product output (H1 option A) — all remain deferred in `addendum.md`.
