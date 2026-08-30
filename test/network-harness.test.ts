import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCENARIOS, VALID_DOCUMENT, scenario } from '../fixtures/network/scenarios.js'
import { startScenarioServer, type ScenarioServer } from './support/network.js'

let server: ScenarioServer

/** Fetches without following redirects, so a hop can be inspected. */
const hop = async (id: string): Promise<Response> =>
  fetch(server.urlFor(id), { redirect: 'manual' })

beforeEach(async () => {
  server = await startScenarioServer()
})
afterEach(async () => {
  await server.close()
})

describe('the server itself', () => {
  it('listens on loopback and a port nobody chose', () => {
    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('serves a valid token document', async () => {
    const response = await hop('ok')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(VALID_DOCUMENT)
  })

  it('records what was requested, so a chain can be counted', async () => {
    await hop('ok')
    await hop('not-found')
    expect(server.requests()).toEqual(['ok', 'not-found'])
  })

  it('releases the port when closed', async () => {
    const origin = server.origin
    await server.close()
    await expect(fetch(`${origin}/ok`)).rejects.toThrow()
    server = await startScenarioServer() // so afterEach has something to close
  })
})

describe('the failures a token URL can produce', () => {
  it('returns a non-2xx that must not be read as a document', async () => {
    expect((await hop('not-found')).status).toBe(404)
    expect((await hop('server-error')).status).toBe(500)
  })

  it('returns a 200 that is not JSON, so parse failure is a separate class', async () => {
    const response = await hop('not-json')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<html>')
  })

  it('sends a body far past any sane maximum', async () => {
    const response = await hop('oversized')
    const size = (await response.arrayBuffer()).byteLength
    expect(size).toBe(scenario('oversized').bodyBytes)
    expect(size).toBeGreaterThan(1_000_000)
  })

  it('sends the oversized body in chunks, so a cap can bite mid-stream', async () => {
    const response = await hop('oversized')
    const reader = response.body!.getReader()
    const first = await reader.read()
    await reader.cancel()
    expect(first.value!.byteLength).toBeLessThan(scenario('oversized').bodyBytes!)
  })

  it('answers late but does answer, so a timeout is not trigger-happy', async () => {
    const started = performance.now()
    const response = await hop('slow')
    expect(response.status).toBe(200)
    expect(performance.now() - started).toBeGreaterThanOrEqual(scenario('slow').delayMs!)
  })

  it('sends headers and then never finishes the body', async () => {
    const controller = new AbortController()
    const response = await fetch(server.urlFor('stall'), { signal: controller.signal })
    expect(response.status).toBe(200)

    const settled = await Promise.race([
      response.text().then(() => 'finished' as const),
      new Promise<'still waiting'>((resolve) => setTimeout(() => resolve('still waiting'), 120)),
    ])
    controller.abort()
    expect(settled).toBe('still waiting')
  })
})

describe('redirects', () => {
  it('sends one hop to a good response', async () => {
    const response = await hop('redirect-once')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(server.urlFor('ok'))
  })

  it('sends a chain longer than the default hop cap', async () => {
    let location = server.urlFor('redirect-chain-4')
    const chain: string[] = []
    for (let i = 0; i < 6; i++) {
      const response = await fetch(location, { redirect: 'manual' })
      if (response.status !== 302) break
      location = response.headers.get('location')!
      chain.push(location)
    }
    expect(chain.length).toBeGreaterThan(scenario('redirect-once') ? 3 : 0)
    expect(chain.at(-1)).toBe(server.urlFor('ok'))
  })

  it('sends a redirect that points at itself', async () => {
    const response = await hop('redirect-loop')
    expect(response.headers.get('location')).toBe(server.urlFor('redirect-loop'))
  })

  it('sends a redirect into the cloud metadata address', async () => {
    // The first hop is perfectly ordinary. Only the second is dangerous, which
    // is why every hop is re-validated rather than only the URL passed in.
    const response = await hop('redirect-to-metadata')
    expect(response.headers.get('location')).toBe('http://169.254.169.254/latest/meta-data/')
  })

  it('sends a redirect to loopback', async () => {
    expect((await hop('redirect-to-loopback')).headers.get('location')).toMatch(/^http:\/\/127\./)
  })

  it('sends an http location, so a downgrade can be refused', async () => {
    expect((await hop('redirect-to-insecure')).headers.get('location')).toMatch(/^http:/)
  })
})

describe('the scenario table', () => {
  it('has a unique id and a description for every entry', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SCENARIOS) expect(s.description.length, s.id).toBeGreaterThan(10)
  })

  it('covers every failure the guarded adapter has to refuse', () => {
    const ids = SCENARIOS.map((s) => s.id)
    for (const required of [
      'stall',
      'oversized',
      'redirect-loop',
      'redirect-to-metadata',
      'redirect-to-loopback',
      'redirect-to-insecure',
      'not-found',
    ]) {
      expect(ids, `missing scenario "${required}"`).toContain(required)
    }
  })

  it('names a scenario that does not exist rather than serving a blank', () => {
    expect(() => scenario('nope')).toThrow(/no network scenario named "nope"/)
  })
})
