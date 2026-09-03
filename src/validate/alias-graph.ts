/**
 * Alias Graph Validation (FR-15, FR-22, AD-5).
 *
 * This checks that the reference graph is sound. It never resolves anything:
 * "validate" here means *the edges make sense*, not *replace the edge with the
 * value it points at*. Emission keeps every reference as `var(--target)`.
 *
 * Two passes, in a fixed order, each exhaustive within its class. Dangling runs
 * first — running cycle detection over a graph with missing nodes reports
 * confusing half-cycles, and a developer with a typo should be told about the
 * typo rather than about a loop that only exists because of it.
 *
 * A token has as many outgoing edges as its value has references: none for a
 * literal, one for an alias, and one per aliased sub-value for a composite
 * (FR-25). Both passes read those edges through `referencesOf`, so neither
 * needs to know which kind of value produced them.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath, referencesOf, type TokenDoc, type TokenNode } from '../model/index.js'

/** Every token this one points at, as dotted paths, in order. */
function targetsOf(node: TokenNode): string[] {
  return referencesOf(node.value).map((r) => formatPath(r.path))
}

/**
 * Reports every reference whose target is not a token in this document.
 *
 * A reference to a *group* is reported differently from a reference to nothing
 * at all: seeing "color.brand does not exist" when `color.brand` is visibly
 * there in the file is the kind of message that sends people to read library
 * source.
 */
function checkDangling(doc: TokenDoc, byPath: Map<string, TokenNode>, source: string): void {
  const problems: string[] = []
  const offenders: string[] = []

  for (const node of doc.tokens) {
    const from = formatPath(node.path)
    for (const target of targetsOf(node)) {
      if (byPath.has(target)) continue

      // A composite can point nowhere more than once; each is reported, and the
      // token is named once however many of its sub-values are broken.
      if (!offenders.includes(from)) offenders.push(from)

      const isGroup = [...byPath.keys()].some((known) => known.startsWith(`${target}.`))
      problems.push(
        isGroup
          ? `"${from}" references "${target}", which is a group of tokens rather than a token`
          : `"${from}" references "${target}", which does not exist`,
      )
    }
  }

  if (problems.length > 0) {
    throw new TokenCssError(
      `${problems.length} ${problems.length === 1 ? 'reference points' : 'references point'} ` +
        `nowhere:\n  ${problems.join('\n  ')}`,
      { code: FailureCode.ALIAS_DANGLING, source, tokenPaths: offenders },
    )
  }
}

const UNVISITED = 0
const ON_PATH = 1
const SETTLED = 2

/**
 * Reports every cycle in the reference graph.
 *
 * Depth-first with three colours: a node still on the current path that is
 * reached again closes a cycle. This replaced a linear sweep when composites
 * arrived — the sweep followed one edge per token, which is correct only while
 * a token can make at most one reference, and a composite makes several.
 *
 * Iterative rather than recursive: a document is allowed to be a chain of ten
 * thousand tokens, and that is a stack overflow rather than a clear failure if
 * this walks itself.
 */
function checkCycles(doc: TokenDoc, byPath: Map<string, TokenNode>, source: string): void {
  const state = new Map<string, number>()
  const cycles: string[][] = []
  const seen = new Set<string>()

  for (const start of doc.tokens) {
    const startKey = formatPath(start.path)
    if ((state.get(startKey) ?? UNVISITED) !== UNVISITED) continue

    // `path` is the chain of nodes currently being explored; `frames` holds, for
    // each of them, the edges not yet followed.
    const path: string[] = [startKey]
    const frames: string[][] = [[...targetsOf(byPath.get(startKey)!)].reverse()]
    state.set(startKey, ON_PATH)

    while (path.length > 0) {
      const edges = frames[frames.length - 1]!
      const next = edges.pop()

      if (next === undefined) {
        state.set(path.pop()!, SETTLED)
        frames.pop()
        continue
      }

      // Dangling ran first, so every target exists; this is belt and braces.
      const node = byPath.get(next)
      if (node === undefined) continue

      if (state.get(next) === ON_PATH) {
        const cycle = path.slice(path.indexOf(next))
        // One cycle can be met from several entry points. Recording it by its
        // members rather than by its starting node keeps it reported once.
        const key = [...cycle].sort().join('\u0000')
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push(cycle)
        }
        continue
      }
      if (state.get(next) === SETTLED) continue

      state.set(next, ON_PATH)
      path.push(next)
      frames.push([...targetsOf(node)].reverse())
    }
  }

  if (cycles.length > 0) {
    const described = cycles.map((cycle) => `  ${[...cycle, cycle[0]!].join(' → ')}`)
    throw new TokenCssError(
      `${cycles.length} alias cycle${cycles.length === 1 ? '' : 's'} found:\n` + described.join('\n'),
      { code: FailureCode.ALIAS_CYCLE, source, tokenPaths: cycles.flat() },
    )
  }
}

/**
 * Validates the whole reference graph.
 *
 * @throws {TokenCssError} `ALIAS_DANGLING` or `ALIAS_CYCLE`, each listing every
 * offender of its class so one run tells the developer everything of that kind
 * that is wrong.
 */
export function validateAliasGraph(doc: TokenDoc, source: string): void {
  const byPath = new Map<string, TokenNode>()
  for (const node of doc.tokens) byPath.set(formatPath(node.path), node)

  checkDangling(doc, byPath, source)
  checkCycles(doc, byPath, source)
}
