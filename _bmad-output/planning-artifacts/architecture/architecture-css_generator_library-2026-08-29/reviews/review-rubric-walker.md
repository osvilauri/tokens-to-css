# Review — good-spine rubric

**Verdict:** structurally sound; the operational dimension is covered; two gaps worth closing.

- **Fixes the real divergence points:** mostly yes — but see the adversarial review; the seams that
  move *emitted CSS* (the semver-public surface) were the ones left open, which is the worst place
  to leave a gap in this particular product.
- **Every Rule enforceable:** yes, except AD-8, which is not implementable as written (version
  review C1).
- **Deferred is safe:** yes. OQ-2 and OQ-3 carry owners and revisit conditions; the deferred product
  capabilities are PRD-owned, not architecture-owned.
- **Named tech verified-current:** partially — two version errors (version review H1, M1).
- **Brownfield ratification:** N/A, greenfield.
- **Spec coverage:** the Capability → Architecture Map covers §4.1–§4.5, SM-1, SM-4, SM-5. FR-16's
  TypeScript-types consequence lands via AD-14 + the stack row.
- **Operational envelope:** covered by AD-18 (CI matrix, Changesets release, provenance, no runtime
  infra). Not left silent.

## Gaps

**G1 — Documentation has no owner.** PRD §9 makes docs an NFR and SM-2/SM-3 gate on them
(scripted onboarding checklist, two unaided task-based exercises). The spine shows `docs/` in the
tree and nothing else. Docs are a deliverable with a success metric attached; they need at least a
convention row saying what must exist and what keeps it true.

**G2 — OQ-1's "initial contents" is answered by count, not by content.** AD-16 fixes 3 dialects ×
3 hierarchies plus one reject per trigger. That is a defensible freeze, but the accept fixtures'
actual token content is undefined — two builders write two different corpora and SM-1 measures two
different things. Naming a shared token catalogue for all nine accept fixtures would close it.
