import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ROOT = new URL('../', import.meta.url)
const guide = readFileSync(new URL('docs/getting-started.md', ROOT), 'utf8')
const built = existsSync(new URL('dist/index.js', ROOT).pathname)

/** The wrapper example, taken from the page rather than retyped here. */
function example(): string {
  const block = guide.match(/<!-- example:start -->\s*```js\n([\s\S]*?)```/)
  if (!block) throw new Error('the getting-started guide no longer marks its example')
  return block[1]!
}

let project: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'onboarding-'))
})
afterEach(() => {
  rmSync(project, { recursive: true, force: true })
})

/**
 * SM-2 is measured by a person with a stopwatch. This is the half a machine can
 * hold: that the five steps still describe what the library does, and that the
 * example on the page runs when copied rather than only when read.
 */
describe.skipIf(!built)('the example on the page actually runs', () => {
  it('converts the sample token file, copied verbatim', () => {
    mkdirSync(join(project, 'design'), { recursive: true })
    mkdirSync(join(project, 'scripts'), { recursive: true })

    const sample = readFileSync(new URL('docs/example/tokens.json', ROOT), 'utf8')
    writeFileSync(join(project, 'design/tokens.json'), sample)

    // The one substitution: a bare specifier needs the package installed, and
    // installing it is step 1 rather than something this test can assume.
    const code = example().replace(
      `from 'tokens-to-css'`,
      `from '${new URL('dist/index.js', ROOT).pathname}'`,
    )
    writeFileSync(join(project, 'scripts/build-tokens.mjs'), code)

    execFileSync(process.execPath, ['scripts/build-tokens.mjs'], { cwd: project, stdio: 'pipe' })

    const css = readFileSync(join(project, 'assets/css/tokens.css'), 'utf8')
    expect(css).toContain('--color-brand: #5A4FCF;')
  })

  it('produces exactly the stylesheet the page shows', () => {
    // Step 4 prints the output. If the page and the library disagree, the first
    // thing a new developer sees is a lie.
    const shown = guide.match(/```css\n(:root \{[\s\S]*?\})\n```/)![1]!

    mkdirSync(join(project, 'design'), { recursive: true })
    writeFileSync(
      join(project, 'design/tokens.json'),
      readFileSync(new URL('docs/example/tokens.json', ROOT), 'utf8'),
    )
    const code = example().replace(
      `from 'tokens-to-css'`,
      `from '${new URL('dist/index.js', ROOT).pathname}'`,
    )
    writeFileSync(join(project, 'run.mjs'), code)
    execFileSync(process.execPath, ['run.mjs'], { cwd: project, stdio: 'pipe' })

    const produced = readFileSync(join(project, 'assets/css/tokens.css'), 'utf8').trim()
    expect(produced).toBe(shown.trim())
  })

  it('fails the way step 5 says it fails', () => {
    mkdirSync(join(project, 'design'), { recursive: true })
    const sample = readFileSync(new URL('docs/example/tokens.json', ROOT), 'utf8').replace(
      '{color.ink}',
      '{color.inkk}',
    )
    writeFileSync(join(project, 'design/tokens.json'), sample)
    const code = example().replace(
      `from 'tokens-to-css'`,
      `from '${new URL('dist/index.js', ROOT).pathname}'`,
    )
    writeFileSync(join(project, 'run.mjs'), code)

    let output = ''
    try {
      execFileSync(process.execPath, ['run.mjs'], { cwd: project, stdio: 'pipe' })
      throw new Error('expected the deliberate typo to fail')
    } catch (error) {
      output = String((error as { stderr?: Buffer }).stderr ?? '')
    }

    for (const promised of ['ALIAS_DANGLING', 'color.text', 'color.inkk', 'does not exist']) {
      expect(output, promised).toContain(promised)
    }
  })

  it('leaves the previous stylesheet untouched, as step 5 promises', () => {
    mkdirSync(join(project, 'design'), { recursive: true })
    mkdirSync(join(project, 'assets/css'), { recursive: true })
    const previous = '/* the last good build */\n'
    writeFileSync(join(project, 'assets/css/tokens.css'), previous)

    const broken = readFileSync(new URL('docs/example/tokens.json', ROOT), 'utf8').replace(
      '{color.ink}',
      '{color.inkk}',
    )
    writeFileSync(join(project, 'design/tokens.json'), broken)
    writeFileSync(
      join(project, 'run.mjs'),
      example().replace(`from 'tokens-to-css'`, `from '${new URL('dist/index.js', ROOT).pathname}'`),
    )

    try {
      execFileSync(process.execPath, ['run.mjs'], { cwd: project, stdio: 'pipe' })
    } catch {
      /* expected */
    }
    expect(readFileSync(join(project, 'assets/css/tokens.css'), 'utf8')).toBe(previous)
  })
})

describe('the checklist covers the five steps SM-2 measures', () => {
  it.each([
    ['install', /npm i -D tokens-to-css/],
    ['a sample token source', /example\/tokens\.json/],
    ['the wrapper', /<!-- example:start -->/],
    ['verifying the output', /assets\/css\/tokens\.css/],
    ['a deliberate failure', /ALIAS_DANGLING/],
  ])('step: %s', (_step, pattern) => {
    expect(guide).toMatch(pattern)
  })

  it('promises no config file, because there is none', () => {
    expect(guide.replace(/\s+/g, ' ')).toMatch(/no config file and no CLI/i)
  })
})
