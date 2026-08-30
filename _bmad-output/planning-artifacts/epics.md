---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: final
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-tokens-to-css-2026-08-06/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-tokens-to-css-2026-08-06/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-tokens-to-css-2026-08-29/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/research/technical-design-token-json-to-css-generation-research-2026-07-26.md'
---

# tokens-to-css - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **tokens-to-css**,
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

FR-1: Epic 1 — both Token Source kinds, single local file path and remote URL
FR-2: Epic 1 — atomic write of the Styles File
FR-3: Epic 1 — default `assets/css/` and custom output path
FR-4: Epic 1 — DTCG single-file subset (A1)
FR-8: **Epic 1** (normalizes A1) + **Epic 2** (extends to A2 and A3)
FR-9: Epic 1 — `:root` custom properties, naming rule, deterministic order
FR-10: Epic 1 — Reference Emission as `var(--…)`
FR-11: Epic 1 — default filename `tokens.css`
FR-12: Epic 1 — every load failure class, local and network, mutually distinguishable
FR-13: Epic 1 — invalid JSON
FR-14: **Epic 1** (structural triggers: non-object root, no token node, directory/glob, `$ref`, unsafe keys, embedded `{…}`) + **Epic 2** (dialect triggers: mixed dialect, expressions, multi-set)
FR-15: Epic 1 — alias cycles
FR-16: **Epic 1** (importable from application code, typed) + **Epic 3** (installable from the registry)
FR-17: Epic 2 — Tokens Studio subset
FR-18: Epic 2 — Style Dictionary legacy
FR-19: Epic 1 — write failure
FR-20: Epic 1 — composite / non-scalar rejection
FR-21: Epic 1 — name collision
FR-22: Epic 1 — dangling alias

**NFR coverage:** NFR1, NFR2, NFR7 (parsing), NFR8, NFR11's guards and the whole remote-source
security envelope NFR3–NFR6 → Epic 1. NFR7 is extended by Epic 2 (expression rejection). NFR9 is
measured in Epic 1 and ratified in Epic 3, which also owns NFR10 and the release mechanics of NFR11.

**Success-metric coverage:** SM-1 and SM-4 are gated by the Fixture Corpus and the network scenario
harness, both built in Epic 1 and extended in Epic 2. SM-2, SM-3 and SM-5's ratification are
satisfied in Epic 3.

## Epic List

Three epics. The architecture spine is final and no direction change is expected between them,
so these are few and large by design rather than sliced per technical layer. Each one leaves the
library in a shippable state.

**Reviewed 2026-08-29** by four independent reviewers (product, architecture, quality,
development), then dispositioned by the product owner. Adopted: the SM-5 performance measurement
moves out of the release epic to the close of Epic 1; Epic 1 is not split but takes a deliberate
story order; the public surface becomes a named early story; and a new spine invariant (AD-23)
covers the network failure classes the file-based corpus cannot express.

**Two product-owner rulings closed the review.** SM-2 will be timed by the product owner
personally, so it is a named commitment rather than an unassigned metric. And the remote Token
Source **stays in v1 and must work from Epic 1** — the reviewer's proposal to defer or cut it was
declined. That ruling folded what had been a separate remote epic into Epic 1, which is why there
are three epics here and not four.

### Epic 1: Convert a token file into a working stylesheet

A developer with a DTCG token file — on disk **or** at a URL — installs the library, calls it from a
few lines of their own code, and gets `assets/css/tokens.css`: custom properties under `:root`,
alias relationships preserved as `var(--…)`, ready to link. When the token file is wrong, they get
a clear, coded failure and their previous stylesheet is left intact.

This epic is the whole product in its narrowest form: both Token Source kinds, the complete failure
vocabulary, and the security envelope that a URL demands. It also lays down the repository, the
Fixture Corpus, the network scenario harness, and the eight public failure codes — the machinery
the later epics extend rather than redesign.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-8 (A1), FR-9, FR-10, FR-11, FR-12, FR-13,
FR-14 (structural), FR-15, FR-16 (importable), FR-19, FR-20, FR-21, FR-22
**NFRs:** NFR1, NFR2, NFR3, NFR4, NFR5, NFR6, NFR7, NFR8, NFR9 (measured), NFR11 (guards)

### Epic 2: Accept the token files teams actually have

A developer whose JSON came out of Tokens Studio, or out of an older Style Dictionary setup that
never migrated to `$value`, converts it without rewriting it first — and gets the same stylesheet
they would have got from a clean DTCG file. When their file uses something outside the allowlist —
a math expression, a mixed dialect, multiple token sets — it is refused by name rather than
half-converted.

This is the product's actual differentiator: breadth of accepted *input shapes*, not breadth of
output platforms. It adds registry entries and fixtures; it touches neither the emitter, the
validators, nor the public surface.

**FRs covered:** FR-17, FR-18, FR-8 (A2, A3), FR-14 (dialect triggers)
**NFRs:** NFR7 (expression rejection)

### Epic 3: Install it from the registry and be converting in fifteen minutes

A developer who has never seen this repository installs the published package, follows the docs, and
has a stylesheet before they lose patience — and can read a failure message well enough to fix their
own token file without opening the library's source. The team can cut releases without breaking the
naming contract or the failure codes by accident.

This is where the product stops being a repository and becomes a package: published docs, the timed
onboarding path, ratification of the number measured in Epic 1, and the first release.

**FRs covered:** FR-16 (installable from the registry)
**NFRs:** NFR10, NFR11 (release mechanics), NFR9 (ratifies the number measured in Epic 1)
**Closes:** OQ-2 by ratifying or replacing the bar in the PRD. OQ-3 closed 2026-08-29 — the
package is `tokens-to-css` under MIT — so this epic no longer carries a blocking decision.
---

## Epic 1: Convert a token file into a working stylesheet

A developer with a DTCG token file — on disk or at a URL — installs the library, calls it from a few
lines of their own code, and gets `assets/css/tokens.css`: custom properties under `:root`, alias
relationships preserved as `var(--…)`, ready to link. When the token file is wrong, they get a
clear, coded failure and their previous stylesheet is left intact.

Story order is deliberate, not incidental. The harness and the public contract come before anything
that produces CSS. The two decisions that cannot be taken back — the naming rule and the alias
graph — come early rather than in the middle. The local path is proved end to end before the
network work starts, so a network bug is never confused with a pipeline bug. The network scenario
harness (1.11) precedes the adapter it tests, because proving the security envelope is the
expensive half of that work and the file-based corpus cannot carry it. And the performance number
is taken last but still inside this epic, while it can change something.

### Story 1.1: Repository scaffold with the architecture's boundaries enforced

As a maintainer of the library,
I want a repository that builds, tests, and refuses to violate the architecture,
So that every later story inherits the invariants instead of re-deciding them.

**Acceptance Criteria:**

**Given** a clean clone of the repository
**When** `npm run build` and `npm test` are run
**Then** both succeed with a trivial passing test
**And** the build emits ESM output plus TypeScript declarations

**Given** the published package manifest
**When** its contents are inspected
**Then** `dependencies` is empty, `type` is `module`, `engines.node` is `>=22.12`
**And** `exports` declares the package root only, with no subpath or wildcard entry

**Given** a source file under `src/dialects/`, `src/validate/`, or `src/emit/`
**When** it imports `node:fs`, `node:https`, `node:net`, or `node:dns`
**Then** the lint step fails with a message naming the boundary rule (AD-1)

**Given** a push to any branch
**When** CI runs
**Then** lint, typecheck, and the test suite execute on Node 22, 24, and 26
**And** Changesets is configured such that a release requires a changeset file

**Given** the pinned toolchain
**When** the build runs for the first time
**Then** tsdown 0.22.x and Vitest 4.1.x are confirmed to work against the TypeScript 7 Go-native compiler
**And** if they do not, the fallback to TypeScript 6.x is recorded in the repository README

### Story 1.2: Public surface and failure contract

As a developer integrating the library,
I want one documented entry point and one predictable error shape,
So that I can branch on failures programmatically and my imports survive future versions.

**Acceptance Criteria:**

**Given** the package is imported
**When** its exports are enumerated
**Then** exactly the Main Entry, `TokenCssError`, `FailureCode`, and the option/result types are public
**And** no internal module is reachable by a deep import

**Given** the Main Entry's type signature
**When** it is inspected from TypeScript
**Then** it is `generateCss(source: string | URL, options?: GenerateCssOptions): Promise<GenerateCssResult>`
**And** `GenerateCssOptions` carries `outDir`, `fileName`, `baseDir`, and a nested `http` object with `allowInsecure`, `timeoutMs`, `maxBytes`, and `maxRedirects`
**And** `GenerateCssResult` carries `outputPath` and `tokenCount`, and carries no CSS payload

**Given** `FailureCode`
**When** its keys are listed
**Then** exactly the eight codes of AD-4 are present, frozen, and covered by a surface snapshot test
**And** a token-scoped error carries `code`, `source`, and `tokenPaths`

**Given** any failure raised anywhere in the library
**When** it is caught by the caller
**Then** it is an instance of `TokenCssError` and never a bare `Error`

**Given** the scope of this story
**When** its tests are written
**Then** they are type-level and surface-snapshot only — no runtime conversion behavior is asserted here, because the Main Entry's body is completed in Story 1.10
**And** the release job refuses to publish until the full suite exists, so a contract without an implementation can never ship

### Story 1.3: Golden-file test harness

As a maintainer of the library,
I want the fixture runner to be trustworthy before any fixture exists,
So that a green suite actually means every case ran.

**Acceptance Criteria:**

**Given** the `fixtures/` directory layout of AD-16
**When** the test run starts
**Then** accept and reject fixtures are discovered by walking directories, with no registration file
**And** the discovered count is asserted against an explicit expected number, so a silently skipped fixture fails the run

**Given** that no converter exists yet at this point in the epic
**When** the harness is exercised
**Then** it is proved against a stub producer injected by the test, so this story depends on nothing after it
**And** the first real fixture arrives with Story 1.10, using this harness unchanged

**Given** output that differs from `expected.css` by a single byte
**When** the suite runs
**Then** the test fails and the diff identifies the differing line

**Given** a fixture directory missing `expected.css`, or containing malformed JSON in the fixture itself
**When** the suite runs
**Then** the run fails naming that directory, rather than skipping it

**Given** the environment variable `UPDATE_GOLDEN=1`
**When** the suite runs
**Then** goldens are rewritten from actual output
**And** CI never sets that variable, verified by an assertion in the workflow

### Story 1.4: Internal token model

As a maintainer of the library,
I want one data shape that every stage after normalization consumes,
So that dialect knowledge cannot leak downstream.

**Acceptance Criteria:**

**Given** the model module
**When** its exported types are inspected
**Then** a token node carries a path, and a value that is either a literal or a reference
**And** no field exists for `$type`, `$description`, or `$extensions`

**Given** the token collection
**When** its type is inspected
**Then** it is an ordered readonly array, not a keyed object or a Map

**Given** the model module's imports
**When** they are inspected
**Then** it imports nothing from any other module in `src/`

### Story 1.5: Custom-property naming and literal serialization

As a developer using the library,
I want token paths turned into custom-property names by one predictable rule,
So that the names in my stylesheet never change under me.

**Acceptance Criteria:**

**Given** the token path `color.brand.primary`
**When** the naming rule is applied
**Then** the result is `--color-brand-primary`

**Given** path segments containing uppercase, accents, spaces, or repeated punctuation
**When** the naming rule is applied
**Then** segments are NFC-normalized, lowercased locale-independently, runs outside `[a-z0-9]` collapse to a single `-`, and leading and trailing `-` are trimmed
**And** a segment beginning with a digit is preserved rather than escaped

**Given** a path segment that normalizes to the empty string
**When** the naming rule is applied
**Then** conversion fails with `FORMAT_NOT_ALLOWED` naming that token path

**Given** a literal value
**When** it is serialized
**Then** a string is emitted verbatim and unquoted, and a number is emitted as `String(n)` with no unit inference or rounding
**And** a boolean, `null`, object, or array fails with `COMPOSITE_VALUE`

### Story 1.6: Stylesheet emission

As a developer using the library,
I want a `:root` block whose contents match my token file's order,
So that the output is reviewable in a diff and identical on every run.

**Acceptance Criteria:**

**Given** a token collection built directly in a test
**When** it is emitted
**Then** the result is a single `:root { … }` block of `--*` declarations in document order
**And** the output ends with exactly one trailing newline

**Given** a token whose value is a reference
**When** it is emitted
**Then** the declaration's value is `var(--target-name)` and never the target's literal value
**And** a multi-hop chain emits one `var(--…)` per token rather than a collapsed literal

**Given** the same token collection
**When** it is emitted twice
**Then** the two outputs are byte-identical
**And** the output contains no timestamp, version string, absolute path, or hostname

### Story 1.7: DTCG parsing and the allowlist registry

As a developer whose tokens follow the DTCG standard,
I want my file accepted as-is at any nesting depth,
So that I do not have to reshape it before converting.

**Acceptance Criteria:**

**Given** a DTCG document using `$value`, `$type`, `$description`, group nesting, and `{path}` aliases
**When** it is normalized
**Then** it produces the expected internal token collection
**And** `$description` has no effect on the result

**Given** the dialect registry
**When** detection runs
**Then** entries are evaluated first-match-wins in the fixed order A3 → A1 → A2
**And** falling off the end raises `FORMAT_NOT_ALLOWED` with a message naming the accepted shapes

**Given** a document with a non-object root, with no recognizable token node, with a `$ref` or resolver manifest, or with a token key of `__proto__`, `constructor`, or `prototype`
**When** it is normalized
**Then** each raises `FORMAT_NOT_ALLOWED`, and `Object.prototype` is verifiably unmodified afterwards

**Given** a value such as `"1px solid {color.border}"`
**When** it is normalized
**Then** it raises `FORMAT_NOT_ALLOWED` naming that token, because only a whole-string `{…}` is a reference

### Story 1.8: Alias graph validation

As a developer using the library,
I want a broken reference to stop the conversion,
So that I never ship a stylesheet whose variables point at nothing.

**Acceptance Criteria:**

**Given** a token referencing a path that does not exist
**When** validation runs
**Then** it fails with `ALIAS_DANGLING`, naming both the referring token and the missing target

**Given** tokens that reference each other in a loop, including a self-reference
**When** validation runs
**Then** it fails with `ALIAS_CYCLE`, listing the token paths that form the cycle

**Given** a document containing several dangling references
**When** validation runs
**Then** every one of them is reported, not only the first

**Given** either failure
**When** it is compared to the other
**Then** the two are distinguishable by code alone, without reading the message

### Story 1.9: Composite and collision validation

As a developer using the library,
I want values the library cannot express, and names that would clash, to stop the conversion,
So that I never get `[object Object]` in a stylesheet or lose a token silently.

**Acceptance Criteria:**

**Given** a token whose value is an object or array — DTCG typography, shadow, border, gradient, transition, stroke-style, or an object-form color
**When** validation runs
**Then** it fails with `COMPOSITE_VALUE`, naming the offending token path and the kind of value found
**And** no output containing `[object Object]` is ever produced, and no offending token is silently dropped

**Given** two distinct token paths that normalize to the same custom-property name
**When** validation runs
**Then** it fails with `NAME_COLLISION`, listing every colliding group and the shared name

**Given** a collision introduced only by the naming rule's character normalization, such as `color.brand-primary` alongside `color.brand.primary`
**When** validation runs
**Then** it is detected, because the check operates on final emitted names rather than on paths

### Story 1.10: End-to-end conversion from a local file

As a developer with a token file in my project,
I want to call the library and get a stylesheet on disk,
So that I can stop maintaining my own conversion script.

**Acceptance Criteria:**

**Given** a valid DTCG file at a relative path and no options
**When** the Main Entry is called
**Then** `assets/css/tokens.css` is written, the directory is created if missing, and the result reports the absolute path and the token count
**And** relative paths resolve against `process.cwd()` unless `baseDir` is supplied

**Given** a custom `outDir` and `fileName`
**When** the Main Entry is called
**Then** the stylesheet is written there instead, and an existing file at that path is replaced

**Given** any validation failure
**When** the Main Entry is called
**Then** no file is written at all — not empty, not partial — and any pre-existing stylesheet at the target path is byte-identical to what it was before

**Given** an output directory that cannot be written, or a disk with no space
**When** the Main Entry is called
**Then** it fails with `OUTPUT_WRITE_FAILED`, distinguishing the causes, and no temporary file is left behind

**Given** a Token Source that is a missing path, a permission-denied path, a directory, or a glob
**When** the Main Entry is called
**Then** the first two fail with `SOURCE_UNREADABLE` and the last two with `FORMAT_NOT_ALLOWED` naming the single-file constraint
**And** malformed JSON fails with `SOURCE_INVALID_JSON`, including the parse position where available

### Story 1.11: Network scenario harness

As a maintainer of the library,
I want network failures reproducible in-process before the adapter exists,
So that the security path is proved rather than assumed.

**Acceptance Criteria:**

**Given** the test run
**When** a network scenario is requested
**Then** an ephemeral HTTP server starts in-process using `node:http` and shuts down afterwards
**And** no dependency is added to the package

**Given** the scenario table in `fixtures/network/scenarios.ts`
**When** it is inspected
**Then** each scenario declares status, headers, body size, redirect target, delay, and resolved address
**And** adding a scenario is a single-file change, mirroring how adding a fixture works

**Given** the scenarios required by the adapter's failure classes
**When** the harness is complete
**Then** a stalling response, an oversized body, a redirect chain, a redirect into a blocked range, and an address in a refused range are all reproducible

### Story 1.12: Guarded HTTPS adapter

As a developer passing a URL,
I want the download itself to be safe by construction,
So that a hostile or misconfigured token URL cannot reach into my network.

**Acceptance Criteria:**

**Given** a URL with the `http:` scheme and no explicit opt-in
**When** it is loaded
**Then** it fails with `SOURCE_UNREADABLE` naming the HTTPS-only default
**And** it succeeds when `http.allowInsecure` is set

**Given** a host that resolves to a loopback, link-local, private, or cloud-metadata address, including an IPv4-mapped IPv6 form
**When** it is loaded
**Then** it is refused, and the connection is made only to an address that was validated — verified by the custom lookup receiving and returning the checked address

**Given** a redirect chain
**When** it is followed
**Then** each hop is re-validated for scheme and address, the hop count is capped, and a redirect into a refused range fails even when the original URL was allowed

**Given** a response that stalls, or whose body exceeds the configured maximum
**When** it is loaded
**Then** it fails with `SOURCE_UNREADABLE` within the configured timeout, distinguishably from the other network causes
**And** the adapter hands the core a buffer, never a URL

### Story 1.13: URL as a Token Source

As a developer whose tokens live at a URL,
I want to pass that URL where I would have passed a path,
So that I do not maintain a download step of my own.

**Acceptance Criteria:**

**Given** a URL serving a valid allowlisted document
**When** the Main Entry is called with it
**Then** the stylesheet written is byte-identical to the one produced from the same content on disk

**Given** a network failure and a local file failure
**When** each is caught
**Then** they are distinguishable from each other and from `SOURCE_INVALID_JSON` by code alone

**Given** every failure class introduced by this epic
**When** the corpus is checked
**Then** each has a scenario in the network harness, so SM-4's coverage claim holds across both mechanisms

### Story 1.14: Measure the conversion bar

As the product owner,
I want the assumed performance bar measured while the core can still change,
So that OQ-2 is answered by a number rather than carried to publish as a guess.

**Acceptance Criteria:**

**Given** a generated accept fixture of 10,000 tokens with realistic alias depth
**When** the benchmark script is run
**Then** it reports the elapsed conversion time and the hardware it ran on

**Given** the benchmark
**When** it runs in CI
**Then** it executes as a smoke check that reports the number without failing the build

**Given** the measured number
**When** the story closes
**Then** it is recorded in `fixtures/README.md` alongside the reference hardware
**And** if it exceeds the assumed 2-second bar, that is raised as a finding against the spine before Epic 2 begins

**Given** the same 10,000-token fixture
**When** it is served over the local network harness instead of read from disk
**Then** the measurement is taken for that path too, since both Token Source kinds ship in this epic

---

## Epic 2: Accept the token files teams actually have

A developer whose JSON came out of Tokens Studio, or out of an older Style Dictionary setup that
never migrated to `$value`, converts it without rewriting it first — and gets the same stylesheet
they would have got from a clean DTCG file. When their file uses something outside the allowlist,
it is refused by name rather than half-converted.

This epic adds registry entries and fixtures. It does not touch the emitter, the validators, or the
public surface.

### Story 2.1: Style Dictionary legacy files

As a developer holding tokens from an older Style Dictionary setup,
I want my `value`/`type` file converted without migrating it to `$value` first,
So that I can adopt the library without touching a file that already works.

**Acceptance Criteria:**

**Given** a document whose token nodes use `value` and `type` without the `$` prefix
**When** it is converted
**Then** it produces the same stylesheet as the equivalent DTCG document, byte for byte
**And** its `{path.to.token}` aliases are validated and emitted as `var(--…)` identically to DTCG

**Given** a document containing both `$value` and `value` keys on the same token node
**When** it is converted
**Then** it fails with `FORMAT_NOT_ALLOWED`, naming the mixed-dialect rule and the offending token

**Given** a document mixing the two dialects across different token nodes
**When** detection runs
**Then** the first-match-wins precedence decides the shape, and token-level keys of the other dialect are a rejection rather than a silent drop

### Story 2.2: Tokens Studio exports

As a developer whose designers publish from Tokens Studio,
I want the export converted without a preprocessing step,
So that the handoff from design to code is one call instead of a script.

**Acceptance Criteria:**

**Given** a Tokens Studio export wrapping DTCG or legacy nodes in a single token set
**When** it is converted
**Then** it produces the expected stylesheet
**And** `$themes` and `$metadata` are parsed and have no effect on the emitted custom properties

**Given** that same export
**When** the emitted names are inspected
**Then** only top-level keys were treated as set wrappers and dropped from the path, and every key below the top level became a path segment

**Given** a document containing more than one token set
**When** it is converted
**Then** it fails with `FORMAT_NOT_ALLOWED`, naming multi-set merge as out of scope

**Given** a token whose value is a math or expression string such as `{spacing.md} * 2` or `roundTo(...)`
**When** it is converted
**Then** it fails with `FORMAT_NOT_ALLOWED` naming expressions as unsupported
**And** no expression is evaluated anywhere — verified by the absence of `eval` and of any expression parser in the built output

### Story 2.3: Freeze the accept matrix

As the product owner,
I want every allowlisted shape proved against every hierarchy model,
So that SM-1 measures the whole allowlist rather than the part that happened to get fixtures.

**Acceptance Criteria:**

**Given** the frozen corpus
**When** its accept fixtures are counted
**Then** there are nine — three dialects across three-tier, CTI, and EightShapes-like hierarchies
**And** all nine express the same token catalogue, so dialect and hierarchy are the only variables

**Given** any two accept fixtures that differ only by dialect
**When** their goldens are compared
**Then** they are byte-identical

**Given** the full corpus
**When** the suite runs
**Then** every accept fixture matches its golden and every reject fixture produces its expected code — SM-1 at 100% with no permanently failing cases

**Given** a new fixture added to the corpus
**When** the change is released
**Then** its first golden is not treated as a breaking change, while any modification to an existing golden requires a major changeset in the same pull request

---

## Epic 3: Install it from the registry and be converting in fifteen minutes

A developer who has never seen this repository installs the published package, follows the docs, and
has a stylesheet before they lose patience — and can read a failure message well enough to fix their
own token file without opening the library's source. The team can cut releases without breaking the
naming contract or the failure codes by accident.

### Story 3.1: Reference documentation that cannot drift

As a developer evaluating the library,
I want the allowlist, the naming rule, and the failure codes documented accurately,
So that I can predict what it will do before I install it.

**Acceptance Criteria:**

**Given** the published documentation
**When** the failure-code table is inspected
**Then** it is generated from the code's own `FailureCode`, and a code added without documenting it fails the build

**Given** the documentation
**When** the allowlist section is read
**Then** it states each accepted shape, the detection precedence, and every rejection trigger
**And** the naming rule is stated normatively, including its edge cases, and marked as part of the public contract

**Given** a developer reading only the docs and the fixtures
**When** they attempt to convert a Style Dictionary legacy file and to interpret one rejection message
**Then** they complete both unaided, without reading library source — SM-3

### Story 3.2: The fifteen-minute path, timed by the product owner

As a developer new to the library,
I want a first run that works on the first try,
So that I can judge the tool in minutes rather than an afternoon.

**Acceptance Criteria:**

**Given** the documented onboarding path
**When** it is followed in a fresh Node project
**Then** it covers install, the sample token source, the thin wrapper that invokes the Main Entry, verification that the stylesheet exists with the expected custom properties, and one deliberate failure whose message is read

**Given** the wrapper example in the docs
**When** it is copied verbatim into a project that did not write it
**Then** it runs unmodified — this example is tested in CI, not only printed

**Given** the checklist and a developer who has not seen the project
**When** the product owner (Osvaldo) times the attempt personally
**Then** each of the five steps passes and the total is under fifteen minutes — SM-2, measured on a recorded date rather than asserted
**And** the measured time and date are recorded in the docs, so a later regression in onboarding is visible rather than argued

### Story 3.3: Ratify or replace the performance bar

As the product owner,
I want the PRD's performance bar to reflect a measurement,
So that OQ-2 closes on evidence.

**Acceptance Criteria:**

**Given** the number measured in Story 1.14 — 10,000 tokens in 30 ms against an assumed 2,000 ms bar, scaling linearly to 200,000 (`fixtures/README.md`)
**When** OQ-2 is closed
**Then** the PRD's SM-5 either keeps the 2-second bar with the measurement recorded, or states a revised bar with its rationale
**And** the `[ASSUMPTION]` tag is removed from SM-5 in the PRD and the Assumptions Index

**Given** that a 66× margin would let the emitter get sixty times slower and still pass
**When** the bar is chosen
**Then** it is set close enough to the measurement to notice a real regression, while leaving room for slower CI hardware and ordinary variance

**Given** the benchmark
**When** it runs in CI after this story
**Then** exceeding the ratified bar is reported as a regression

### Story 3.4: First release

As a developer who wants to use this,
I want to install it from the registry like any other package,
So that adopting it costs one command.

**Acceptance Criteria:**

**Given** the package name `tokens-to-css` and the MIT license, decided 2026-08-29
**When** this story starts
**Then** the manifest, the repository, the README, and every documented example already use that name, and `LICENSE` is present with the MIT text
**And** npm availability is re-checked immediately before publishing, since an unpublished name is never reserved

**Given** a merged release pull request
**When** CI runs the release job
**Then** the package is published with provenance from CI, and publishing from a developer machine is not a supported path

**Given** the published package
**When** it is installed into a fresh project
**Then** the Main Entry is importable with its TypeScript types, and the install pulls no runtime dependencies

**Given** a change to an emitted name, a failure code, the default output path or filename, or a removal from the allowlist
**When** it is released
**Then** it ships as a major version, enforced by the changeset required on that pull request
