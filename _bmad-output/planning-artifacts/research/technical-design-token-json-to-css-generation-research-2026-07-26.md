---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/planning-artifacts/briefs/brief-tokens-to-css-2026-07-26/brief.md
  - .claude/skills/bmad-technical-research/research.template.md
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Design token JSON to CSS generation libraries and architecture patterns'
research_goals: |
  1. Map the current technical landscape for transforming design tokens (DTCG/W3C JSON) into CSS custom properties and related CSS artifacts.
  2. Compare Style Dictionary, Theo, Tokens Studio / token transformers, and similar tools.
  3. Document architectural patterns for taxonomy detection, DTCG parsing/alias resolution, and CSS emission.
  4. Recommend a feasible MVP implementation for a focused analyze-then-generate CSS library.
  5. Call out risks, DTCG maturity, TypeScript vs JS packaging, CLI vs API, and large-set performance.
user_name: 'osvi'
date: '2026-07-26'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-07-26  
**Author:** osvi  
**Research Type:** technical  

---

## Research Overview

This technical research maps how design-token JSON becomes CSS for design systems, web apps, and component libraries. The landscape shifted materially in October 2025 when the Design Tokens Community Group (DTCG) published its first **stable** Format Module **2025.10**, with a companion **Resolver** module for multi-context theming. Tooling now clusters around Style Dictionary (multi-platform, config-heavy), Terrazzo (formerly Cobalt; DTCG-native, plugin-centric), Tokens Studio + `@tokens-studio/sd-transforms` (authoring → transform bridge), and legacy Theo (largely superseded).

For **tokens-to-css**, the differentiation opportunity is clear: **structure-aware analysis first, CSS emission second** — detect 3-tier / CTI / EightShapes-like taxonomies, parse DTCG (`$value` / `$type` / `$description`, `{alias.path}`), resolve references, and emit layered CSS (`:root`, theme selectors, optional `@theme`) without requiring a full multi-platform Style Dictionary stack. See the Executive Summary and Strategic Recommendations in the Research Synthesis section below for the recommended architecture and risks.

---

## Technical Research Scope Confirmation

**Research Topic:** Design token JSON to CSS generation libraries and architecture patterns  

**Research Goals:**

1. Map the current technical landscape for transforming design tokens (DTCG/W3C JSON) into CSS custom properties and related CSS artifacts for design systems, web, and apps.
2. Compare approaches of Style Dictionary, Theo, Tokens Studio / token transformers, and similar tools — strengths, gaps, CSS output quality, alias resolution, multi-file tokens, theming.
3. Document architectural patterns for:
   - Detecting / classifying JSON token taxonomies: 3-tier (primitive/semantic/component), CTI (Category-Type-Item), EightShapes Namespace-Object-Base-Modifier
   - Parsing DTCG (`$value`, `$type`, `$description`) and resolving `{alias.path}` references
   - Emitting CSS (`:root`, `@theme`, layered files, dark/light, component scopes)
4. Recommend a feasible implementation approach for a new focused library whose MVP is: analyze user-supplied token JSON structure → generate the CSS sets needed to plug into a DS/web/app.
5. Call out risks, standards maturity (DTCG), TypeScript vs JS packaging, CLI vs programmatic API, performance on large token sets.

**Technical Research Scope:**

- Architecture Analysis — design patterns, frameworks, system architecture
- Implementation Approaches — development methodologies, coding patterns
- Technology Stack — languages, frameworks, tools, platforms
- Integration Patterns — APIs, protocols, interoperability
- Performance Considerations — scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-07-26 (non-interactive mode; topic and goals fixed by product owner)

**Domain grounding:** Product brief for `tokens-to-css` (2026-07-26) — library + CLI + API that analyzes token JSON structure and emits CSS custom properties for DS/web/app consumption.

---

## Technology Stack Analysis

### Programming Languages

_Popular Languages:_ **TypeScript** and **JavaScript (ESM)** dominate design-token transform tooling. Style Dictionary v4+ ships as native ESM with first-class TypeScript types. Terrazzo is TypeScript-first (CLI + plugins). Tokens Studio transforms are published as npm packages for Node consumers.

_Emerging Languages:_ Bun/Deno appear as optional runtimes for Style Dictionary configs that load `.ts` configs natively (Node ≥ 22.6 with experimental type stripping also mentioned in SD docs). Swift/Kotlin remain **output** targets for multi-platform tools, not implementation languages for CSS-focused libraries.

_Language Evolution:_ CommonJS → ESM is the industry migration story (Style Dictionary v4 breaking change). New libraries should ship **ESM-first dual publish** (`"type": "module"`, `exports` map) with optional CJS interop only if required.

_Performance Characteristics:_ Token pipelines are CPU-bound graph walks (alias resolution, expand composites). Map-based token indexes outperform nested-object walks on large sets (Style Dictionary v5 `tokenMap` work).

_Source:_ https://styledictionary.com/versions/v4/migration/ · https://styledictionary.com/getting-started/using_the_npm_module/ · https://github.com/terrazzoapp/terrazzo/

### Development Frameworks and Libraries

_Major Frameworks:_

| Tool | Role | CSS focus |
| --- | --- | --- |
| **Style Dictionary** (Amazon / community) | Multi-platform transform build system | `css/variables` format; `outputReferences`; expand composites |
| **Terrazzo** (ex-Cobalt UI) | DTCG-native code generator | `@terrazzo/plugin-css`; modes → selectors; Color Module 4 |
| **@tokens-studio/sd-transforms** | Bridge Tokens Studio JSON → Style Dictionary | Math, color modifiers, px/opacity, shadow inset |
| **Theo** (`salesforce-ux/theo`) | Legacy YAML/JSON → many formats | `custom-properties.css`; superseded in Salesforce by Style Dictionary + DTCG |

_Micro-frameworks:_ Dispersa (resolver-centric DTCG consumer), Style Dictionary Configurator (browser SD playground), zeroheight token automation (SD v5 + DTCG 2025.10 exports).

_Evolution Trends:_ DTCG 2025.10 stable release (2025-10-28) is the convergence point. Tools advertise 2025.10 support with uneven completeness — Style Dictionary documents **incomplete** 2025.10 support as WIP in v5; Terrazzo claims full 2025.10 support.

_Ecosystem Maturity:_ Style Dictionary remains the default for multi-platform orgs. For **CSS-only** teams, Terrazzo and focused custom libraries are increasingly viable. Theo is reference/legacy.

_Source:_ https://styledictionary.com/info/dtcg/ · https://terrazzo.app/docs/integrations/css · https://github.com/Tokens-studio/sd-transforms · https://github.com/salesforce-ux/theo · https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/

### Database and Storage Technologies

_Relational / NoSQL:_ Not primary for token→CSS generators. Token sources live in **Git-backed JSON/YAML** (`.tokens.json`, multi-file trees). Figma / Tokens Studio are upstream authoring stores; code tools treat files as the contract.

_In-Memory:_ Style Dictionary supports `memfs` volumes for isolated/browser builds. Recommended MVP pattern: parse JSON → in-memory **token graph** (Map keyed by path) → emit CSS strings/files.

_Data Warehousing:_ N/A for MVP. Optional later: analytics on unused tokens / alias depth.

_Source:_ https://styledictionary.com/reference/api/ · product brief grounding

### Development Tools and Platforms

_IDE and Editors:_ VS Code / Cursor with JSON Schema validation against DTCG shapes; Style Dictionary Configurator for experimentation.

_Version Control:_ Git is the operational store; CI runs CLI builds on token PRs (common Tokens Studio → SD → GitHub Actions pattern).

_Build Systems:_ npm/pnpm/bun scripts; Style Dictionary CLI (`style-dictionary build`); Terrazzo CLI (`tz build`).

_Testing Frameworks:_ Fixture-driven unit tests on alias graphs, cycle detection, CSS snapshot diffs; golden-file tests for taxonomy classifiers.

_Source:_ https://docs.tokens.studio/transform-tokens/style-dictionary · https://devcheolu.com/en/posts/0sa4JzPKHIoeWmwdx6Am

### Cloud Infrastructure and Deployment

_Major Cloud Providers:_ Irrelevant as runtime for a library; relevant only for hosted design systems (Specify, Supernova, zeroheight) that export DTCG.

_Container / Serverless:_ Optional CI runners only.

_CDN and Edge:_ Generated CSS is static; distribute via package `dist/` or CDN like any stylesheet.

_Source:_ https://www.designtokens.org/glossary/ · https://help.zeroheight.com/hc/en-us/articles/48049028236187-Migrating-to-Style-Dictionary-v5-in-tokens-automation

### Technology Adoption Trends

_Migration Patterns:_ Theo/YAML → Style Dictionary → DTCG `$`-prefixed JSON; Salesforce publicly replaced Theo-based styling-hooks packages with Style Dictionary + DTCG + OKLCH. Cobalt → Terrazzo rebrand with DTCG 2025.10 alignment.

_Emerging Technologies:_ DTCG **Resolver** for themes/modes without combinatorial file explosion; Tailwind v4 `@theme` as a **consumer** of CSS variables; CSS Color Module 4 (oklch, P3); CSS `light-dark()`.

_Legacy Technology:_ Unprefixed `value`/`type` Style Dictionary v3 JSON; Theo alias syntax `{!name}`; Aura/SLDS1 design-token APIs inside Salesforce.

_Community Trends:_ Vendor-neutral interchange; reference implementations cited for Style Dictionary, Tokens Studio, Terrazzo; 10+ design tools implementing or supporting the stable format.

_Source:_ https://www.npmjs.com/package/@salesforce-ux/design-tokens · https://github.com/terrazzoapp/terrazzo/issues/201 · https://tailwindcss.com/docs/theme · https://www.designtokens.org/tr/2025.10/

**Confidence:** High for tool roles and DTCG 2025.10 announcement; Medium for exact Style Dictionary 2025.10 feature parity (explicitly marked incomplete by maintainers).

---

## Integration Patterns Analysis

### API Design Patterns

_RESTful APIs:_ Hosted token platforms (Specify, Supernova, zeroheight) expose REST/download URLs for DTCG JSON or platform CSS. Local libraries favor **programmatic Node APIs** over HTTP.

_GraphQL / RPC:_ Rare in this niche.

_Webhook Patterns:_ Design-tool sync (Tokens Studio → Git) triggers CI builds rather than runtime webhooks.

_Library API pattern (recommended):_

```ts
analyze(tokens) → TaxonomyReport
resolve(tokens, options) → ResolvedGraph
emitCss(graph, EmitOptions) → CssArtifact[]
```

CLI wraps the same functions (`cssgen analyze|build`).

_Source:_ https://styledictionary.com/reference/api/ · product brief · https://terrazzo.app/docs/integrations/css

### Communication Protocols

_HTTP/HTTPS:_ Used for remote token URL fetches in CI; not core to the library.

_WebSocket / Message queues:_ Not applicable to MVP transform tools.

_Primary “protocol”:_ **File + in-memory JSON** interchange using media type guidance `application/design-tokens+json` and extensions `.tokens` / `.tokens.json` (community practice around DTCG 2025.10).

_Source:_ https://www.humanstandards.org/code-design-tokens/css-json-tokens/ · https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/

### Data Formats and Standards

_JSON (DTCG Format Module 2025.10):_ Token = object with required `$value`; optional `$type`, `$description`, `$extensions`, `$deprecated`. Group-level `$type` inheritance. Alias strings: `{path.to.token}`.

_Resolver Module 2025.10:_ Separate document with `sets`, `modifiers`, `resolutionOrder`, `$ref` to multi-file sources — theming without duplicating entire trees.

_Legacy formats:_ Style Dictionary v3 `value`/`type`; Theo props + `{!alias}`; Tokens Studio single-file exports with parent keys requiring preprocess.

_CSS outputs:_ Custom properties on `:root` / `.dark` / `[data-theme]` / component scopes; Tailwind `@theme` / `@theme inline` mapping layers; optional SCSS variables (out of MVP for this product).

_Protobuf / MessagePack:_ Not used.

_Source:_ https://www.designtokens.org/tr/2025.10/ · https://www.designtokens.org/tr/2025.10/resolver/ · https://deepwiki.com/design-tokens/community-group/3.1.4-aliases-and-references

### System Interoperability Approaches

_Point-to-Point:_ Figma/Tokens Studio → JSON in Git → transform CLI → CSS import in app.

_API Gateway:_ Hosted design-system platforms acting as export hubs.

_Complement-not-replace:_ New CSS-focused library should **read** DTCG (and common legacy shapes) and optionally emit CSS that Style Dictionary or Terrazzo users could also produce — interoperability via **format**, not via embedding SD.

_Source:_ https://docs.tokens.studio/transform-tokens/style-dictionary · product brief differentiation table

### Microservices Integration Patterns

Not primary. Closest analogues: **pipeline stages** (parse → classify → resolve → emit → validate) as composable transforms, similar to Style Dictionary hooks (parser → preprocessor → transform → format → filter).

_Source:_ https://styledictionary.com/reference/config/

### Event-Driven Integration

_Publish-Subscribe:_ Token change PRs as the “event”; CI rebuilds CSS artifacts. Runtime token hot-reload is uncommon for design tokens (prefer build-time).

_Source:_ https://devcheolu.com/en/posts/0sa4JzPKHIoeWmwdx6Am

### Integration Security Patterns

_OAuth / API keys:_ Only for hosted exporters. For a local library: treat token JSON as trusted project content; still validate structure to avoid prototype-pollution footguns when merging deep objects; sanitize emitted CSS identifiers; do not `eval` token math expressions without a safe parser (Tokens Studio uses dedicated math transforms — mirror that caution).

_Source:_ https://github.com/Tokens-studio/sd-transforms · general secure parsing practice

---

## Architectural Patterns and Design

### System Architecture Patterns

Dominant pattern for token→code tools is a **pipeline / transform architecture**:

1. **Ingest** — load JSON files / objects; detect DTCG vs legacy keys  
2. **Normalize** — lift `$type` inheritance; strip Tokens Studio parent wrappers  
3. **Index** — flatten to path → token Map  
4. **Classify** — taxonomy heuristics (3-tier / CTI / EightShapes)  
5. **Resolve** — alias graph with cycle detection; optional preserve references for CSS `var()`  
6. **Emit** — CSS formats with naming transforms and file splitting  
7. **Validate** — broken refs, missing types, empty CSS identifiers  

Style Dictionary implements this as configurable platforms with transform groups. Terrazzo uses a **plugin-centric** API (CLI + `@terrazzo/plugin-css`). Theo used formatters over a props list.

For **tokens-to-css**, prefer Terrazzo’s clarity of DTCG-first + plugins, but keep Style Dictionary’s battle-tested concepts (outputReferences, filters, layered files) without multi-platform scope.

_Source:_ https://sujeet.pro/articles/design-tokens-and-theming · https://styledictionary.com/info/tokens/ · https://github.com/terrazzoapp/terrazzo/

### Design Principles and Best Practices

1. **Single source of truth in tokens; CSS is a projection.**  
2. **Three-tier semantics:** primitives → semantic aliases → component overrides (Intuit / industry practice).  
3. **Preserve alias relationships in CSS when theming** (`--color-text: var(--color-neutral-900)`) via `outputReferences`-style emission.  
4. **Classify by `$type` (DTCG), not by path position alone** — Style Dictionary v4 relaxed hard CTI coupling; CTI remains a naming heuristic.  
5. **Namespace collision avoidance** — EightShapes namespace levels; CSS prefix options.  
6. **Fail loud on cycles and dangling aliases.**

_Source:_ https://medium.com/@NateBaldwin/creating-a-flexible-design-token-taxonomy-for-intuits-design-system-81c8ff55c59b · https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676 · https://sujeet.pro/articles/design-tokens-and-theming

### Scalability and Performance Patterns

- Use **Map-keyed token indexes** for O(1) alias lookup (SD v5 `tokenMap` motivation; reports of small sets taking minutes before Map-based refactors).  
- Resolve aliases **after** multi-file merge (DTCG Resolver ordering → then aliases).  
- Expand composite tokens (typography, shadow) lazily or on opt-in.  
- Split CSS output by tier/theme to keep critical CSS small.  
- Cache analyze() results when watching files.

_Source:_ https://github.com/amzn/style-dictionary/pull/1397 · https://github.com/amzn/style-dictionary/pull/1427 · https://www.designtokens.org/tr/2025.10/resolver/

### Integration and Communication Patterns

- **Deep merge** of token trees by path with later sources winning (themes).  
- **Filters** by `filePath`, `$type`, or tier for multi-file CSS.  
- **Selector mapping** for modes (Terrazzo: modes → any CSS selector; Tailwind: `.dark` / `@custom-variant`).

_Source:_ https://terrazzo.app/docs/integrations/css · https://tailwindcss.com/docs/theme

### Security Architecture Patterns

- Pure functions; no network by default.  
- Optional allowlist for `$ref` / file includes (path confinement).  
- Identifier sanitization for CSS custom property names.

### Data Architecture Patterns

#### Taxonomy model A — 3-tier (primitive / semantic / component)

```
sys.color.blue.500          → primitive
semantic.color.action.primary → alias → primitive
comp.button.bg.default      → alias → semantic
```

Detection signals: top-level keys `sys|global|primitive|core`, `semantic|alias`, `comp|component`; alias edges pointing “up” the tier stack.

#### Taxonomy model B — CTI (Category-Type-Item)

Path-shaped: `color.background.button.primary` with category = color. Style Dictionary historically used `attribute/cti` transforms; v4+ prefers `$type` + flexible `name/kebab`.

#### Taxonomy model C — EightShapes (Namespace · Object · Base · Modifier)

- **Namespace:** system / theme / domain (`esds`, `acme`)  
- **Object:** component / element / group (`button`, `forms`)  
- **Base:** category · concept · property (`color-action-text`)  
- **Modifier:** variant · state · scale · mode (`primary-hover`)

Detection signals: explicit namespace prefix segments; object segments matching component vocabularies; trailing state/scale tokens (`hover`, `disabled`, `100`, `on-dark`).

_Source:_ https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676 · https://styledictionary.com/info/tokens/ · https://uxdesign.cc/how-to-name-tokens-in-a-design-system-5b218589dadc

### Deployment and Operations Architecture

Ship as npm package:

- `@scope/css-generator` — programmatic API (TypeScript)  
- CLI bin — `cssgen`  
- Peer: none required for MVP (zero SD dependency preferred for focused scope)

CI: `cssgen build -i tokens/**/*.json -o dist/css`.

---

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

| Strategy | Fit for tokens-to-css |
| --- | --- |
| Big-bang replace SD | Poor — users keep SD for native platforms |
| Complementary CSS lane | **Best** — analyze + CSS emit beside existing pipelines |
| Gradual DTCG migration | Provide converters (`value`→`$value`) like SD `convertToDTCG` |
| Theo migration | Document import of Theo-like props lists as secondary parser (low priority) |

_Source:_ product brief · https://styledictionary.com/info/dtcg/ · https://www.npmjs.com/package/@salesforce-ux/design-tokens

### Development Workflows and Tooling

Recommended stack:

- **Language:** TypeScript (strict), ESM  
- **Package exports:** `.` API, `./cli` optional  
- **Test:** Vitest + CSS snapshot fixtures spanning 3 taxonomies + DTCG aliases  
- **Lint:** ESLint + publint for export map  
- **Docs:** README recipes for `:root`, `.dark`, Tailwind `@theme` consumer wiring  

### Testing and Quality Assurance

Must-test matrix:

1. DTCG parse + `$type` inheritance  
2. Alias chains (depth ≥ 3) + cycle error  
3. `outputReferences` vs fully resolved CSS  
4. Multi-file merge order  
5. Taxonomy classifier confidence scores on fixtures  
6. Composite expand (typography → multiple CSS vars)  
7. Large fixture (5k–20k tokens) smoke perf budget  

### Deployment and Operations Practices

- Version CSS output stability carefully (semver; document naming transform defaults).  
- Provide `--dry-run` analyze-only mode for DS leads (brief secondary persona).  

### Team Organization and Skills

Solo / small team viable: DS familiarity + TypeScript + CSS custom properties expertise. No Figma plugin skill required for MVP.

### Cost Optimization and Resource Management

Zero infra cost as a library. Avoid depending on Style Dictionary if CSS-only — reduces dependency weight and config surface. Optionally document “escape hatch” to SD for multi-platform later.

### Risk Assessment and Mitigation

| Risk | Mitigation |
| --- | --- |
| DTCG 2025.10 still Community Final, not W3C Standard Track | Track Format + Resolver; feature-flag Resolver support |
| SD incomplete 2025.10 parity | Do not assume SD behavior == spec; test against official examples |
| Ambiguous taxonomy detection | Return confidence + allow user override (`--model=three-tier`) |
| Unsafe math / expression evaluation | Restrict or use proven parsers; resolve math pre-emit |
| CSS name collisions | Prefix option + collision report |
| Large token sets | Map index; stream file writes; benchmark early |
| Tailwind `@theme inline` dark-mode pitfalls | Document `:root`/`.dark` + non-inline `@theme` pattern |

_Source:_ https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ · https://styledictionary.com/info/dtcg/ · https://tomodahinata.com/en/blog/tailwind-css-v4-css-first-design-tokens-production-guide

## Technical Research Recommendations

### Implementation Roadmap

**Phase 0 — Foundations (MVP)**

1. DTCG parser (`$value`/`$type`/`$description`) + legacy key shim  
2. Token graph + alias resolver (cycles, dangling refs)  
3. CSS emitter: `:root` custom properties, kebab naming, optional `var()` references  
4. Taxonomy analyzer: heuristic report for 3-tier / CTI / EightShapes  
5. CLI: `analyze`, `build`  
6. Fixture suite from product vision (sys/semantic/comp color chains)

**Phase 1 — Theming & layering**

7. Multi-file merge + theme selectors (`.dark`, `[data-theme=…]`)  
8. Split outputs: `primitives.css`, `semantic.css`, `components.css`  
9. Optional Tailwind `@theme` mapping file  

**Phase 2 — Spec depth**

10. DTCG Resolver document support  
11. Composite types expand  
12. Color Module 4 / gamut down-conversion (learn from Terrazzo)

### Technology Stack Recommendations

- TypeScript ESM library + CLI  
- Zero required runtime deps initially; add `jsonc-parser` only if comments needed  
- Do **not** hard-depend on Style Dictionary or Terrazzo for MVP; stay interoperable via DTCG JSON  
- Publish types from `exports`

### Skill Development Requirements

- DTCG Format + Resolver reading  
- CSS custom properties cascading / specificity for themes  
- Graph algorithms (DFS cycle detect)

### Success Metrics and KPIs

- Alias resolution correctness on fixture suite = 100%  
- Taxonomy detection precision on labeled fixtures ≥ agreed threshold  
- Cold build of 10k tokens under negotiated budget (e.g. &lt; 2s on reference laptop)  
- Time-to-first-CSS for new user &lt; 15 minutes with docs  

---

# From JSON Tokens to Stylesheets: Comprehensive Design Token JSON → CSS Generation Technical Research

## Executive Summary

Design tokens are now standardized enough to build focused tooling on. The DTCG **Format Module 2025.10** (stable Community Final, 28 Oct 2025) defines vendor-neutral JSON with `$value` / `$type` / `$description` and `{alias.path}` references; the **Resolver Module 2025.10** standardizes multi-file theming. Reference implementations and adopters include Style Dictionary, Tokens Studio, Terrazzo, Penpot, Figma, Sketch, Framer, zeroheight, and others — with uneven feature completeness across tools.

Competitive analysis shows **Style Dictionary** as the multi-platform powerhouse (heavier for CSS-only), **Terrazzo** as the DTCG-native CSS-capable generator, **Tokens Studio + sd-transforms** as the design-to-code bridge, and **Theo** as legacy. None of these primarily sell **taxonomy detection** (3-tier / CTI / EightShapes) as a first-class product feature — that is the natural wedge for **tokens-to-css**.

**Key Technical Findings:**

- DTCG is stable enough for greenfield parsers; treat Resolver and full color composite support as phased.  
- Best CSS theming practice: emit semantic tokens as `var(--primitive-…)` references; override semantic layer per theme.  
- CTI is a naming heuristic, not a parser requirement; prefer `$type` + path heuristics.  
- Performance requires Map-based graphs; nested object walks do not scale.  
- Package as TypeScript ESM with dual CLI + programmatic API.

**Technical Recommendations:**

1. Build a **four-stage core**: Analyze → Normalize → Resolve → EmitCss.  
2. Target DTCG 2025.10 Format first; add Resolver in Phase 1.  
3. Default CSS emission to layered files + preserved references.  
4. Ship taxonomy reports with confidence scores and overrides.  
5. Stay dependency-light; interoperate via JSON, not by wrapping SD.

## Table of Contents

1. Technical Research Introduction and Methodology  
2. Technical Landscape and Architecture Analysis  
3. Implementation Approaches and Best Practices  
4. Technology Stack Evolution and Current Trends  
5. Integration and Interoperability Patterns  
6. Performance and Scalability Analysis  
7. Security and Compliance Considerations  
8. Strategic Technical Recommendations  
9. Implementation Roadmap and Risk Assessment  
10. Future Technical Outlook and Innovation Opportunities  
11. Technical Research Methodology and Source Verification  
12. Technical Appendices and Reference Materials  

## 1. Technical Research Introduction and Methodology

### Technical Research Significance

Teams no longer argue whether tokens matter — they argue how to get from heterogeneous JSON (Figma exports, Tokens Studio, hand-authored trees, legacy SD) to CSS that design systems can consume without losing semantic structure. With DTCG 2025.10, building a focused CSS generator is newly rational: the interchange format is stable, while full multi-platform suites remain overkill for many web-only pipelines.

_Technical Importance:_ Standards maturity + Tailwind v4 CSS-first theming increase demand for high-quality CSS custom property emission.  
_Business Impact (project):_ Faster DS engineer workflows; fewer ad-hoc scripts; clearer token architecture diagnostics.  
_Source:_ https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ · https://tailwindcss.com/docs/theme · product brief

### Technical Research Methodology

- **Technical Scope:** Libraries, standards, taxonomies, CSS emission, packaging, performance  
- **Data Sources:** DTCG specs, Style Dictionary / Terrazzo / Tokens Studio docs, EightShapes & Intuit taxonomy literature, npm/GitHub, practitioner guides (2025–2026)  
- **Analysis Framework:** Landscape → comparison → architecture patterns → MVP recommendation → risks  
- **Time Period:** Current as of 2026-07-26, with DTCG stable dated 2025-10  
- **Technical Depth:** Implementation-ready architecture guidance for `tokens-to-css`

### Technical Research Goals and Objectives

**Original Technical Goals:** (see frontmatter / scope confirmation)

**Achieved Technical Objectives:**

- Mapped DTCG + major transform tools with citations  
- Compared SD / Theo / Tokens Studio / Terrazzo on CSS, aliases, multi-file, theming  
- Documented detection patterns for 3-tier, CTI, EightShapes  
- Specified parse/resolve/emit architecture for MVP  
- Surfaced standards, packaging, and performance risks  

## 2. Design Token JSON → CSS Technical Landscape and Architecture Analysis

### Current Technical Architecture Patterns

_Dominant Patterns:_ Transform pipelines (SD); plugin emitters (Terrazzo); authoring→transform bridges (Tokens Studio).  
_Architectural Evolution:_ Proprietary YAML/JSON → DTCG draft → **2025.10 stable** + Resolver.  
_Architectural Trade-offs:_ Generality (SD) vs DTCG purity / ergonomics (Terrazzo) vs design sync (Tokens Studio) vs focused CSS + analysis (proposed library).  
_Source:_ https://www.designtokens.org/glossary/ · https://styledictionary.com/info/dtcg/ · https://github.com/terrazzoapp/terrazzo/

### Competitor / Reference Comparison

| Capability | Style Dictionary | Theo | Tokens Studio + sd-transforms | Terrazzo |
| --- | --- | --- | --- | --- |
| DTCG `$value/$type` | Yes (v4+); 2025.10 incomplete in v5 WIP | Legacy/non-primary | Via transforms / exports | Claims full 2025.10 |
| CSS custom properties | Strong (`css/variables`) | `custom-properties.css` | Via SD | `@terrazzo/plugin-css` |
| Alias `{path}` | Yes; `outputReferences` | `{!alias}` legacy | Needs registerTransforms | Yes |
| Multi-file | `source` globs + filters | `imports` | Sets / multi-file exports | Config + modes |
| Theming | Manual platforms/filters; Resolver TBD | Limited | Theme sets in TS | Modes → selectors |
| Taxonomy detection | Helpers for CTI attributes historically | Category meta | Naming in Figma | Not primary product |
| Scope | Multi-platform | Multi-format legacy | Design↔code | DTCG → code |
| Fit for CSS-only MVP | Heavy | Avoid for greenfield | Incomplete alone | Strong peer |

_Source:_ URLs in Appendix competitor list.

### System Design Principles and Best Practices

See Architectural Patterns section above (3-tier semantics, preserve references, `$type`-first classification, loud failures).

## 3. Implementation Approaches and Best Practices

### Current Implementation Methodologies

1. **Config-driven builds** (Style Dictionary `config.js/ts`)  
2. **Plugin configs** (Terrazzo `defineConfig`)  
3. **Code-first APIs** (construct dictionary → `buildAllPlatforms`)  

Recommended for new library: **code-first API with thin CLI**, optional config file later.

### Code Organization Patterns (recommended package)

```
packages/core/
  parse/          # DTCG + legacy
  graph/          # TokenMap, aliases
  analyze/        # taxonomy classifiers
  emit/css/       # formats: root, theme, layered, theme-map
  validate/
packages/cli/
```

### Quality Assurance Practices

Golden fixtures per taxonomy; alias fuzzing; CSS parse validation (e.g. ensure every line `var` target exists when `outputReferences` enabled).

### Implementation Framework and Tooling

TypeScript + Vitest + npm `bin`. Optional future: WASM parser — not needed for MVP.

## 4. Technology Stack Evolution and Current Trends

### Current Technology Stack Landscape

_Programming Languages:_ TypeScript/ESM  
_Frameworks and Libraries:_ SD, Terrazzo, sd-transforms  
_Storage:_ Git JSON  
_API and Communication:_ File-based DTCG; Resolver `$ref`  

### Technology Adoption Patterns

Industry moving to DTCG 2025.10 exports (e.g. zeroheight SD v5 migration). Tailwind v4 makes CSS variables / `@theme` the web consumption center of gravity.

_Source:_ https://help.zeroheight.com/hc/en-us/articles/48049028236187-Migrating-to-Style-Dictionary-v5-in-tokens-automation · https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/

## 5. Integration and Interoperability Patterns

### Current Integration Approaches

Design tool → DTCG JSON → transform → CSS → app/`@theme`.

### Interoperability Standards and Protocols

- Format Module 2025.10  
- Resolver Module 2025.10  
- Alias syntax `{a.b.c}` targeting referenced token `$value`  
- Emerging dual reference discussions (`$ref` / JSON Pointer) — monitor; MVP stick to curly-brace aliases  

_Source:_ https://www.designtokens.org/tr/2025.10/ · https://www.designtokens.org/tr/2025.10/resolver/ · https://github.com/design-tokens/community-group/pull/298

## 6. Performance and Scalability Analysis

### Performance Characteristics and Optimization

Historical pain: reference resolution over nested objects on large sets (community reports of multi-minute builds on &lt;100 tokens in pathological cases before Map work). SD response: `tokenMap`, faster expand, fixed reference regex aligned to DTCG.

### Scalability Patterns and Approaches

- Flatten once; resolve with memoization  
- Parallelize independent theme permutations after shared base resolve  
- Avoid cloning full trees per transform when possible  

_Source:_ https://github.com/amzn/style-dictionary/pull/1427 · https://github.com/amzn/style-dictionary/pull/1465

## 7. Security and Compliance Considerations

### Security Best Practices and Frameworks

Local transform trust model; confine file `$ref`; sanitize CSS names; safe expression evaluation.

### Compliance and Regulatory Considerations

No special regulatory regime for token JSON. Accessibility is a **token content** concern (contrast metadata in `$extensions`) — optional validation hooks later, not MVP blockers.  
_Source:_ https://www.humanstandards.org/code-design-tokens/css-json-tokens/

## 8. Strategic Technical Recommendations

### Technical Strategy and Decision Framework

**Top recommended architecture for tokens-to-css:**

> **Analyze-Normalize-Resolve-Emit (ANRE) pipeline** implemented as a TypeScript ESM library with CLI, DTCG-first parsers, Map-based token graph, pluggable taxonomy classifiers (3-tier / CTI / EightShapes), and CSS emitters that default to layered `:root` / theme-selector outputs with optional preserved `var()` references — **without** depending on Style Dictionary.

_Architecture Recommendations:_ ANRE + optional Resolver document support in Phase 1.  
_Technology Selection:_ TypeScript ESM; zero mandatory transform-framework dependency.  
_Implementation Strategy:_ Fixtures-first TDD against product-vision 3-tier color alias chains.

### Competitive Technical Advantage

Differentiation = **structure intelligence + CSS-only sharpness**, not multi-platform breadth. Interop via DTCG keeps the door open to coexist with SD/Terrazzo.

## 9. Implementation Roadmap and Risk Assessment

### Technical Implementation Framework

See Phase 0–2 roadmap above.

### Technical Risk Management

_Technical Risks:_ Spec drift (Community Final ≠ W3C Rec); incomplete peer tool parity confusing users; false taxonomy positives.  
_Implementation Risks:_ Scope creep into iOS/Android; Figma plugin distraction.  
_Business Impact Risks:_ Positioning against SD misunderstood as replacement — docs must say **complement**.

## 10. Future Technical Outlook and Innovation Opportunities

### Emerging Technology Trends

_Near-term (1–2y):_ Broad DTCG 2025.10 adoption; Resolver tooling; OKLCH default palettes.  
_Medium-term (3–5y):_ Possible consolidation of reference syntax (`$ref`/JSON Pointer); deeper design-tool round-trips.  
_Long-term:_ Tokens as programmable design graph with AI-assisted taxonomy cleanup (fits analyzer heritage).

### Innovation and Research Opportunities

- Auto-suggest tier promotions (primitive color used directly in components → recommend semantic)  
- CSS `@theme` emitter tuned for Tailwind v4 dark-mode correctness  
- Graph visualization export for DS leads  

## 11. Technical Research Methodology and Source Verification

### Comprehensive Technical Source Documentation

_Primary Technical Sources:_

- https://www.designtokens.org/tr/2025.10/  
- https://www.designtokens.org/tr/2025.10/resolver/  
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/  
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/  
- https://styledictionary.com/info/dtcg/  
- https://styledictionary.com/reference/config/  
- https://styledictionary.com/getting-started/using_the_npm_module/  
- https://terrazzo.app/docs/integrations/css  
- https://github.com/terrazzoapp/terrazzo/  
- https://github.com/Tokens-studio/sd-transforms  
- https://docs.tokens.studio/transform-tokens/style-dictionary  
- https://github.com/salesforce-ux/theo  
- https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676  
- https://sujeet.pro/articles/design-tokens-and-theming  
- https://tailwindcss.com/docs/theme  

_Secondary:_ Intuit taxonomy Medium article; UX Collective CTI+; zeroheight SD v5 migration; Salesforce `@salesforce-ux/design-tokens` npm readme; Dispersa Resolver docs; Human Standards CSS/JSON tokens guide.

_Technical Web Search Queries Used:_

- Design Tokens Community Group DTCG W3C format specification $value $type 2025 2026  
- Style Dictionary design tokens CSS custom properties transform DTCG  
- Tokens Studio transformer design tokens to CSS alias resolution  
- Salesforce Theo design tokens CSS deprecated alternative  
- design token taxonomy CTI Style Dictionary EightShapes naming primitives semantic component  
- Cobalt UI Terrazzo design tokens CSS generator alternatives Style Dictionary 2025  
- CSS custom properties design tokens @theme Tailwind dark mode layered theming  
- Nathan Curtis EightShapes naming tokens Namespace Object Base Modifier  
- style-dictionary TypeScript ESM CLI programmatic API packaging npm  
- DTCG design tokens alias reference multi-file theming modes 2025.10  
- Style Dictionary performance large token sets build time memory transitive references  

### Technical Research Quality Assurance

_Technical Source Verification:_ Critical claims (DTCG stable date, SD 2025.10 incomplete support, Terrazzo Cobalt rename, EightShapes levels) cross-checked across primary docs.  
_Technical Confidence Levels:_ High — standards announcement & major tool roles; Medium — exact SD 2025.10 gap list; Medium — perf absolute numbers (environment-specific).  
_Technical Limitations:_ No local benchmarks run in this research pass; Figma plugin internals not audited; Resolver adoption in SD not fully verified as complete.  
_Methodology Transparency:_ Non-interactive BMad technical research workflow steps 1–6; web search/fetch on 2026-07-26; product brief used as domain grounding.

## 12. Technical Appendices and Reference Materials

### Appendix A — DTCG Token Shape (illustrative)

```json
{
  "sys": {
    "color": {
      "$type": "color",
      "blue": {
        "500": { "$value": "#3b82f6", "$description": "Primitive blue 500" }
      }
    }
  },
  "semantic": {
    "color": {
      "action": {
        "primary": { "$value": "{sys.color.blue.500}", "$type": "color" }
      }
    }
  },
  "comp": {
    "button": {
      "bg": {
        "default": { "$value": "{semantic.color.action.primary}", "$type": "color" }
      }
    }
  }
}
```

### Appendix B — Example CSS Emission (preserved references)

```css
:root {
  --sys-color-blue-500: #3b82f6;
  --semantic-color-action-primary: var(--sys-color-blue-500);
  --comp-button-bg-default: var(--semantic-color-action-primary);
}

.dark {
  /* theme overrides typically replace semantic layer values */
  --semantic-color-action-primary: var(--sys-color-blue-300);
}
```

### Appendix C — Architectural Pattern Tables

| Pattern | Detect | Emit |
| --- | --- | --- |
| 3-tier | Top-level tier keys + alias direction | Split CSS files per tier |
| CTI | category-first paths + `$type` | `name/kebab` from path |
| EightShapes | namespace + object + base + modifier segments | Prefixed custom properties |

### Appendix D — Key Competitors / References (URLs)

- DTCG Format 2025.10: https://www.designtokens.org/tr/2025.10/  
- DTCG Resolver 2025.10: https://www.designtokens.org/tr/2025.10/resolver/  
- DTCG stable announcement: https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/  
- Style Dictionary DTCG: https://styledictionary.com/info/dtcg/  
- Style Dictionary: https://styledictionary.com/ · https://github.com/amzn/style-dictionary/  
- Terrazzo: https://terrazzo.app/ · https://github.com/terrazzoapp/terrazzo/  
- Terrazzo CSS plugin: https://terrazzo.app/docs/integrations/css  
- Tokens Studio SD transforms: https://github.com/Tokens-studio/sd-transforms · https://docs.tokens.studio/transform-tokens/style-dictionary  
- Theo: https://github.com/salesforce-ux/theo  
- EightShapes naming: https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676  
- Tailwind `@theme`: https://tailwindcss.com/docs/theme  
- Design Tokens glossary (translation tools): https://www.designtokens.org/glossary/  

### Technical Resources and References

_Technical Standards:_ DTCG Format + Resolver 2025.10; CSS Custom Properties; CSS Color Module 4; Tailwind theme variables.  
_Open Source Projects:_ style-dictionary, terrazzo, sd-transforms, theo (legacy).  
_Technical Communities:_ W3C Design Tokens CG GitHub https://github.com/design-tokens/community-group  

---

## Technical Research Conclusion

### Summary of Key Technical Findings

The token→CSS problem is standardized at the JSON layer (DTCG 2025.10) but still fragmented at the tooling layer. Multi-platform generators over-serve CSS-only teams; design-side tools under-serve structure analysis. A focused ANRE library with taxonomy fluency is technically feasible and strategically coherent with the product brief.

### Strategic Technical Impact Assessment

Proceeding with a TypeScript ESM library that prioritizes DTCG parsing, alias-correct CSS, and taxonomy reports positions `tokens-to-css` as a complementary specialist in a maturing ecosystem — not a SD clone.

### Next Steps Technical Recommendations

1. Author ADR adopting ANRE + DTCG-first.  
2. Build fixture pack (3-tier, CTI, EightShapes, legacy SD keys).  
3. Implement Resolve + EmitCss MVP; ship `analyze` CLI early for learning.  
4. Document coexistence with Style Dictionary / Terrazzo.  
5. Schedule Resolver support after Format parity tests pass.

---

**Technical Research Completion Date:** 2026-07-26  
**Research Period:** current comprehensive technical analysis  
**Document Length:** Comprehensive multi-section research  
**Source Verification:** Technical facts cited with current sources  
**Technical Confidence Level:** High for landscape and architecture recommendations — based on multiple authoritative sources; Medium where tool-to-spec parity is still evolving  

_This comprehensive technical research document serves as an authoritative technical reference on design token JSON to CSS generation libraries and architecture patterns and provides strategic technical insights for informed decision-making and implementation of tokens-to-css._
