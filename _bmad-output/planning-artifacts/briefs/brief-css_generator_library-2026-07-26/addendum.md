---
title: "Addendum: css_generator_library"
status: complete
created: 2026-07-26
updated: 2026-07-26
---

# Addendum: css_generator_library

Technical and roadmap detail that supports the product brief but does not belong in the 1–2 page narrative. Intended for PRD / architecture follow-ons.

## Domain models (foundation)

### 1. Three-tier architecture (Material Design 3 / Tokens Studio lineage)

| Tier | Also called | Role |
| --- | --- | --- |
| Primitives | Global / Reference | Hardcoded pure values (HEX, px) without usage context |
| Semantic | Alias / Decision | Purpose/intent of use (role-bound, not color-bound) |
| Component | Override | Closed-scope mapping of a specific component’s properties |

Example (authoritative PO sample):

```json
{
  "sys": {
    "color": {
      "brand": {
        "blue-500": { "$value": "#0055ff", "$type": "color" }
      }
    }
  },
  "semantic": {
    "color": {
      "background": {
        "primary": { "$value": "{sys.color.brand.blue-500}", "$type": "color" }
      }
    }
  },
  "comp": {
    "button": {
      "primary": {
        "background": { "$value": "{semantic.color.background.primary}", "$type": "color" }
      }
    }
  }
}
```

[ASSUMPTION] Tier root keys may vary (`sys` / `global` / `primitive`, `comp` / `component`); detection should be structural, not hard-keyed to one naming scheme.

### 2. CTI taxonomy (Style Dictionary lineage)

**Category → Type → Item** (+ optional variant / state).

Example path shape: `color.background.button` or `size.padding.button.large`.

Implications for CSS naming: [ASSUMPTION] default CSS custom property naming mirrors path segments with a configurable prefix (e.g. `--color-background-button`).

### 3. Object-oriented / EightShapes-like taxonomy

**Namespace → Object → Base → Modifier** (e.g. `brand.alert.border.error`).

Implications: same path-to-CSS mapping; structure detector must distinguish OO trees from CTI when both could parse.

### 4. DTCG (W3C Design Tokens Community Group)

- Prefixed fields: `$value`, `$type`, `$description`
- Aliases: `{path.to.token}`
- [ASSUMPTION] MVP targets practical DTCG subset used in the wild (color, dimension, and common types); full 2025.10 type coverage may be phased.
- [ASSUMPTION] Non-DTCG / legacy Style Dictionary shapes (value without `$`) may be accepted via a normalization pass — nice-to-have, not blocking if only DTCG ships first.

## Emitter and packaging options (parked)

| Option | MVP? | Notes |
| --- | --- | --- |
| CSS custom properties | **Yes** | Core deliverable; prefer preserving `var()` references across tiers when aliases map cleanly |
| SCSS variables / maps | Roadmap | Natural if shared IR exists |
| JS/TS constants / modules | Roadmap | Useful for non-CSS runtimes; dual emit not required for MVP |
| Tailwind theme fragments | Later | Competitive adjacency; not PO-requested for MVP |
| Package form | [ASSUMPTION] | Publishable npm package + CLI binary entrypoint |
| Language | [ASSUMPTION] | TypeScript for library + CLI |

## Competitive landscape (digest)

| Tool | Role in 2025–26 stack | Relation to this project |
| --- | --- | --- |
| **Style Dictionary** (v4/v5) | Primary multi-platform transformer; growing DTCG support | Heavier sibling; we stay CSS + structure analysis |
| **Tokens Studio** | Design-side Figma ↔ Git DTCG JSON | Upstream source of JSON we consume; not a competitor for CLI generation |
| **Theo** | Legacy Salesforce transformer | Avoid for greenfield; weak DTCG story |
| **Token Transformer / others** | Niche bridges | Possible compat fixtures later |

Positioning statement for PRD: *complement the Tokens Studio → DTCG JSON → (optional Style Dictionary) pipeline with a lighter CSS-first path when multi-platform emit is unnecessary.*

## CSS emission design notes

- [ASSUMPTION] Default output groups by detected tier or file (e.g. primitives block, semantic block, component block) rather than one flat unsorted dump.
- [ASSUMPTION] Configurable prefix and naming strategy (kebab-case path join) via API/CLI flags.
- Preserve alias relationships in CSS when both ends are emitted (semantic `var(--sys-…)`), so theme overrides can retarget primitives.
- Error modes: unresolved alias, cyclic reference, unknown `$type` — fail loudly with path context (preferred over silent omit). [ASSUMPTION]

## Explicitly out of MVP (roadmap backlog)

1. Full Figma plugin (authoring or sync).
2. Multi-brand runtime theme-switching UI.
3. First-class SCSS / JS dual emitters (unless IR makes them trivial).
4. iOS / Android / Compose platform parity.
5. Hosted SaaS or visual token editor.
6. Bidirectional write-back to design tools.

## Open questions for PRD / architecture

1. Exact detection heuristics when a file mixes CTI and 3-tier conventions.
2. Which DTCG `$type` set is MVP-complete vs deferred.
3. Whether multi-file / multi-brand token sets are one CLI invocation with merge rules or separate runs.
4. License and package name for npm publish.
5. Minimum Node version and ESM-only vs dual package.
