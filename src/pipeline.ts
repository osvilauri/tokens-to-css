/**
 * The conversion pipeline (AD-1, AD-5, AD-6).
 *
 * Seven stages, in one fixed order, sequenced only here. Reading and writing
 * happen at the two ends; everything between them is a pure function of what
 * the stage before it returned.
 *
 * Nothing touches the output path until the whole stylesheet exists in memory
 * and every check has passed. That is what makes "it failed" and "your previous
 * stylesheet is intact" the same sentence.
 */
import { emitStylesheet } from './emit/css.js'
import { FailureCode, TokenCssError, type SkippedToken } from './errors.js'
import { DEFAULTS, type GenerateCssOptions, type GenerateCssResult } from './options.js'
import { mergeDocuments } from './merge/documents.js'
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

/** One parsed Token JSON document, and the source it came from as the caller wrote it. */
export interface RawDocument {
  readonly raw: unknown
  readonly source: string
}

/**
 * How a failure over the merged document names what it was converting.
 *
 * Bounded on purpose: a caller merging fifty-one files wants to know which
 * conversion failed, not to read fifty-one paths in an error message.
 */
function displayOf(inputs: readonly RawDocument[]): string {
  const first = inputs[0]?.source ?? '[]'
  return inputs.length <= 1 ? first : `${first} + ${inputs.length - 1} more`
}

/**
 * Everything between reading and writing: detect, normalize, merge, validate, emit.
 *
 * Exported so the fixture corpus exercises the real stage order rather than
 * re-implementing it. A corpus that sequenced the passes itself could stay green
 * while the pipeline ran them in a different order, which is precisely the
 * divergence the fixed order exists to prevent.
 *
 * @param inputs The parsed documents, in the order their sources were listed.
 */
export function convertDocuments(inputs: readonly RawDocument[]): Converted {
  if (inputs.length === 0) {
    throw new TokenCssError(
      'no Token Source was given: the list of sources is empty, so there is nothing to convert',
      { code: FailureCode.FORMAT_NOT_ALLOWED, source: '[]' },
    )
  }

  // Each document is detected and normalized on its own, which is what lets one
  // system mix dialects: detection is a question about a document, and by the
  // time the merge runs there are no dialects left to disagree (FR-27).
  const read = inputs.map((input) => normalizeDocument(input.raw, input.source))
  const doc = mergeDocuments(read.map((r) => r.doc))
  const skipped = read.flatMap((r) => r.skipped)
  const display = displayOf(inputs)

  // Asked once, over the merged document. A source whose every token was
  // skipped is not a failure when it is one of several — the question is
  // whether the *stylesheet* would declare nothing (FR-24, FR-27).
  if (doc.tokens.length === 0) {
    throw new TokenCssError(
      `every token that was read was skipped, so the stylesheet would declare nothing:\n` +
        skipped.map((skip) => `  ${skip.reason}`).join('\n'),
      {
        code: FailureCode.NOTHING_EMITTED,
        source: display,
        tokenPaths: skipped.map((skip) => skip.path),
      },
    )
  }

  // A fixed order, each pass exhaustive within its class (AD-5). Both run after
  // normalization and after the merge, which is what makes a reference to a
  // skipped token dangling and fatal (FR-24) and a cross-file reference
  // ordinary (FR-27).
  validateAliasGraph(doc, display)
  validateNoCollisions(doc, display)

  return {
    css: emitStylesheet(doc, skipped, display, inputs.map((input) => input.source)),
    tokenCount: doc.tokens.length,
    skipped,
  }
}

/** One document, converted. The single-source case of {@link convertDocuments}. */
export function convertDocument(raw: unknown, source: string): Converted {
  return convertDocuments([{ raw, source }])
}

export async function runConversion(
  source: string | URL | readonly (string | URL)[],
  options: GenerateCssOptions = {},
): Promise<GenerateCssResult> {
  const list = Array.isArray(source) ? (source as readonly (string | URL)[]) : [source as string | URL]
  const baseDir = options.baseDir ?? process.cwd()

  if (list.length === 0) {
    throw new TokenCssError(
      'no Token Source was given: the list of sources is empty, so there is nothing to convert',
      { code: FailureCode.FORMAT_NOT_ALLOWED, source: '[]' },
    )
  }

  // 1. load — the only stage that cares where a document came from. Past this
  // line a URL and a path are the same thing: text (FR-1, post-load parity).
  //
  // In list order, one at a time. Loading them concurrently would be faster and
  // would make *which* failure a caller sees depend on which response lost the
  // race; the first source that fails in the order the caller wrote is the one
  // worth reporting, and fifty-one local files parse in single-digit
  // milliseconds.
  const inputs: RawDocument[] = []
  const resolved: string[] = []
  for (const one of list) {
    const display = String(one)
    const where = resolveSource(one, baseDir)
    const text =
      where.kind === 'url'
        ? await fetchTokenDocument(where.url, display, options.http ?? {})
        : await readTokenFile(where.path, display)
    inputs.push({ raw: parseTokenJson(text, display), source: display })
    resolved.push(where.kind === 'url' ? where.url.href : where.path)
  }

  // 2-6. detect, normalize, merge, validate, emit — the complete stylesheet, in memory
  const { css, tokenCount, skipped } = convertDocuments(inputs)

  // 7. write — the first and only time the output path is opened
  const outputPath = resolveOutputPath(
    options.outDir ?? DEFAULTS.outDir,
    options.fileName ?? DEFAULTS.fileName,
    baseDir,
  )
  await writeStylesheet(outputPath, css, displayOf(inputs))

  return { outputPath, tokenCount, skipped, sources: resolved }
}
