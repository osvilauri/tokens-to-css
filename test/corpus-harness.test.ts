import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CorpusError,
  compareGolden,
  describeMismatch,
  discover,
  goldenUpdatesAllowed,
  writeGolden,
} from './support/corpus.js'

/**
 * The harness is proved against synthetic fixtures in a temp directory, not
 * against the real corpus — which is empty at this point in the epic. A checker
 * exercised only on an empty tree passes for the wrong reason, and keeps passing
 * once the tree is full.
 */
let root: string

const accept = (id: string, input: string, css: string): void => {
  const dir = join(root, 'accept', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'input.json'), input)
  writeFileSync(join(dir, 'expected.css'), css)
}

const reject = (id: string, input: string, expected: string): void => {
  const dir = join(root, 'reject', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'input.json'), input)
  writeFileSync(join(dir, 'expected.json'), expected)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'corpus-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('discovery', () => {
  it('finds fixtures by walking, with no registration file', () => {
    accept('dtcg/three-tier', '{"a":1}', ':root{}\n')
    accept('sd-legacy/cti', '{"b":2}', ':root{}\n')
    reject('alias-cycle', '{"c":3}', '{"code":"ALIAS_CYCLE"}')

    const corpus = discover(root)
    expect(corpus.accept.map((f) => f.id)).toEqual(['dtcg/three-tier', 'sd-legacy/cti'])
    expect(corpus.reject.map((f) => f.id)).toEqual(['alias-cycle'])
  })

  it('names fixtures by their path, so dialect and hierarchy are readable', () => {
    accept('tokens-studio/eightshapes', '{}', '')
    expect(discover(root).accept[0]!.id).toBe('tokens-studio/eightshapes')
  })

  it('parses the input and carries the golden text', () => {
    accept('dtcg/three-tier', '{"color":{"red":"#f00"}}', ':root {\n  --color-red: #f00;\n}\n')
    const f = discover(root).accept[0]!
    expect(f.input).toEqual({ color: { red: '#f00' } })
    expect(f.expectedCss).toContain('--color-red')
  })

  it('returns an empty corpus rather than throwing when nothing exists yet', () => {
    expect(discover(root)).toEqual({ accept: [], reject: [] })
  })

  it('is deterministic in order, so failures are reproducible', () => {
    accept('b/x', '{}', '')
    accept('a/y', '{}', '')
    expect(discover(root).accept.map((f) => f.id)).toEqual(['a/y', 'b/x'])
  })
})

describe('a malformed fixture fails the run — it is never skipped', () => {
  it('names the directory when expected.css is missing', () => {
    const dir = join(root, 'accept', 'dtcg/broken')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'input.json'), '{}')

    expect(() => discover(root)).toThrow(CorpusError)
    expect(() => discover(root)).toThrow(/dtcg\/broken.*missing expected\.css/s)
  })

  it('names the directory when the fixture input is not valid JSON', () => {
    accept('dtcg/bad-json', '{ not json', ':root{}\n')
    expect(() => discover(root)).toThrow(/dtcg\/bad-json.*invalid JSON in input\.json/s)
  })

  it('names the directory when a reject fixture declares no code', () => {
    reject('nameless', '{}', '{"note":"forgot the code"}')
    expect(() => discover(root)).toThrow(/nameless.*no "code"/s)
  })

  it('names the directory when expected.json is unparseable', () => {
    reject('bad-expectation', '{}', '{oops')
    expect(() => discover(root)).toThrow(/bad-expectation.*invalid JSON in expected\.json/s)
  })
})

describe('golden comparison is byte-exact', () => {
  it('passes on identical text', () => {
    expect(compareGolden(':root {\n  --a: 1;\n}\n', ':root {\n  --a: 1;\n}\n')).toBeNull()
  })

  it('fails on a single differing byte and points at the line', () => {
    const m = compareGolden(':root {\n  --a: 1;\n}\n', ':root {\n  --a: 2;\n}\n')
    expect(m).not.toBeNull()
    expect(m!.line).toBe(2)
    expect(m!.actual).toBe('  --a: 1;')
    expect(m!.expected).toBe('  --a: 2;')
  })

  it('fails on a missing trailing newline, and says so', () => {
    const m = compareGolden(':root {}', ':root {}\n')
    expect(m).not.toBeNull()
    expect(m!.expected).toBe('<file ends with a newline>')
    expect(m!.actual).toBe('<file ends without a newline>')
  })

  it('fails on trailing whitespace, which a lenient comparison would hide', () => {
    expect(compareGolden('--a: 1; \n', '--a: 1;\n')).not.toBeNull()
  })

  it('reports a truncated file rather than passing on a prefix', () => {
    const m = compareGolden(':root {\n', ':root {\n  --a: 1;\n}\n')
    expect(m!.line).toBe(2)
    expect(m!.actual).toBe('<end of file>')
    expect(m!.expected).toBe('  --a: 1;')
  })

  it('distinguishes an empty line from a missing one', () => {
    const m = compareGolden('a\n\nb\n', 'a\nX\nb\n')
    expect(m!.actual).toBe('<empty line>')
  })

  it('produces a message that names the fixture and the line', () => {
    const m = compareGolden('a\nX\n', 'a\nb\n')!
    expect(describeMismatch('dtcg/three-tier', m)).toContain('dtcg/three-tier')
    expect(describeMismatch('dtcg/three-tier', m)).toContain('line 2')
  })
})

describe('goldens are only rewritten on purpose (AD-17)', () => {
  it('refuses by default', () => {
    expect(goldenUpdatesAllowed({})).toBe(false)
  })

  it('allows it with UPDATE_GOLDEN=1', () => {
    expect(goldenUpdatesAllowed({ UPDATE_GOLDEN: '1' })).toBe(true)
  })

  it('refuses under CI even when UPDATE_GOLDEN is set', () => {
    expect(goldenUpdatesAllowed({ UPDATE_GOLDEN: '1', CI: 'true' })).toBe(false)
  })

  it('ignores values other than 1, so a stray export does not rewrite the corpus', () => {
    expect(goldenUpdatesAllowed({ UPDATE_GOLDEN: 'true' })).toBe(false)
    expect(goldenUpdatesAllowed({ UPDATE_GOLDEN: '' })).toBe(false)
  })

  it('throws rather than writing when updates are not allowed', () => {
    accept('dtcg/x', '{}', 'old\n')
    const fixture = discover(root).accept[0]!
    delete process.env['UPDATE_GOLDEN']
    expect(() => writeGolden(fixture, 'new\n')).toThrow(/refusing to rewrite a golden/)
    expect(readFileSync(fixture.goldenPath, 'utf8')).toBe('old\n')
  })

  it('rewrites the golden when explicitly asked', () => {
    accept('dtcg/x', '{}', 'old\n')
    const fixture = discover(root).accept[0]!
    process.env['UPDATE_GOLDEN'] = '1'
    delete process.env['CI']
    try {
      writeGolden(fixture, 'new\n')
      expect(readFileSync(fixture.goldenPath, 'utf8')).toBe('new\n')
    } finally {
      delete process.env['UPDATE_GOLDEN']
    }
  })
})
