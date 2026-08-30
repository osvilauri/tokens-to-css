/**
 * Working out what the caller pointed at (FR-1, FR-3).
 *
 * Path resolution happens here, once, at the edge. Everything inside the
 * pipeline sees absolute paths, so no pure stage has to know what the current
 * working directory is.
 */
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FailureCode, TokenCssError } from '../errors.js'

/** A Token Source, once it is known to be readable in principle. */
export type ResolvedSource =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'url'; readonly url: URL }

/** Characters that make a path a pattern rather than a file. */
const GLOB = /[*?[\]{}]/

/**
 * A scheme, but not a Windows drive letter.
 *
 * `C:\tokens.json` parses as a URL with protocol `c:`, so requiring at least
 * two characters keeps a Windows path a path.
 */
const SCHEME = /^([a-z][a-z0-9+.-]+):/i

const refuse = (message: string, source: string): never => {
  throw new TokenCssError(message, { code: FailureCode.FORMAT_NOT_ALLOWED, source })
}

/**
 * Turns whatever the caller passed into an absolute path or a URL.
 *
 * @param source A path or a URL, as the caller wrote it.
 * @param baseDir What relative paths resolve against.
 * @throws {TokenCssError} `FORMAT_NOT_ALLOWED` for globs, unsupported schemes,
 * and anything that is not a single file.
 */
export function resolveSource(source: string | URL, baseDir: string): ResolvedSource {
  const display = String(source)

  if (source instanceof URL) return fromUrl(source, display)

  const scheme = SCHEME.exec(source)
  if (scheme) {
    let url: URL
    try {
      url = new URL(source)
    } catch {
      return refuse(`"${display}" looks like a URL but cannot be parsed as one`, display)
    }
    return fromUrl(url, display)
  }

  if (GLOB.test(source)) {
    refuse(
      `"${display}" looks like a pattern. This version converts one token file at a time — ` +
        `pass a single path, not a glob`,
      display,
    )
  }

  return { kind: 'file', path: isAbsolute(source) ? source : resolve(baseDir, source) }
}

function fromUrl(url: URL, display: string): ResolvedSource {
  if (url.protocol === 'file:') return { kind: 'file', path: fileURLToPath(url) }
  if (url.protocol === 'http:' || url.protocol === 'https:') return { kind: 'url', url }
  return refuse(
    `"${display}" uses the "${url.protocol}" scheme. This version reads a local path, ` +
      `an https: URL, or an http: URL when explicitly allowed`,
    display,
  )
}

/** Where the stylesheet goes, resolved the same way as the input. */
export function resolveOutputPath(outDir: string, fileName: string, baseDir: string): string {
  return resolve(isAbsolute(outDir) ? outDir : resolve(baseDir, outDir), fileName)
}
