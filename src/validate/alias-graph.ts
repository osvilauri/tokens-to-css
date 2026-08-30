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
 * Every token has at most one outgoing edge — a value is either a literal or a
 * single reference — so the graph is a chain per token, and one linear sweep
 * finds every cycle.
 */
import { FailureCode, TokenCssError } from '../errors.js'
import { formatPath, isRef, type TokenDoc, type TokenNode } from '../model/index.js'

/** Where a token's reference points, or `undefined` when it holds a literal. */
function targetOf(node: TokenNode): string | undefined {
  return isRef(node.value) ? formatPath(node.value.path) : undefined
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
    const target = targetOf(node)
    if (target === undefined || byPath.has(target)) continue

    const from = formatPath(node.path)
    offenders.push(from)

    const isGroup = [...byPath.keys()].some((known) => known.startsWith(`${target}.`))
    problems.push(
      isGroup
        ? `"${from}" references "${target}", which is a group of tokens rather than a token`
        : `"${from}" references "${target}", which does not exist`,
    )
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
 * Iterative rather than recursive: a document is allowed to be a chain of ten
 * thousand tokens, and that is a stack overflow rather than a clear failure if
 * this walks itself.
 */
function checkCycles(doc: TokenDoc, byPath: Map<string, TokenNode>, source: string): void {
  const state = new Map<string, number>()
  const cycles: string[][] = []

  for (const start of doc.tokens) {
    const startKey = formatPath(start.path)
    if (state.get(startKey) !== undefined) continue

    const chain: string[] = []
    let cursor: string | undefined = startKey

    while (cursor !== undefined && (state.get(cursor) ?? UNVISITED) === UNVISITED) {
      state.set(cursor, ON_PATH)
      chain.push(cursor)
      const node = byPath.get(cursor)
      cursor = node === undefined ? undefined : targetOf(node)
    }

    if (cursor !== undefined && state.get(cursor) === ON_PATH) {
      cycles.push(chain.slice(chain.indexOf(cursor)))
    }
    for (const key of chain) state.set(key, SETTLED)
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
