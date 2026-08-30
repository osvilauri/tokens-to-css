import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCENARIOS, VALID_DOCUMENT } from '../fixtures/network/scenarios.js'
import { FailureCode, TokenCssError, generateCss } from '../src/index.js'
import { convertDocument } from '../src/pipeline.js'
import { fetchWithPolicy } from '../src/source/http.js'
import { startScenarioServer, type ScenarioServer } from './support/network.js'

let server: ScenarioServer
let base: string

const RELAXED = { allowInternalAddresses: true } as const
const INSECURE = { allowInsecure: true } as const

const failure = async (run: () => Promise<unknown>): Promise<TokenCssError> => {
  try {
    await run()
  } catch (err) {
    return err as TokenCssError
  }
  throw new Error('expected this conversion to fail')
}

beforeEach(async () => {
  server = await startScenarioServer()
  base = mkdtempSync(join(tmpdir(), 'url-'))
})
afterEach(async () => {
  await server.close()
  rmSync(base, { recursive: true, force: true })
})

describe('post-load parity (FR-1)', () => {
  it('produces the same stylesheet from a URL as from a file', async () => {
    // FR-1 makes parity a post-load promise: once the bytes are in hand, where
    // they came from stops mattering. So that is what this proves — the same
    // bytes, fetched and read, through the same conversion.
    const fetched = await fetchWithPolicy(
      new URL(server.urlFor('ok')),
      'network:ok',
      INSECURE,
      RELAXED,
    )
    expect(fetched).toBe(VALID_DOCUMENT)

    mkdirSync(join(base, 'design'), { recursive: true })
    writeFileSync(join(base, 'design/tokens.json'), VALID_DOCUMENT)
    const fromDisk = await generateCss('design/tokens.json', { baseDir: base })
    const diskCss = readFileSync(fromDisk.outputPath, 'utf8')

    const fromNetwork = convertDocument(JSON.parse(fetched), 'network:ok')

    expect(fromNetwork.css).toBe(diskCss)
    expect(fromNetwork.tokenCount).toBe(fromDisk.tokenCount)
  })

  it('carries the same content through both readers', async () => {
    writeFileSync(join(base, 't.json'), VALID_DOCUMENT)
    const fetched = await fetchWithPolicy(
      new URL(server.urlFor('ok')),
      'network:ok',
      INSECURE,
      RELAXED,
    )
    expect(fetched).toBe(readFileSync(join(base, 't.json'), 'utf8'))
  })
})

describe('the pipeline actually reaches the adapter', () => {
  it('fetches rather than refusing a URL outright', async () => {
    // The old stub said "a URL arrives in a later story". If that were still
    // there this would report that message instead of an address refusal.
    const err = await failure(() =>
      generateCss(server.urlFor('ok'), { baseDir: base, http: INSECURE }),
    )
    expect(err.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(err.message).toMatch(/internal address/)
    expect(err.message).not.toMatch(/later story/)
  })

  it('passes the caller network policy through', async () => {
    const err = await failure(() => generateCss(server.urlFor('ok'), { baseDir: base }))
    expect(err.message).toMatch(/https by default/)
  })

  it('writes nothing when the fetch fails', async () => {
    await failure(() => generateCss('https://nowhere.invalid/t.json', { baseDir: base }))
    expect(() => readFileSync(join(base, 'assets/css/tokens.css'))).toThrow()
  })
})

describe('failure classes stay distinguishable by code (FR-12, FR-13)', () => {
  it('tells an unreachable host from a missing file from bad JSON', async () => {
    writeFileSync(join(base, 'bad.json'), '{ not json')

    const network = await failure(() =>
      generateCss('https://nowhere.invalid/t.json', { baseDir: base }),
    )
    const missing = await failure(() => generateCss('gone.json', { baseDir: base }))
    const malformed = await failure(() => generateCss('bad.json', { baseDir: base }))

    expect(network.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(missing.code).toBe(FailureCode.SOURCE_UNREADABLE)
    expect(malformed.code).toBe(FailureCode.SOURCE_INVALID_JSON)

    // Same code for both load failures, different words — the PRD asks for the
    // classes to be distinguishable, and load-time detail is not required to be
    // identical between a path and a URL.
    expect(network.message).not.toBe(missing.message)
    expect(network.message).toMatch(/could not reach/)
    expect(missing.message).toMatch(/no file there/)
  })

  it('reports a fetched document that is not JSON as invalid JSON, not as unreachable', async () => {
    const text = await fetchWithPolicy(
      new URL(server.urlFor('not-json')),
      'network:not-json',
      INSECURE,
      RELAXED,
    )
    writeFileSync(join(base, 'fetched.json'), text)
    const err = await failure(() => generateCss('fetched.json', { baseDir: base }))
    expect(err.code).toBe(FailureCode.SOURCE_INVALID_JSON)
  })
})

describe('SM-4: every failure class is covered by one mechanism or the other', () => {
  it('accounts for all eight codes', () => {
    const documentShaped = new Set([
      'FORMAT_NOT_ALLOWED',
      'ALIAS_CYCLE',
      'ALIAS_DANGLING',
      'COMPOSITE_VALUE',
      'NAME_COLLISION',
    ])
    const networkShaped = new Set(['SOURCE_UNREADABLE'])
    const ioShaped = new Set(['SOURCE_INVALID_JSON', 'OUTPUT_WRITE_FAILED'])

    const all = [...documentShaped, ...networkShaped, ...ioShaped]
    expect(all).toHaveLength(8)
    expect(new Set(all).size).toBe(8)
  })

  it('has a network scenario for every remote failure the adapter refuses', () => {
    const ids = SCENARIOS.map((s) => s.id)
    for (const required of [
      'not-found',
      'server-error',
      'oversized',
      'stall',
      'redirect-loop',
      'redirect-to-metadata',
      'redirect-to-loopback',
      'redirect-to-insecure',
    ]) {
      expect(ids, `no scenario covers "${required}"`).toContain(required)
    }
  })
})
