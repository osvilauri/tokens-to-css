/**
 * The Fixture Corpus harness (AD-16, AD-17).
 *
 * The corpus is the primary test suite and the operational definition of SM-1,
 * so the harness itself is the load-bearing part: a runner that silently
 * discovers seven of nine fixtures gives a green CI with two cases unexecuted,
 * which is the only failure that would make SM-1 lie. Everything here fails
 * loudly rather than skipping.
 *
 * Layout, discovered by walking — there is no registration file:
 *
 *   fixtures/accept/<dialect>/<hierarchy>/{input.json,expected.css}
 *   fixtures/reject/<trigger>/{input.json,expected.json}
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Where the real corpus lives, relative to the repository root. */
export const CORPUS_ROOT = new URL('../../fixtures/', import.meta.url).pathname

/** An input that must convert, and the stylesheet it must produce byte for byte. */
export interface AcceptFixture {
  /** Path-derived name, e.g. `dtcg/three-tier`. */
  readonly id: string
  readonly dir: string
  readonly input: unknown
  readonly expectedCss: string
  readonly goldenPath: string
}

/** An input that must fail, and the failure it must produce. */
export interface RejectFixture {
  /** Path-derived name, e.g. `alias-cycle`. */
  readonly id: string
  readonly dir: string
  readonly input: unknown
  readonly expected: { readonly code: string; readonly tokenPaths?: readonly string[] }
}

export interface Corpus {
  readonly accept: readonly AcceptFixture[]
  readonly reject: readonly RejectFixture[]
}

/** Thrown when the corpus itself is malformed. Never swallowed, never skipped. */
export class CorpusError extends Error {
  override readonly name = 'CorpusError'
}

function read(dir: string, file: string): string {
  try {
    return readFileSync(join(dir, file), 'utf8')
  } catch {
    throw new CorpusError(`fixture "${dir}" is missing ${file}`)
  }
}

function readJson(dir: string, file: string): unknown {
  const raw = read(dir, file)
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new CorpusError(`fixture "${dir}" has invalid JSON in ${file}: ${(err as Error).message}`)
  }
}

/** Directories that contain a fixture, i.e. leaves holding an `input.json`. */
function leafDirs(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // the corpus root does not exist yet
    }
    if (entries.some((e) => e.isFile() && e.name === 'input.json')) {
      out.push(dir)
      return
    }
    for (const e of entries) if (e.isDirectory()) walk(join(dir, e.name))
  }
  walk(root)
  return out.sort()
}

/**
 * Reads the whole corpus from disk.
 *
 * @throws {CorpusError} If any fixture is incomplete or unparseable — a broken
 * fixture is a failing run, never a quietly smaller corpus.
 */
export function discover(root: string = CORPUS_ROOT): Corpus {
  const idOf = (dir: string, base: string): string =>
    relative(join(root, base), dir).split(sep).join('/')

  const accept = leafDirs(join(root, 'accept')).map((dir): AcceptFixture => ({
    id: idOf(dir, 'accept'),
    dir,
    input: readJson(dir, 'input.json'),
    expectedCss: read(dir, 'expected.css'),
    goldenPath: join(dir, 'expected.css'),
  }))

  const reject = leafDirs(join(root, 'reject')).map((dir): RejectFixture => {
    const expected = readJson(dir, 'expected.json') as RejectFixture['expected']
    if (typeof expected?.code !== 'string') {
      throw new CorpusError(`fixture "${dir}" has no "code" in expected.json`)
    }
    return { id: idOf(dir, 'reject'), dir, input: readJson(dir, 'input.json'), expected }
  })

  return { accept, reject }
}

export interface GoldenMismatch {
  /** 1-based line. Equal to the line count when only the file ending differs. */
  readonly line: number
  readonly expected: string
  readonly actual: string
}

/**
 * Splits into lines, dropping the empty element a trailing newline produces.
 * That element is an artifact of `split`, not a line, and reporting it as one
 * makes every truncation failure read as "expected content, got blank".
 */
function toLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.length > 1 && lines.at(-1) === '') lines.pop()
  return lines
}

const render = (lines: string[], i: number): string =>
  i >= lines.length ? '<end of file>' : lines[i] === '' ? '<empty line>' : lines[i]!

/**
 * Byte-exact comparison, reported by line so a failure is readable.
 *
 * Byte-exact means byte-exact: a missing trailing newline or a stray space at
 * the end of a line is a mismatch, because both change the emitted stylesheet
 * and both would drift silently under a lenient comparison.
 *
 * @returns `null` when the two are identical.
 */
export function compareGolden(actual: string, expected: string): GoldenMismatch | null {
  if (actual === expected) return null

  const a = toLines(actual)
  const e = toLines(expected)
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      return { line: i + 1, expected: render(e, i), actual: render(a, i) }
    }
  }

  // Every line matches but the text does not: the difference is at the very end
  // of the file — a trailing newline present on one side and not the other.
  return {
    line: a.length,
    expected: expected.endsWith('\n') ? '<file ends with a newline>' : '<file ends without a newline>',
    actual: actual.endsWith('\n') ? '<file ends with a newline>' : '<file ends without a newline>',
  }
}

/** Formats a mismatch for a test failure message. */
export function describeMismatch(id: string, m: GoldenMismatch): string {
  return `golden mismatch in "${id}" at line ${m.line}\n  expected: ${m.expected}\n  actual:   ${m.actual}`
}

/**
 * Whether goldens may be rewritten from actual output.
 *
 * Requires `UPDATE_GOLDEN=1` and refuses outright under CI. A run that rewrites
 * its own expectations proves nothing, so this is a guard rather than a
 * convention someone has to remember (AD-17).
 */
export function goldenUpdatesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env['CI']) return false
  return env['UPDATE_GOLDEN'] === '1'
}

/** Rewrites one golden. Only reachable when {@link goldenUpdatesAllowed} is true. */
export function writeGolden(fixture: AcceptFixture, css: string): void {
  if (!goldenUpdatesAllowed()) {
    throw new CorpusError('refusing to rewrite a golden: set UPDATE_GOLDEN=1, and never in CI')
  }
  writeFileSync(fixture.goldenPath, css, 'utf8')
}
