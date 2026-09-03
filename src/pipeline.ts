/**
 * The conversion pipeline (AD-1, AD-5, AD-6).
 *
 * Six stages, in one fixed order, sequenced only here. Reading and writing
 * happen at the two ends; everything between them is a pure function of what
 * the stage before it returned.
 *
 * Nothing touches the output path until the whole stylesheet exists in memory
 * and every check has passed. That is what makes "it failed" and "your previous
 * stylesheet is intact" the same sentence.
 */
import { emitStylesheet } from './emit/css.js'
import type { SkippedToken } from './errors.js'
import { DEFAULTS, type GenerateCssOptions, type GenerateCssResult } from './options.js'
import { normalizeDocument } from './dialects/registry.js'
import { parseTokenJson, readTokenFile } from './source/file.js'
import { fetchTokenDocument } from './source/http.js'
import { resolveOutputPath, resolveSource } from './source/resolve.js'
import { validateAliasGraph } from './validate/alias-graph.js'
import { validateNoCollisions } from './validate/collisions.js'
import { writeStylesheet } from './write/atomic.js'

/** A converted document: the stylesheet text, how many properties it declares, and what it left out. */
export interface Converted {
  readonly css: string
  readonly tokenCount: number
  readonly skipped: readonly SkippedToken[]
}

/**
 * Everything between reading and writing: detect, normalize, validate, emit.
 *
 * Exported so the fixture corpus exercises the real stage order rather than
 * re-implementing it. A corpus that sequenced the passes itself could stay green
 * while the pipeline ran them in a different order, which is precisely the
 * divergence the fixed order exists to prevent.
 */
export function convertDocument(raw: unknown, source: string): Converted {
  const { doc, skipped } = normalizeDocument(raw, source)

  // A fixed order, each pass exhaustive within its class (AD-5). Both run after
  // normalization, which is what makes a reference to a skipped token dangling
  // and fatal: skipping cannot quietly hollow out a token that survived (FR-24).
  validateAliasGraph(doc, source)
  validateNoCollisions(doc, source)

  return {
    css: emitStylesheet(doc, skipped, source),
    tokenCount: doc.tokens.length,
    skipped,
  }
}

export async function runConversion(
  source: string | URL,
  options: GenerateCssOptions = {},
): Promise<GenerateCssResult> {
  const display = String(source)
  const baseDir = options.baseDir ?? process.cwd()

  // 1. load — the only stage that cares where the document came from. Past
  // this line a URL and a path are the same thing: text (FR-1, post-load parity).
  const resolved = resolveSource(source, baseDir)
  const text =
    resolved.kind === 'url'
      ? await fetchTokenDocument(resolved.url, display, options.http ?? {})
      : await readTokenFile(resolved.path, display)
  const raw = parseTokenJson(text, display)

  // 2-5. detect, normalize, validate, emit — the complete stylesheet, in memory
  const { css, tokenCount, skipped } = convertDocument(raw, display)

  // 6. write — the first and only time the output path is opened
  const outputPath = resolveOutputPath(
    options.outDir ?? DEFAULTS.outDir,
    options.fileName ?? DEFAULTS.fileName,
    baseDir,
  )
  await writeStylesheet(outputPath, css, display)

  return { outputPath, tokenCount, skipped }
}
