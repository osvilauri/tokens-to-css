/**
 * Writing the stylesheet without ever leaving a half-written one (FR-2, FR-19, AD-7).
 *
 * The stylesheet is written to a temporary file beside the target and renamed
 * into place. `rename` within a directory is atomic, so a reader sees either
 * the old file or the new one — never a truncated one, whatever happens
 * mid-write.
 *
 * The temporary file goes in the **target directory**, not the system temp
 * directory: `rename` across filesystems is not atomic and often is not even
 * possible, and the two are frequently on different filesystems.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { FailureCode, TokenCssError } from '../errors.js'

interface ErrnoLike {
  readonly code?: string
}

function explain(code: string | undefined, targetPath: string): string {
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return `permission was denied writing to "${targetPath}"`
    case 'ENOSPC':
      return `the disk is full`
    case 'EROFS':
      return `"${targetPath}" is on a read-only filesystem`
    case 'ENOTDIR':
      return `part of the path to "${targetPath}" is a file, not a directory`
    default:
      return `writing "${targetPath}" failed (${code ?? 'unknown error'})`
  }
}

/**
 * Writes the stylesheet, replacing whatever was there.
 *
 * Creates the output directory if it does not exist. On any failure the
 * temporary file is removed and the previous stylesheet is left exactly as it
 * was — a failed run never costs you the last good output.
 *
 * @throws {TokenCssError} `OUTPUT_WRITE_FAILED`, naming the reason.
 */
export async function writeStylesheet(
  targetPath: string,
  contents: string,
  source: string,
): Promise<void> {
  const directory = dirname(targetPath)
  const temporary = join(directory, `.${randomUUID()}.tmp`)

  try {
    await mkdir(directory, { recursive: true })

    const handle = await open(temporary, 'wx')
    try {
      await handle.writeFile(contents, 'utf8')
      // Flush before the rename: without it a crash can leave the renamed file
      // present but empty, which looks like success and is not.
      await handle.sync()
    } finally {
      await handle.close()
    }

    await rename(temporary, targetPath)
  } catch (err) {
    await unlink(temporary).catch(() => {
      // The temporary file may never have been created. Nothing to clean up,
      // and the original failure is the one worth reporting.
    })
    throw new TokenCssError(explain((err as ErrnoLike).code, targetPath), {
      code: FailureCode.OUTPUT_WRITE_FAILED,
      source,
      cause: err,
    })
  }
}
