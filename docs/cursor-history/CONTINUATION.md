# Punto de continuación — css_generator_library

> Estado capturado el 2026-08-27 a partir del historial de Cursor exportado en esta carpeta.

## Dónde quedó el proyecto

Fase: **planificación BMAD**, entre PRD y arquitectura. No hay código todavía — solo artefactos en `_bmad-output/planning-artifacts/`.

Cadena de trabajo hecha:

1. **Brief** — `_bmad-output/planning-artifacts/briefs/brief-css_generator_library-2026-07-26/brief.md` (+ `addendum.md`, `.memlog.md`)
2. **Technical research** — `_bmad-output/planning-artifacts/research/technical-design-token-json-to-css-generation-research-2026-07-26.md`
3. **PRD** — `_bmad-output/planning-artifacts/prds/prd-css_generator_library-2026-08-06/prd.md`, con `addendum.md`, `reconcile-brief.md`, `reconcile-research.md`, `.memlog.md` (41 entradas de decisiones)
4. **Reviews del PRD** — `review-rubric.md` y `review-adversarial-general.md` (ejecutados en paralelo el 2026-08-07)

## Estado del gate de revisión — RESUELTO (2026-08-27)

El gate que había quedado abierto (4 critical + 6 high del rubric y del adversarial review) fue dispuesto aceptando el paquete recomendado: **C1A · C2A · C3A · C4A · H1B · H2 · H3 · H4A · H5 · H6**, más los medium/low mecánicos.

`prd.md` se reescribió (v2, 450 líneas) e incluye una **§13 Review Disposition** con la tabla completa de qué se aplicó y qué se rechazó explícitamente. `addendum.md` recogió las consecuencias de arquitectura; los dos `reconcile-*.md` llevan nota de supersesión; el `.memlog.md` registra las 13 decisiones nuevas. La versión previa quedó en `prd.md.pre-review-bak`.

Cambios de fondo en el PRD:

- **Format Allowlist (V1)** explícita (§4.2.0) con precedencia de detección y contrato de Fixture Corpus accept/reject — FR-14 ya no es circular.
- Vocabulario partido: **Alias Graph Validation** (ciclos, dangling) nunca significa aplanar; **Reference Emission** siempre `var(--…)`.
- Nuevos FRs fail-clear: FR-19 (fallo de escritura), FR-20 (composites rechazados), FR-21 (colisión de nombres), FR-22 (dangling alias). FR-5/6/7 **retirados** (IDs no reutilizables).
- Regla de naming normativa y declarada semver-pública; códigos de fallo estables como superficie pública; escritura atómica; mínimos de seguridad de URL en el PRD.
- JTBD reescrito: el thin wrapper del Main Entry es esperado en v1.

### Abierto ahora

| OQ | Tema | Dueño |
|---|---|---|
| OQ-1 | Congelar el Fixture Corpus (contenido, layout, protocolo de golden files) — SM-1 no gatea hasta que exista | arquitectura |
| OQ-2 | Confirmar el bar de performance SM-5 (10k tokens < 2s) o medirlo | arquitectura + PM |
| OQ-3 | Nombre del paquete npm y licencia (asumido MIT) antes de publicar | PM |

**Siguiente paso:** `bmad-architecture` — con OQ-1 y OQ-2 como entregables suyos.

## Decisiones ya cerradas (no reabrir sin motivo)

- Runtime V1: **Node/TypeScript only**, sin browser.
- **Sin CLI de conversión** en V1 — solo instalación del package; la conversión va por Main Entry `(tokenSource, options?)` → escribe el Styles File.
- Styles File V1: custom properties en `:root`, aliases preservados como `var(--…)`, filename por defecto `tokens.css`, crea `assets/css/` si no existe.
- Formatos V1: DTCG + jerarquías 3-tier, CTI, EightShapes-like, **más dialectos vendor** (wrappers de Tokens Studio y Style Dictionary legacy `value`/`type`).
- Sin configurar prefix de custom properties en V1.
- Fallos claros (nunca Styles File vacío silencioso): source inaccesible/faltante, JSON inválido, formato no soportado, ciclo de aliases.
- Versionado semver, sin breaking changes en minor. URL fetch = NFR genérico de seguridad, detalle en arquitectura.
- Fuera de MVP: mixins, CLI convert, iOS/Android, plugin de Figma, emitters SCSS/JS; no reemplaza Style Dictionary.
- Diferido a post-v1/arquitectura: ingest en memoria, merge multi-archivo, reporte de confianza de taxonomía, CSS por capas de tema/`@theme`, CLI de conversión.
- SM-2 se mide con checklist de onboarding scriptado.

## Cómo leer el historial

Ver [README.md](README.md) para el índice completo. La conversación principal es [css-generation-research-briefs--db968ffb.md](css-generation-research-briefs--db968ffb.md) (224 mensajes); los JSON íntegros están en [`raw/`](raw/).
