import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FailureCode, TokenCssError, generateCss } from '../src/index.js'

let base: string

const write = (name: string, contents: string): string => {
  const path = join(base, name)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, contents)
  return path
}

const CATALOGUE = JSON.stringify({
  color: {
    brand: { primary: { $value: '#5A4FCF', $type: 'color' } },
    text: { accent: { $value: '{color.brand.primary}' } },
  },
  spacing: { md: { $value: '16px' } },
})

const failure = async (run: () => Promise<unknown>): Promise<TokenCssError> => {
  try {
    await run()
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this conversion to fail')
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'e2e-'))
})
afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('a successful conversion', () => {
  it('writes assets/css/tokens.css and reports where and how much', async () => {
    write('design/tokens.json', CATALOGUE)
    const result = await generateCss('design/tokens.json', { baseDir: base })

    expect(result.outputPath).toBe(join(base, 'assets/css/tokens.css'))
    expect(result.tokenCount).toBe(3)
    expect(readFileSync(result.outputPath, 'utf8')).toBe(
      ':root {\n' +
        '  --color-brand-primary: #5A4FCF;\n' +
        '  --color-text-accent: var(--color-brand-primary);\n' +
        '  --spacing-md: 16px;\n' +
        '}\n',
    )
  })

  it('creates the output directory when it does not exist', async () => {
    write('t.json', CATALOGUE)
    await generateCss('t.json', { baseDir: base })
    expect(readdirSync(join(base, 'assets/css'))).toEqual(['tokens.css'])
  })

  it('honours a custom directory and filename', async () => {
    write('t.json', CATALOGUE)
    const result = await generateCss('t.json', {
      baseDir: base,
      outDir: 'public/styles',
      fileName: 'design-tokens.css',
    })
    expect(result.outputPath).toBe(join(base, 'public/styles/design-tokens.css'))
    expect(readFileSync(result.outputPath, 'utf8')).toContain('--spacing-md')
  })

  it('accepts an absolute source path', async () => {
    const path = write('t.json', CATALOGUE)
    const result = await generateCss(path, { baseDir: base })
    expect(result.tokenCount).toBe(3)
  })

  it('replaces an existing stylesheet', async () => {
    write('t.json', CATALOGUE)
    write('assets/css/tokens.css', '/* previous */\n')
    await generateCss('t.json', { baseDir: base })
    expect(readFileSync(join(base, 'assets/css/tokens.css'), 'utf8')).not.toContain('previous')
  })

  it('leaves no temporary files behind', async () => {
    write('t.json', CATALOGUE)
    await generateCss('t.json', { baseDir: base })
    expect(readdirSync(join(base, 'assets/css'))).toEqual(['tokens.css'])
  })

  it('produces byte-identical output when run twice', async () => {
    write('t.json', CATALOGUE)
    const first = await generateCss('t.json', { baseDir: base })
    const once = readFileSync(first.outputPath, 'utf8')
    await generateCss('t.json', { baseDir: base })
    expect(readFileSync(first.outputPath, 'utf8')).toBe(once)
  })
})

describe('a failing conversion writes nothing at all', () => {
  const broken = {
    'a dangling alias': JSON.stringify({ a: { $value: '{nowhere}' } }),
    'an alias cycle': JSON.stringify({ a: { $value: '{b}' }, b: { $value: '{a}' } }),
    'a composite value': JSON.stringify({ a: { $value: { fontSize: '16px' } } }),
    'a name collision': JSON.stringify({ 'a.b': { $value: 1 }, 'a-b': { $value: 2 } }),
    'an unrecognized shape': JSON.stringify({ a: { nope: 1 } }),
  }

  it.each(Object.entries(broken))('creates no file at all given %s', async (_kind, contents) => {
    write('t.json', contents)
    await failure(() => generateCss('t.json', { baseDir: base }))
    expect(readdirSync(base).includes('assets')).toBe(false)
  })

  it.each(Object.entries(broken))(
    'leaves a previous stylesheet byte-identical given %s',
    async (_kind, contents) => {
      write('t.json', contents)
      const previous = '/* the last good build */\n:root { --a: 1; }\n'
      write('assets/css/tokens.css', previous)

      await failure(() => generateCss('t.json', { baseDir: base }))

      expect(readFileSync(join(base, 'assets/css/tokens.css'), 'utf8')).toBe(previous)
      expect(readdirSync(join(base, 'assets/css'))).toEqual(['tokens.css'])
    },
  )
})

describe('failures at the source (FR-12, FR-13, FR-14)', () => {
  it('says there is no file there', async () => {
    const err = await failure(() => generateCss('missing.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(err.message).toMatch(/no file there/)
  })

  it('says permission was denied', async () => {
    const path = write('secret.json', CATALOGUE)
    chmodSync(path, 0o000)
    try {
      const err = await failure(() => generateCss('secret.json', { baseDir: base }))
      expect(err.code).toBe(FailureCode.SOURCE_UNREADABLE)
      expect(err.message).toMatch(/permission was denied/)
    } finally {
      chmodSync(path, 0o600)
    }
  })

  it('refuses a directory, naming the single-file constraint', async () => {
    mkdirSync(join(base, 'tokens'))
    const err = await failure(() => generateCss('tokens', { baseDir: base }))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/one token file at a time/)
  })

  it('refuses a glob without reading anything', async () => {
    const err = await failure(() => generateCss('tokens/*.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/looks like a pattern/)
  })

  it('reports invalid JSON with the position, when the parser gives one', async () => {
    write('t.json', '{ "a": { "$value": 1 },}')
    const err = await failure(() => generateCss('t.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.SOURCE_INVALID_JSON)
    expect(err.message).toMatch(/position \d+/)
  })

  it('passes the parser diagnostic through even when there is no position', async () => {
    // V8 reports a position for some malformed JSON and an excerpt for the
    // rest. Either way the parser's own words are what a developer can act on,
    // so they are forwarded rather than replaced.
    write('t.json', '{ "a": { "$value": }')
    const err = await failure(() => generateCss('t.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.SOURCE_INVALID_JSON)
    expect(err.message).toMatch(/is not valid JSON/)
    expect(err.message).toContain('t.json')
  })

  it('tells a network failure apart from invalid JSON', async () => {
    const err = await failure(() => generateCss('https://example.com/t.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(err.code).not.toBe(FailureCode.SOURCE_INVALID_JSON)
  })

  it('refuses a scheme it does not read', async () => {
    const err = await failure(() => generateCss('ftp://example.com/t.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.FORMAT_NOT_ALLOWED)
    expect(err.message).toMatch(/scheme/)
  })
})

describe('failures at the output (FR-19)', () => {
  it('reports a permission problem and leaves no temporary file', async () => {
    write('t.json', CATALOGUE)
    const outDir = join(base, 'locked')
    mkdirSync(outDir)
    chmodSync(outDir, 0o500)
    try {
      const err = await failure(() => generateCss('t.json', { baseDir: base, outDir }))
      expect(err.code).toBe(FailureCode.OUTPUT_WRITE_FAILED)
      expect(err.message).toMatch(/permission was denied/)
      expect(readdirSync(outDir)).toEqual([])
    } finally {
      chmodSync(outDir, 0o700)
    }
  })

  it('reports a path whose parent is a file, not a directory', async () => {
    write('t.json', CATALOGUE)
    write('blocker', 'not a directory')
    const err = await failure(() =>
      generateCss('t.json', { baseDir: base, outDir: join(base, 'blocker', 'css') }),
    )
    expect(err.code).toBe(FailureCode.OUTPUT_WRITE_FAILED)
  })
})

describe('relative paths resolve against the base directory', () => {
  it('resolves the source and the output against baseDir', async () => {
    write('nested/t.json', CATALOGUE)
    const result = await generateCss('nested/t.json', { baseDir: base, outDir: 'out' })
    expect(result.outputPath).toBe(join(base, 'out/tokens.css'))
  })

  it('resolves against the working directory when no base is given', async () => {
    const previous = process.cwd()
    write('t.json', CATALOGUE)
    process.chdir(base)
    try {
      const result = await generateCss('t.json')
      // macOS puts the temp directory behind a /var -> /private/var symlink, so
      // the path we created and the path Node reports as cwd differ by prefix.
      expect(result.outputPath.startsWith(realpathSync(base))).toBe(true)
      expect(result.outputPath.endsWith(join('assets', 'css', 'tokens.css'))).toBe(true)
    } finally {
      process.chdir(previous)
    }
  })
})
