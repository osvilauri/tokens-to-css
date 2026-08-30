/**
 * The in-process scenario server (AD-23).
 *
 * `node:http`, no dependency — the package promises zero runtime dependencies,
 * and a test harness that needed one would be a strange way to keep that
 * promise honest.
 *
 * Every scenario is served from one ephemeral server on a random loopback port.
 * Tests get a real socket, a real redirect chain and a real stall, because the
 * failures being proved here — a hop escaping the guard, a body that never
 * ends — do not exist in a mocked client.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { SCENARIOS, scenario, type NetworkScenario } from '../../fixtures/network/scenarios.js'

export interface ScenarioServer {
  /** Origin to prefix a scenario id with, e.g. `http://127.0.0.1:54321`. */
  readonly origin: string
  /** Full URL for one scenario. */
  readonly urlFor: (id: string) => string
  /** How many requests have been served, so a redirect chain can be counted. */
  readonly requests: () => readonly string[]
  readonly close: () => Promise<void>
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Starts the server.
 *
 * Always await {@link ScenarioServer.close} — a stalled response holds a socket
 * open, and a leaked one keeps the test process alive.
 */
export async function startScenarioServer(): Promise<ScenarioServer> {
  const served: string[] = []
  const openSockets = new Set<{ destroy: () => void }>()
  /** Filled in once the port is known; read by delayed responders. */
  let origin = ''

  const server: Server = createServer((request, response) => {
    const id = (request.url ?? '/').slice(1).split('?')[0] ?? ''
    served.push(id)

    let found: NetworkScenario
    try {
      found = scenario(id)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end(`no scenario "${id}"`)
      return
    }

    void respond(found)

    async function respond(s: NetworkScenario): Promise<void> {
      if (s.delayMs) await wait(s.delayMs)

      // A delayed response can outlive the client that asked for it — the
      // adapter gives up on a deadline, the test ends, the server closes — and
      // writing to a dead socket turns a passing suite into a flaky one.
      if (response.destroyed || response.writableEnded) return

      const headers: Record<string, string> = { ...s.headers }
      if (s.redirectTo) {
        headers['location'] = s.redirectTo.startsWith('/') ? `${origin}${s.redirectTo}` : s.redirectTo
      }

      response.writeHead(s.status ?? 200, headers)

      if (s.stallForever) {
        // writeHead alone does not put anything on the wire; without this the
        // client waits for headers that never arrive, which is a different
        // failure from the one this scenario exists to reproduce.
        response.flushHeaders()
        return
      }
      if (s.bodyBytes) {
        // Written in chunks so a reader can enforce a cap mid-stream rather
        // than only after the whole body has arrived.
        const chunk = 'x'.repeat(64 * 1024)
        let written = 0
        while (written < s.bodyBytes) {
          const size = Math.min(chunk.length, s.bodyBytes - written)
          response.write(chunk.slice(0, size))
          written += size
        }
        response.end()
        return
      }
      response.end(s.body ?? '')
    }
  })

  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.on('close', () => openSockets.delete(socket))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    origin,
    urlFor: (id) => `${origin}/${id}`,
    requests: () => served,
    close: async () => {
      // A stalled response is holding a socket that will never finish on its
      // own; close() alone would wait for it forever.
      for (const socket of openSockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

/** Every scenario id, for a coverage assertion. */
export const SCENARIO_IDS = SCENARIOS.map((s) => s.id)
