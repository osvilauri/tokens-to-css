#!/usr/bin/env node
/**
 * Refuses to publish while the public surface is still a placeholder.
 *
 * Story 1.2 settles the contract; Story 1.10 implements it. Between the two the
 * package builds, typechecks and tests cleanly — which is exactly the state in
 * which someone could publish an entry point that throws. Wired into
 * `prepublishOnly`.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const MARKER = ['NOT_IMPLEMENTED', 'STORY', '1', '10'].join('_')

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (/\.[cm]?ts$/.test(e.name)) yield full
  }
}

const root = process.cwd()
const pending = []
for await (const file of walk(join(root, 'src'))) {
  if ((await readFile(file, 'utf8')).includes(MARKER)) pending.push(relative(root, file))
}

if (pending.length > 0) {
  console.error(`Refusing to publish: the public surface is still a placeholder.\n`)
  for (const f of pending) console.error(`  ${f}`)
  console.error(`\nStory 1.10 wires the pipeline and removes the marker. Until then this`)
  console.error(`package would install an entry point that throws.`)
  process.exit(1)
}
console.log('no unimplemented markers — the public surface is real')
