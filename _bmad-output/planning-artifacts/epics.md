---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-css_generator_library-2026-08-06/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-css_generator_library-2026-08-06/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-css_generator_library-2026-08-29/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/research/technical-design-token-json-to-css-generation-research-2026-07-26.md'
---

# css_generator_library - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **css_generator_library**,
decomposing the requirements from the PRD and the Architecture Spine into implementable stories.

There is **no UX Design document and no UX Design Requirements section**: the product is a
Node/TypeScript library with no user interface (PRD §5 explicitly excludes any product UI, Figma
plugin, and theme-switching UI). The `design-artifacts/` folders in this repo are empty and belong
to a different (WDS) pipeline that was never started for this project.

Requirement IDs are carried through **verbatim from the PRD** — they are stable, and FR-5, FR-6 and
FR-7 are retired IDs that must never be reused (PRD §4.2.0 / §13 H1B).

## Requirements Inventory

### Functional Requirements

19 live FRs. Retired: FR-5, FR-6, FR-7.

FR-1: Load Token JSON from a Token Source — remote URL or single local file path; post-load parity; relative paths resolve against `process.cwd()` unless a base directory is supplied; directory/glob sources are rejected.
FR-2: Write the Styles File to disk on successful Conversion — atomic replace, overwrite by default.
FR-3: Default output directory `assets/css/`, or a caller-supplied custom output path; create the directory if missing.
FR-4: Parse DTCG single-file Token JSON (shape A1) restricted to the v1 subset; `$description` parsed and ignored.
FR-8: Normalize the allowlisted Token JSON shapes — and only those — into the internal token tree, at any nesting depth.
FR-9: Emit CSS custom properties inside a `:root` rule, named by the normative naming rule; declaration order is document order; byte-identical output for identical input.
FR-10: Emit references as `var(--target)` (Reference Emission) — never inline the alias target's literal value.
FR-11: Default Styles File name `tokens.css` unless a custom name is supplied.
FR-12: Fail clearly on a missing or unreachable Token Source, with load-time failure classes distinguishable from each other and from FR-13.
FR-13: Fail clearly on invalid JSON, including parse position where available.
FR-14: Fail clearly on input outside the Format Allowlist (V1); the message states which shapes are supported.
FR-15: Fail clearly on alias cycles, naming the tokens in the cycle.
FR-16: Install via package manager; the Main Entry is importable from application code and ships TypeScript types.
FR-17: Normalize the Tokens Studio Vendor Dialect (A3 subset); `$themes`/`$metadata` ignored; math/expression values rejected.
FR-18: Normalize the Style Dictionary legacy Vendor Dialect (A2, `value`/`type` without `$`); post-normalization parity with A1.
FR-19: Fail clearly on Styles File write failure; no temp file left behind, pre-existing file untouched.
FR-20: Reject composite and non-scalar token values, identifying the offending token path and type.
FR-21: Fail clearly on custom-property name collision, listing the colliding token paths and the shared name.
FR-22: Fail clearly on dangling aliases, naming the referring token and the missing target, distinguishably from FR-15.

### NonFunctional Requirements

Numbered here for story traceability; the PRD carries them as named bullets in §9.

NFR1 — Reliability: Conversion either writes a correct Styles File or fails with a distinguishable code. No silent empty success, no partial file, no unresolvable `var(--…)` on a success path.
NFR2 — Atomicity: Styles File writes are atomic (temp file + rename); a crashed or failed run never corrupts an existing Styles File.
NFR3 — Remote source security, scheme: `https:` only by default; `http:` requires explicit caller opt-in.
NFR4 — Remote source security, limits: required connect + total timeout; enforced maximum response size (oversized fails under FR-12).
NFR5 — Remote source security, redirects: capped at a small limit and re-validated against scheme/host rules at every hop.
NFR6 — Remote source security, SSRF: link-local and cloud-metadata address ranges refused, including post-redirect.
NFR7 — Parsing security: no `eval` and no expression evaluation; custom-property identifiers sanitized before emission; no prototype-polluting key assignment during normalization; no filesystem traversal outside the resolved output path.
NFR8 — Predictability: emitted names follow the FR-9 rule; identical input yields byte-identical output; declaration order is document order.
NFR9 — Performance: SM-5 — a 10k-token accept fixture converts in under 2s on documented reference hardware. **[ASSUMED BAR — OQ-2]**
NFR10 — Documentation: public docs + Fixture Corpus sufficient for SM-3, covering the allowlist, the failure codes, and the naming rule.
NFR11 — Public surface / semver: emitted custom-property names and failure codes are public for a given major version; changing either, or the default output path/filename, or removing an allowlist entry, is a breaking change.

### Additional Requirements

From the Architecture Spine (`ARCHITECTURE-SPINE.md`, AD-1…AD-22). These are implementation
constraints that shape stories, not restatements of FRs.

**No starter template.** The spine specifies no scaffold, boilerplate, or generator — this is a
hand-scaffolded greenfield repository. Epic 1 Story 1 is a manual repo setup, not a
`create-*`/degit run.

- Stack is pinned and verified as of 2026-08-29: TypeScript 7.0.x, Node `engines >=22.12` (dev/CI on 24), ESM-only, tsdown 0.22.x, Vitest 4.1.x, `@changesets/cli` 3.0.x.
- **Zero runtime dependencies** (AD-13): `dependencies` stays empty; `node:` builtins only. Adding one requires a spine amendment.
- Directory layout and one-way dependency rule are fixed (AD-1): `dialects/`, `validate/`, `emit/` may not import `node:fs` or any networking builtin.
- Single internal representation at every stage boundary (AD-2); the IR carries no `$type`/`$description`/`$extensions`.
- The Format Allowlist is a closed ordered registry with precedence A3 → A1 → A2 (AD-3).
- One exported error class + frozen `FailureCode` object; eight codes fixed by name (AD-4).
- Validation passes run in fixed order, each exhaustive within its class, first failure aborts (AD-5).
- Output is fully built in memory before any write (AD-6); atomic temp+rename in the target directory (AD-7).
- Remote loading is `node:https` with a custom `lookup` and `node:net.BlockList` — **not** global `fetch`, which cannot satisfy NFR6 without a non-builtin dependency (AD-8).
- Prototype-pollution safety by construction: `Object.create(null)`, and `__proto__`/`constructor`/`prototype` token keys are a hard reject (AD-9).
- Determinism is structural: order travels in arrays; no timestamps/paths/hostnames in output (AD-10).
- Naming-rule edge cases fixed: NFC, locale-independent lowercase, non-`[a-z0-9]` runs collapse to one `-`, trim, empty segment is a hard failure, leading digits allowed (AD-11).
- Collision detection runs on final emitted names and groups all conflicts (AD-12).
- One public module, no subpath exports, no deep imports (AD-14).
- Main Entry signature and option names are fixed (AD-15): `generateCss(source, options?) → { outputPath, tokenCount }`.
- Literal emission is verbatim; numbers via `String(n)` with no unit inference; boolean/null/object/array → `COMPOSITE_VALUE` (AD-19).
- A value is a reference only if the entire trimmed string matches `^\{[^{}]+\}$`; embedded `{…}` is rejected (AD-20).
- Every rejection trigger has exactly one owning module, per the AD-21 table.
- Tokens Studio: only top-level keys are set wrappers; more than one token set is rejected (AD-22).
- **Fixture Corpus** (AD-16, closes OQ-1): filesystem-discovered; `accept/<dialect>/<hierarchy>/{input.json,expected.css}` and `reject/<trigger>/{input.json,expected.json}`; v1 freeze is 9 accept fixtures (3 dialects × 3 hierarchies) all expressing the **same token catalogue**, plus one reject fixture per rejection trigger and per failure class.
- **Golden-file protocol** (AD-17): regenerate only under `UPDATE_GOLDEN=1`; a diff to an existing `expected.css` ships with a `major` changeset in the same PR; CI never sets the flag.
- **Operational envelope** (AD-18): GitHub Actions on every push (Node 22/24/26 matrix — lint, typecheck, fixture corpus, bench smoke); release via Changesets → `npm publish --provenance` from CI. Publishing from a developer machine is not supported.
- `bench/` ships a 10k-token fixture and a script so NFR9/OQ-2 can be measured rather than asserted.
- Documentation obligations (AD conventions): the failure-code table is generated from `FailureCode`; `docs/` carries the SM-2 onboarding checklist, the allowlist, and the naming rule.

### UX Design Requirements

**None — not applicable.** No UI exists in this product (PRD §5). No UX Design document was
produced, and none is required.

### FR Coverage Map

FR-1: **Epic 1** (single local file path) + **Epic 3** (remote URL)
FR-2: Epic 1 — atomic write of the Styles File
FR-3: Epic 1 — default `assets/css/` and custom output path
FR-4: Epic 1 — DTCG single-file subset (A1)
FR-8: **Epic 1** (normalizes A1) + **Epic 2** (extends to A2 and A3)
FR-9: Epic 1 — `:root` custom properties, naming rule, deterministic order
FR-10: Epic 1 — Reference Emission as `var(--…)`
FR-11: Epic 1 — default filename `tokens.css`
FR-12: **Epic 1** (missing / unreadable local path) + **Epic 3** (unreachable, timeout, oversize, policy)
FR-13: Epic 1 — invalid JSON
FR-14: **Epic 1** (structural triggers: non-object root, no token node, directory/glob, `$ref`, unsafe keys, embedded `{…}`) + **Epic 2** (dialect triggers: mixed dialect, expressions, multi-set)
FR-15: Epic 1 — alias cycles
FR-16: **Epic 1** (importable from application code, typed) + **Epic 4** (installable from the registry)
FR-17: Epic 2 — Tokens Studio subset
FR-18: Epic 2 — Style Dictionary legacy
FR-19: Epic 1 — write failure
FR-20: Epic 1 — composite / non-scalar rejection
FR-21: Epic 1 — name collision
FR-22: Epic 1 — dangling alias

**NFR coverage:** NFR1, NFR2, NFR7 (parsing), NFR8 and the NFR11 guards → Epic 1.
NFR3–NFR6 (the whole remote-source security envelope) → Epic 3. NFR7 is extended by Epic 2
(expression rejection). NFR9 (performance bar), NFR10 (documentation) and NFR11's release
mechanics → Epic 4.

**Success-metric coverage:** SM-1 and SM-4 are gated by the Fixture Corpus built in Epic 1 and
extended in Epics 2–3. SM-2, SM-3 and SM-5 are satisfied in Epic 4.

## Epic List

Four epics. The architecture spine is final and no direction change is expected between them,
so these are few and large by design rather than sliced per technical layer. Each one leaves the
library in a shippable state.

### Epic 1: Convert a token file into a working stylesheet

A developer with a DTCG token file on disk installs the library, calls it from a few lines of
their own code, and gets `assets/css/tokens.css` — custom properties under `:root`, alias
relationships preserved as `var(--…)` — which their app can link and use immediately. When the
token file is wrong, they get a clear, coded failure and their previous stylesheet is left intact.

This epic is the whole product in its narrowest form: the vertical slice from install to usable
CSS, plus every failure class that a local file can produce. It also lays down the repository, the
Fixture Corpus, and the eight public failure codes — the machinery every later epic extends
rather than redesigns.

**FRs covered:** FR-1 (local), FR-2, FR-3, FR-4, FR-8 (A1), FR-9, FR-10, FR-11, FR-12 (local),
FR-13, FR-14 (structural), FR-15, FR-16 (importable), FR-19, FR-20, FR-21, FR-22
**NFRs:** NFR1, NFR2, NFR7, NFR8, NFR11 (guards)

### Epic 2: Accept the token files teams actually have

A developer whose JSON came out of Tokens Studio, or out of an older Style Dictionary setup that
never migrated to `$value`, converts it without rewriting it first — and gets the same stylesheet
they would have got from a clean DTCG file. When their file uses something outside the allowlist —
a math expression, a mixed dialect, multiple token sets — it is refused by name rather than
half-converted.

This is the product's actual differentiator: breadth of accepted *input shapes*, not breadth of
output platforms. It extends the dialect registry and adds fixtures; it does not touch the
emitter.

**FRs covered:** FR-17, FR-18, FR-8 (A2, A3), FR-14 (dialect triggers)
**NFRs:** NFR7 (expression rejection)

### Epic 3: Point it at a URL, safely

A developer whose design team publishes tokens at a URL passes that URL instead of a path and gets
the same result, without writing a download step. Everything after the download behaves
identically to a local file.

Isolated as its own epic because it is the one real risk boundary in v1: the whole remote-source
security envelope lives here — HTTPS by default, timeouts, size caps, capped redirects
re-validated per hop, and refusal of link-local and cloud-metadata addresses with the connection
pinned to the address that was actually checked.

**FRs covered:** FR-1 (URL), FR-12 (network failure classes)
**NFRs:** NFR3, NFR4, NFR5, NFR6

### Epic 4: Install it from the registry and be converting in fifteen minutes

A developer who has never seen this repository installs the published package, follows the docs,
and has a stylesheet before they lose patience — and can read a failure message well enough to fix
their own token file without opening the library's source. The team can cut releases without
breaking the naming contract or the failure codes by accident.

This is where the product stops being a repository and becomes a package: published docs, the
measured onboarding path, the benchmark that settles the performance bar, and the first release.

**FRs covered:** FR-16 (installable from the registry)
**NFRs:** NFR9, NFR10, NFR11 (release mechanics)
**Closes:** OQ-2 by measurement; blocked on OQ-3 (package name and license) before the first publish.
