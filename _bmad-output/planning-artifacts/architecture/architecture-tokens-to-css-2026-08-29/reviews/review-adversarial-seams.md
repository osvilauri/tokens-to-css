# Review — adversarial: two compliant units that still build incompatibly

**Verdict:** five seams where two builders obey every AD and still produce different public output.
Four of them change emitted CSS, which PRD §8 makes a semver-public contract.

## Critical

**C1 — Number and non-string literal emission is unowned.**
AD-2's IR carries `value: string | number`, and no AD says how a number becomes CSS text. Builder A
emits `--spacing-md: 16`. Builder B, reasoning that spacing must be a length, emits `16px`. Both
obey every AD. JSON `true` / `null` are scalars but are not valid CSS values, and nothing rejects
them — so a third builder emits `--flag: true`. This is exactly the broken-CSS-on-a-success-path
the Reliability NFR forbids.

**C2 — "Is this value a reference?" is unowned.**
`"{color.brand.primary}"` is obviously a reference. `"1px solid {color.border}"` is not decided.
Builder A treats it as a literal and emits `--border: 1px solid {color.border}` — syntactically
valid CSS, semantically dead. Builder B treats it as a reference and fails on a dangling target.
Silent breakage vs. hard failure, from the same spec.

**C3 — Tokens Studio wrapper-vs-group is unowned, and it moves public names.**
FR-9 says wrapper keys are not path segments; AD-3 delegates A3 to one registry entry but never
says which keys are wrappers. Builder A drops only `$themes`/`$metadata`; Builder B also drops the
top-level set name. `--global-color-brand-primary` vs `--color-brand-primary` — a public-contract
divergence produced by two compliant implementations.

## High

**H1 — Each §4.2.0 rejection trigger has no single owner.**
"Mixed-dialect token nodes" can live in `dialects/registry.ts` (detection) or in `validate/`
(a pass). AD-5 fixes pass *order*, not pass *membership*. Two owners of one rule means either a
double report or, worse, both assuming the other has it.

## Medium

**M1 — Error message shape is unconstrained.** AD-4 fixes `code` and `tokenPaths`; FR-14 requires
the message to state which shapes are supported and SM-3 requires a developer to act on it
unaided. Nothing stops two builders writing two message styles.

**M2 — IR silently drops `$type` / `$description` / `$extensions`.** Correct for v1, but unstated;
a builder may reasonably thread `$type` through and then use it for unit inference (see C1).
