/**
 * Reading a local token file (FR-12, FR-13).
 *
 * The failure classes here are deliberately distinguishable: a missing file, a
 * file you may not read, and a directory are three different mistakes with
 * three different fixes, and telling them apart is most of what makes an error
 * message worth reading.
 */
import { readFile } from 'node:fs/promises'
import { FailureCode, TokenCssError } from '../errors.js'

interface ErrnoLike {
  readonly code?: string
}

/**
 * Reads a token file from disk.
 *
 * @throws {TokenCssError} `SOURCE_UNREADABLE` when the file is missing or
 * cannot be read; `FORMAT_NOT_ALLOWED` when the path is a directory, which is
 * a different mistake with a different fix.
 */
export async function readTokenFile(path: string, source: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    const code = (err as ErrnoLike).code

    if (code === 'EISDIR') {
      throw new TokenCssError(
        `"${source}" is a directory. This version converts one token file at a time — ` +
          `pass the file itself`,
        { code: FailureCode.FORMAT_NOT_ALLOWED, source, cause: err },
      )
    }

    const why =
      code === 'ENOENT'
        ? 'there is no file there'
        : code === 'EACCES' || code === 'EPERM'
          ? 'permission was denied'
          : `reading it failed (${code ?? 'unknown error'})`

    throw new TokenCssError(`could not read "${source}": ${why}`, {
      code: FailureCode.SOURCE_UNREADABLE,
      source,
      cause: err,
    })
  }
}

/**
 * Parses token JSON.
 *
 * @throws {TokenCssError} `SOURCE_INVALID_JSON`, carrying the parser's own
 * message, which names the position when the runtime provides it.
 */
export function parseTokenJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new TokenCssError(`"${source}" is not valid JSON: ${(err as Error).message}`, {
      code: FailureCode.SOURCE_INVALID_JSON,
      source,
      cause: err,
    })
  }
}
