/**
 * Network scenarios (AD-23).
 *
 * A timeout is not a document. Neither is an oversized body, a redirect chain,
 * or a host that resolves into a range we refuse — so none of them fit
 * `fixtures/reject/<trigger>/input.json`, and they live here instead.
 *
 * This table is the network half of the corpus: adding a scenario is a
 * single-file change, exactly as adding a fixture is a single-folder change.
 * Together the two mechanisms are what SM-4's coverage claim rests on.
 */

/** A response the scenario server can be asked to produce. */
export interface NetworkScenario {
  /** Path segment that selects it: `/{id}`. */
  readonly id: string
  /** What this scenario is for. Read by a human deciding whether one is missing. */
  readonly description: string
  /** HTTP status. Defaults to 200. */
  readonly status?: number
  /** Extra response headers. */
  readonly headers?: Readonly<Record<string, string>>
  /** Literal body. */
  readonly body?: string
  /** Body of this many bytes, generated rather than stored in the repository. */
  readonly bodyBytes?: number
  /** `Location` header. A bare `/id` is rewritten to this server's own origin. */
  readonly redirectTo?: string
  /** Wait this long before sending anything. */
  readonly delayMs?: number
  /** Send headers, then never finish the body. */
  readonly stallForever?: boolean
}

/** A small, valid token document, used wherever the response should succeed. */
export const VALID_DOCUMENT = JSON.stringify({
  color: { brand: { $value: '#5A4FCF', $type: 'color' } },
  spacing: { md: { $value: '16px' } },
})

export const SCENARIOS: readonly NetworkScenario[] = [
  {
    id: 'ok',
    description: 'A well-behaved response carrying a valid token document.',
    body: VALID_DOCUMENT,
    headers: { 'content-type': 'application/json' },
  },
  {
    id: 'not-found',
    description: 'A 404, which must fail as unreadable rather than as invalid JSON.',
    status: 404,
    body: 'no such document',
  },
  {
    id: 'server-error',
    description: 'A 500, so a non-2xx is refused whatever the body says.',
    status: 500,
    body: VALID_DOCUMENT,
  },
  {
    id: 'not-json',
    description: 'A 200 carrying prose, so the parse failure is told apart from a network failure.',
    body: '<html>this is not a token document</html>',
  },
  {
    id: 'oversized',
    description: 'A body far past any sane maximum, to prove the cap is enforced while streaming.',
    bodyBytes: 5_000_000,
  },
  {
    id: 'slow',
    description: 'A response that is late but does arrive, to prove a timeout is not trigger-happy.',
    delayMs: 40,
    body: VALID_DOCUMENT,
  },
  {
    id: 'stall',
    description: 'Headers, then silence forever — the case a total timeout exists for.',
    stallForever: true,
  },
  {
    id: 'redirect-once',
    description: 'A single redirect to a good response, which must be followed.',
    status: 302,
    redirectTo: '/ok',
  },
  {
    id: 'redirect-loop',
    description: 'A redirect to itself, to prove the hop cap ends it.',
    status: 302,
    redirectTo: '/redirect-loop',
  },
  {
    id: 'redirect-chain-4',
    description: 'Four hops, one more than the default cap allows.',
    status: 302,
    redirectTo: '/redirect-chain-3',
  },
  { id: 'redirect-chain-3', description: 'Hop three of four.', status: 302, redirectTo: '/redirect-chain-2' },
  { id: 'redirect-chain-2', description: 'Hop two of four.', status: 302, redirectTo: '/redirect-chain-1' },
  { id: 'redirect-chain-1', description: 'Hop one of four, ending at a good response.', status: 302, redirectTo: '/ok' },
  {
    id: 'redirect-to-metadata',
    description:
      'A redirect into the cloud metadata address. The first hop is allowed, the second is not — ' +
      'which is the whole reason every hop is re-validated rather than only the URL the caller passed.',
    status: 302,
    redirectTo: 'http://169.254.169.254/latest/meta-data/',
  },
  {
    id: 'redirect-to-loopback',
    description: 'A redirect to a loopback address, refused for the same reason.',
    status: 302,
    redirectTo: 'http://127.0.0.1:1/tokens.json',
  },
  {
    id: 'redirect-to-insecure',
    description: 'An https response redirecting to http, which must not silently downgrade.',
    status: 302,
    redirectTo: 'http://example.invalid/tokens.json',
  },
]

/** Looks a scenario up by id. */
export function scenario(id: string): NetworkScenario {
  const found = SCENARIOS.find((s) => s.id === id)
  if (found === undefined) throw new Error(`no network scenario named "${id}"`)
  return found
}
