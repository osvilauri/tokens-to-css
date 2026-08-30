# Extract research for PRD

- **Composer ID:** `8307da8a-3d79-4d49-822d-508e191cf9ae`
- **Creado:** 2026-08-06 11:27
- **Última actualización:** None
- **Mensajes:** 12

---

## 👤 Usuario — 2026-08-06T15:27:58.670Z

Extract technical/product requirements signal from this research doc for a PRD author. Do NOT rewrite a PRD or invent requirements. Return ONLY a compact digest in Spanish (technical terms in English OK).

File: /Users/macbook/my_personal_projects/css_generator_library/_bmad-output/planning-artifacts/research/technical-design-token-json-to-css-generation-research-2026-07-26.md

Extract:
1. JSON token format types / ecosystems covered (names + brief what they are)
2. What "convert to CSS" means in this research (outputs: custom properties, classes, etc.)
3. Recommended capabilities for a library
4. Explicit non-goals / deferred items (especially mixins)
5. Competitive/comparable tools mentioned
6. Risks, edge cases, standards (DTCG, Style Dictionary, etc.)
7. Anything that belongs in architecture addendum vs product PRD
8. Gaps the PRD still needs the PM to decide

Keep under ~500 words. Be faithful to the source.

### 🤖 Asistente

<details><summary>razonamiento</summary>

I am extracting technical and product requirements signals from the research document to compile a compact digest for the PRD author.

</details>


### 🤖 Asistente

I'll extract a faithful requirements digest from the research doc—reading it now and pulling only what's stated there.

### 🤖 Asistente

**🔧 tool: `update_current_step`**

```json
{"currentStep":"Extracting research requirements"}
```


### 🤖 Asistente

**🔧 tool: `read_file_v2`**

```json
{"path":"/Users/macbook/my_personal_projects/css_generator_library/_bmad-output/planning-artifacts/research/technical-design-token-json-to-css-generation-research-2026-07-26.md"}
```

<details><summary>resultado</summary>

```
{"contents":"","totalLinesInFile":807}
```

</details>


### 🤖 Asistente

<details><summary>razonamiento</summary>

Mixins are explicitly deferred as non-goals. This aligns with the user's specific request to extract those constraints.

The research document contains no explicit mention of mixins. Deferred non-goals include SCSS variables, Theo migration, multi-platform support, Figma plugins, and replacing Style Dictionary.

Phase 1 covers DTCG Resolver. Composite types and color gamut expand to Phase 2. Accessibility contrast validation is deferred. WASM parser is out of scope. Optional CommonJS interop is conditional. Analytics on unused tokens and embedding Style Dictionary are deferred. The MVP will use curly-brace aliases instead of dual reference syntax.

I will separate architecture addendum items from product PRD requirements. I will flag any remaining gaps that the product manager must decide. The response stays faithful to the source and avoids inventing requirements.

</details>


### 🤖 Asistente

Confirmando si el brief menciona mixins (el research lo cita como input); el digest se limita a lo que el research afirma.

### 🤖 Asistente

**🔧 tool: `ripgrep_raw_search`**

```json
{"pattern":"mixin","path":"/Users/macbook/my_personal_projects/css_generator_library/_bmad-output/planning-artifacts","caseInsensitive":true,"multiline":false,"toolCallId":"call-b299582a-ea4c-4921-bcb7-421332b6522d-2\nfc_853d7f0d-e78c-991b-941f-a32b7f2c6d34_0","offset":0}
```


### 🤖 Asistente

**🔧 tool: `update_current_step`**

```json
{"currentStep":"Drafting Spanish digest","finalSummary":"Digest listo (~500 palabras): formatos/ecosistemas DTCG y legacy, outputs CSS (:root, themes, @theme), capacidades ANRE recomendadas, non-goals explícitos (mixins no aparecen en el research), competencia, riesgos/estándares, qué va a arquitectura vs PRD, y decisiones abiertas para el PM.","completedSubtitle":"Extracted Spanish requirements digest"}
```


### 🤖 Asistente

<details><summary>razonamiento</summary>

The planning artifacts contain no mention of mixins.

</details>


### 🤖 Asistente

# Digest de señal — research JSON→CSS (2026-07-26)

*Solo lo que el research afirma. **Mixins:** no aparecen en este doc ni en planning artifacts.*

### 1. Formatos / ecosistemas
- **DTCG Format 2025.10** — JSON estable: `$value` (req.), `$type`/`$description`/`$extensions`/`$deprecated`; aliases `{path.to.token}`; herencia `$type` en grupos.
- **DTCG Resolver 2025.10** — theming multi-file: `sets`, `modifiers`, `resolutionOrder`, `$ref`.
- **Legacy SD v3** — `value`/`type` sin `$`.
- **Theo** — YAML/JSON; aliases `{!name}` (legacy).
- **Tokens Studio** — exports con wrappers a preprocessar; bridge vía `@tokens-studio/sd-transforms`.
- Taxonomías de naming (no formatos JSON): **3-tier**, **CTI**, **EightShapes**.

### 2. Qué significa “convert to CSS”
Emisión de **CSS custom properties** en `:root`, selectores de tema (`.dark`, `[data-theme]`), scopes de componente; archivos layered; opcional **Tailwind `@theme` / `@theme inline`**. Preferencia: preservar refs como `var(--…)` (`outputReferences`). **SCSS variables: fuera de MVP.** No implica multi-platform ni clases de utilidad genéricas.

### 3. Capacidades recomendadas (MVP→fases)
Pipeline **ANRE**: Analyze → Normalize → Resolve → EmitCss. API: `analyze` / `resolve` / `emitCss` + CLI `cssgen analyze|build`. DTCG-first + shim legacy; grafo Map + ciclos/dangling; taxonomy report (3-tier/CTI/EightShapes) con confidence + override; kebab naming; prefix/collisions. Fase 1: multi-file, theme selectors, split por tier, `@theme` opcional. Fase 2: Resolver, composites, Color Module 4. TS ESM; **sin dependencia dura de SD/Terrazzo**.

### 4. Non-goals / diferidos
No reemplazar SD; coexistir vía DTCG. Evitar Theo en greenfield; parser Theo = baja prioridad. No Figma plugin / iOS-Android. Resolver, composites, gamut = post-MVP. Math: no `eval` inseguro. A11y contrast = hooks opcionales. `$ref`/JSON Pointer: monitorear; MVP = curly aliases. **Mixins: no mencionados.**

### 5. Competencia / peers
Style Dictionary, Terrazzo (ex-Cobalt), Tokens Studio + sd-transforms, Theo (legacy). También: Dispersa, SD Configurator, zeroheight, Specify, Supernova; adopters DTCG (Penpot, Figma, Sketch, Framer).

### 6. Riesgos / edge cases / estándares
DTCG = Community Final ≠ W3C Rec; SD 2025.10 incompleto. Taxonomy ambigua → confidence + `--model`. Collisions CSS; perf en sets grandes (Map); pitfalls `@theme inline` dark. Seguridad: confinar `$ref`, sanitizar identifiers. CTI = heurística; clasificar por `$type`.

### 7. Arquitectura addendum vs PRD producto
**Arquitectura:** ANRE, Map graph, packaging ESM/CLI, filtros, merge, naming transforms, perf, seguridad de parse, fixture/TDD, ADR DTCG-first.  
**PRD:** value prop “analyze-then-generate”, complement vs replace SD, personas, outcomes CSS, taxonomías como feature, fases MVP, coexistencia SD/Terrazzo, KPI (p.ej. time-to-first-CSS).

### 8. Decisiones abiertas para el PM
Umbral de precisión taxonomy; budget perf 10k tokens; alcance `@theme` en MVP vs Fase 1; profundidad legacy (SD v3 / Theo / Tokens Studio); feature-flag Resolver; semver de naming defaults; packaging scope/nombre; si “complement lane” es positioning canónico; convertidores `value`→`$value` in-scope MVP.
