/**
 * The guarded remote adapter (FR-1, FR-12, AD-8, AD-13).
 *
 * This is the only module in the package that opens a socket, and the only one
 * that needs to be read as security code.
 *
 * It is built on `node:https` rather than global `fetch` for one reason:
 * `fetch` never tells you which address it resolved, and pinning a connection
 * to an address you have checked requires a dispatcher that is not a Node
 * builtin. Taking that dependency would break the package's zero-dependency
 * promise, so the choice is between a real guard and a convenient client.
 *
 * The shape of the guard:
 *
 *   - `https:` only, unless the caller explicitly allows `http:`.
 *   - Every hop is re-validated. A redirect is a new request to a new host, and
 *     treating it as a continuation of an approved one is how a benign URL
 *     reaches a metadata endpoint.
 *   - The address is checked in a custom `lookup`, and the address the check
 *     approved is the address handed to the socket. Resolving once to validate
 *     and again to connect leaves a window between the two.
 *   - One deadline covers the whole exchange, redirects included.
 *   - The body is counted while it arrives and the connection is dropped the
 *     moment it is too big, rather than after it has all been buffered.
 */
import { request as httpRequest } from 'node:http'
import { request as httpsRequest, type RequestOptions } from 'node:https'
import { lookup as dnsLookup } from 'node:dns'
import { BlockList, isIP, isIPv4 } from 'node:net'
import { FailureCode, TokenCssError } from '../errors.js'
import { DEFAULTS, type HttpOptions } from '../options.js'

/**
 * Address ranges a token URL has no business reaching.
 *
 * The one that matters most is `169.254.0.0/16`: cloud metadata services live
 * at `169.254.169.254` and hand out credentials to whoever asks from inside the
 * host. A library that fetches a URL somebody else supplied is exactly the
 * thing an attacker would like to point at it.
 */
function buildBlockList(): BlockList {
  const list = new BlockList()
  for (const [network, prefix] of [
    ['0.0.0.0', 8], // this network
    ['10.0.0.0', 8], // private
    ['100.64.0.0', 10], // carrier-grade NAT
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local, including cloud metadata
    ['172.16.0.0', 12], // private
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.168.0.0', 16], // private
    ['198.18.0.0', 15], // benchmarking
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reserved
  ] as const) {
    list.addSubnet(network, prefix, 'ipv4')
  }
  for (const [network, prefix] of [
    ['::', 128], // unspecified
    ['::1', 128], // loopback
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link-local
    ['ff00::', 8], // multicast
  ] as const) {
    list.addSubnet(network, prefix, 'ipv6')
  }
  return list
}

const BLOCKED = buildBlockList()

/** `::ffff:169.254.169.254` is the same address as `169.254.169.254`. */
function unwrapMapped(address: string): { address: string; family: 4 | 6 } {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return { address: mapped[1]!, family: 4 }
  return { address, family: isIPv4(address) ? 4 : 6 }
}

/**
 * How strictly addresses are judged.
 *
 * Internal, and never reachable from the published surface. The address guard
 * refuses loopback, which means it also refuses a test server — so transport
 * behaviour (redirects, deadlines, size caps, statuses) is exercised with the
 * address rule relaxed, while the address rule itself is proved exhaustively as
 * a pure function and by real fetches to literal blocked addresses. The wiring
 * between the two is proved by those fetches going through the public entry
 * point with the strict policy.
 */
export interface AddressPolicy {
  readonly allowInternalAddresses: boolean
}

const STRICT: AddressPolicy = { allowInternalAddresses: false }

/** Whether an address is inside a range this adapter refuses to reach. */
export function isBlockedAddress(address: string): boolean {
  const { address: plain, family } = unwrapMapped(address)
  return BLOCKED.check(plain, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * Refuses a host that is already a literal address.
 *
 * Node skips DNS entirely when the host is an IP, so the custom `lookup` never
 * runs and the address check with it. `http://169.254.169.254/` — the most
 * obvious payload there is — would otherwise walk straight past the guard and
 * sit there until something timed out.
 */
function checkLiteralHost(url: URL, source: string, policy: AddressPolicy): void {
  if (policy.allowInternalAddresses) return
  // `URL.hostname` keeps the brackets around an IPv6 literal.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) === 0) return
  if (isBlockedAddress(host)) {
    throw unreadable(
      `refusing to fetch "${url.href}": ${host} is a loopback, private, link-local or ` +
        `otherwise internal address`,
      source,
    )
  }
}

const unreadable = (message: string, source: string, cause?: unknown): TokenCssError =>
  new TokenCssError(message, {
    code: FailureCode.SOURCE_UNREADABLE,
    source,
    ...(cause === undefined ? {} : { cause }),
  })

/** Rejects a URL whose scheme this adapter will not fetch. */
function checkScheme(url: URL, allowInsecure: boolean, source: string): void {
  if (url.protocol === 'https:') return
  if (url.protocol === 'http:' && allowInsecure) return
  if (url.protocol === 'http:') {
    throw unreadable(
      `"${url.href}" uses http:. Tokens are fetched over https by default — pass ` +
        `http: { allowInsecure: true } if you really mean to read this over plain http`,
      source,
    )
  }
  throw unreadable(`"${url.href}" uses the "${url.protocol}" scheme, which is not fetched`, source)
}

interface Attempt {
  readonly url: URL
  readonly deadline: number
  readonly maxBytes: number
  readonly source: string
}

interface Fetched {
  readonly body: Buffer | null
  readonly redirectTo: string | null
}

/** One hop: connect, check the address, read the body or the `Location`. */
function fetchOnce(attempt: Attempt, policy: AddressPolicy): Promise<Fetched> {
  const { url, deadline, maxBytes, source } = attempt

  return new Promise<Fetched>((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      reject(unreadable(`fetching "${source}" took too long`, source))
      return
    }

    const options: RequestOptions = {
      // The address this approves is the address the socket connects to. A
      // second resolution between checking and connecting is a window in which
      // the answer can change (DNS rebinding).
      lookup: (hostname, _options, callback) => {
        dnsLookup(hostname, { all: false }, (err, address, family) => {
          if (err) {
            callback(err, '', 4)
            return
          }
          if (!policy.allowInternalAddresses && isBlockedAddress(address)) {
            callback(
              new Error(
                `"${hostname}" resolves to ${address}, which is a loopback, private, ` +
                  `link-local or otherwise internal address`,
              ),
              '',
              4,
            )
            return
          }
          callback(null, address, family)
        })
      },
    }

    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const request = send(url, options, (response) => {
      const status = response.statusCode ?? 0

      if (status >= 300 && status < 400) {
        const location = response.headers.location
        response.resume() // drain, so the socket can be reused or closed cleanly
        if (location === undefined) {
          reject(unreadable(`"${url.href}" redirected without saying where`, source))
          return
        }
        resolve({ body: null, redirectTo: new URL(location, url).href })
        return
      }

      if (status < 200 || status >= 300) {
        response.resume()
        reject(unreadable(`"${url.href}" answered ${status}`, source))
        return
      }

      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > maxBytes) {
          // Dropped mid-stream rather than after buffering it all — the point
          // of a cap is not to hold the thing you refused to accept.
          request.destroy()
          reject(
            unreadable(
              `"${url.href}" is larger than the ${maxBytes} byte limit for a token document`,
              source,
            ),
          )
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({ body: Buffer.concat(chunks), redirectTo: null }))
      response.on('error', (err) => reject(unreadable(`reading "${url.href}" failed`, source, err)))
    })

    request.setTimeout(remaining, () => {
      request.destroy()
      reject(unreadable(`fetching "${source}" took longer than the time allowed`, source))
    })

    request.on('error', (err: NodeJS.ErrnoException) => {
      // A blocked address arrives here, raised by the lookup above.
      if (/resolves to .* which is a/.test(err.message)) {
        reject(unreadable(`refusing to fetch "${url.href}": ${err.message}`, source, err))
        return
      }
      reject(unreadable(`could not reach "${url.href}" (${err.code ?? err.message})`, source, err))
    })

    request.end()
  })
}

/**
 * Fetches a token document, following redirects under the guard.
 *
 * @returns The document text. The core never sees the URL — only bytes that
 * passed every check.
 * @throws {TokenCssError} `SOURCE_UNREADABLE` for every network failure, so a
 * caller can tell "I could not read it" from "I read it and it was wrong".
 */
export async function fetchTokenDocument(
  url: URL,
  source: string,
  options: HttpOptions = {},
): Promise<string> {
  return fetchWithPolicy(url, source, options, STRICT)
}

/** The same fetch, with the address rule supplied. Internal; see {@link AddressPolicy}. */
export async function fetchWithPolicy(
  url: URL,
  source: string,
  options: HttpOptions,
  policy: AddressPolicy,
): Promise<string> {
  const allowInsecure = options.allowInsecure ?? DEFAULTS.http.allowInsecure
  const maxRedirects = options.maxRedirects ?? DEFAULTS.http.maxRedirects
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULTS.http.timeoutMs)
  const maxBytes = options.maxBytes ?? DEFAULTS.http.maxBytes

  let current = url
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Both re-checked every hop, not just on the URL the caller passed.
    checkScheme(current, allowInsecure, source)
    checkLiteralHost(current, source, policy)

    const { body, redirectTo } = await fetchOnce({ url: current, deadline, maxBytes, source }, policy)
    if (body !== null) return body.toString('utf8')

    current = new URL(redirectTo!)
  }

  throw unreadable(
    `"${source}" redirected more than ${maxRedirects} times without arriving anywhere`,
    source,
  )
}
