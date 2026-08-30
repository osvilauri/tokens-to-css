---
title: "Product Brief: css_generator_library"
status: complete
created: 2026-07-26
updated: 2026-07-26
---

# Product Brief: css_generator_library

## Executive Summary

**css_generator_library** is a developer-facing library (with CLI and programmatic API) that turns design-token JSON into CSS custom properties ready for design systems, web apps, and component libraries. Given one or more token files, it analyzes structure, normalizes common naming models, resolves aliases, and emits CSS sets that plug directly into a token-driven styling pipeline.

Design systems increasingly treat tokens as the contract between design and code. Teams receive JSON from Figma exports, Tokens Studio, hand-authored catalogs, or legacy Style Dictionary trees — but formats and hierarchies vary. Getting from “token JSON on disk” to “CSS variables the app can consume” still means custom scripts, fragile path conventions, or heavy multi-platform tooling when only CSS is needed.

This project exists to make that last mile reliable and small: structure-aware analysis first, CSS generation second. It is a personal / passion project aimed at professional design-system practice — a focused tool for engineers, not an investor pitch or a consumer product.

## The Problem

Design-system and frontend engineers regularly inherit token JSON that is *almost* usable: DTCG-shaped in places, CTI-shaped in others, sometimes mixed tiers, often with curly-brace aliases that must resolve before CSS can ship. Coping today means ad-hoc Node scripts, partial Style Dictionary configs, or manual rename passes. Cost is time, broken references, and CSS that flattens semantic relationships teams need for theming.

[ASSUMPTION] Many target users already have tokens in Git and primarily need web/CSS output — not iOS/Android emitters — so a full Style Dictionary stack feels oversized for their job.

## The Solution

Ship a **library + CLI + API** that:

1. **Ingests** user-supplied JSON token trees (files or in-memory structures).
2. **Recognizes** common architectures: three-tier (primitive → semantic → component), CTI (Category / Type / Item), and object-oriented / EightShapes-like hierarchies (namespace → object → base → modifier).
3. **Respects DTCG** conventions (`$value`, `$type`, `$description`, `{path.to.token}` aliases).
4. **Resolves** aliases and emits **CSS custom properties** suitable for design-system consumption — including preserving referential structure where useful (e.g. semantic vars pointing at primitive vars).

Outcome: drop in token JSON, get CSS token sets you can wire into a DS, app, or package without reinventing transform plumbing.

## What Makes This Different

| Approach | Fit |
| --- | --- |
| **Style Dictionary** | Battle-tested multi-platform transform; heavier when CSS-only is the goal |
| **Theo** | Legacy; weak DTCG story for new greenfield work |
| **Tokens Studio** | Design-side authoring / Figma sync — not a code-side CSS generator |

**css_generator_library** positions as a **focused CSS generation and structure-analysis helper**: detect and normalize how tokens are organized, then emit CSS. Differentiation is scope discipline and taxonomy fluency, not a fabricated platform moat. [ASSUMPTION] Interop with Style Dictionary pipelines (consume similar JSON, complement rather than replace) is desirable but not an MVP hard requirement.

## Who This Serves

- **Primary:** Design system engineers and frontend developers who maintain token catalogs and need reliable CSS custom-property output for web/apps.
- **Secondary:** [ASSUMPTION] DS leads evaluating token architecture who want a quick structural read of an existing JSON dump before committing to a pipeline.

Success for them: feed known-good token JSON → get predictable, alias-correct CSS variables named consistently with their hierarchy.

## Success Criteria

- Correctly parses DTCG-style tokens and resolves `{alias}` chains without cycles or silent drops.
- Detects / normalizes at least the three foundation models (3-tier, CTI, EightShapes-like) on representative fixtures.
- Emits CSS custom properties consumable in a simple `:root` / themed stylesheet workflow.
- [ASSUMPTION] Usable as both a Node/TS library API and a CLI for local/CI generation.
- Documentation and fixtures clear enough that a DS engineer can integrate without reading the source.

## Scope

**In for MVP**

- Analyze and normalize common token JSON structures.
- Resolve DTCG aliases; emit CSS custom properties for DS consumption.
- Support recognition of 3-tier + CTI + EightShapes-like hierarchies.
- Library / CLI / API form factor (no product UI).

**Out of MVP** (see addendum for options)

- Full Figma plugin.
- Multi-brand runtime theme-switching UI.
- [ASSUMPTION] First-class SCSS and JS/TS dual emitters (CSS-first unless a natural shared emitter model appears).
- Exhaustive multi-platform parity with Style Dictionary (iOS, Android, Compose, etc.).

## Vision

Become a small, trusted piece of the modern token toolchain: the place teams go when they need **structure-aware JSON → CSS** without standing up a full multi-platform transform stack. Longer term, optional emitters, tighter DTCG alignment as the spec evolves, and CI-friendly validation of token graphs — still library-first, still CSS-core.
