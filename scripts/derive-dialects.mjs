#!/usr/bin/env node
/**
 * Renders each DTCG accept fixture into the other two dialects.
 *
 * The corpus claims that dialect and hierarchy are the only variables — that
 * two fixtures differing only in notation must emit identical stylesheets. That
 * claim is only worth anything if the three files really do say the same thing,
 * and three hand-written copies of the same catalogue drift the first time
 * somebody edits one of them.
 *
 * So DTCG is the source and the other two are derived. `--check` fails if a
 * derived file has fallen out of step, which is what stops the drift from
 * being discovered by a confusing golden mismatch six months later.
 *
 *   node scripts/derive-dialects.mjs            # rewrite
 *   node scripts/derive-dialects.mjs --check    # verify, exit 1 on drift
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ACCEPT = new URL('../fixtures/accept/', import.meta.url).pathname
const check = process.argv.includes('--check')

/**
 * Hierarchies that exist only as DTCG.
 *
 * `object-values` writes colours and dimensions the way the current DTCG spec
 * does, and `array-values` writes font families and easing curves the same way.
 * Style Dictionary legacy has no such notation, and rendering it there would
 * invent a dialect nobody publishes.
 */
const DTCG_ONLY = new Set(['object-values', 'array-values', 'composites'])

/** DTCG to Style Dictionary legacy: the same tree with the dollars taken off. */
function toLegacy(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node
  if ('$value' in node) {
    const token = { value: node.$value }
    if ('$type' in node) token.type = node.$type
    if ('$description' in node) token.comment = node.$description
    return token
  }
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== '$description')
      .map(([key, value]) => [key, toLegacy(value)]),
  )
}

/** Legacy wrapped in a token set, the way the plugin exports it. */
function toTokensStudio(legacy) {
  return {
    $metadata: { tokenSetOrder: ['global'] },
    $themes: [],
    global: legacy,
  }
}

const render = (value) => JSON.stringify(value, null, 2) + '\n'

let drifted = []
for (const hierarchy of readdirSync(join(ACCEPT, 'dtcg'))) {
  if (DTCG_ONLY.has(hierarchy)) continue
  const source = JSON.parse(readFileSync(join(ACCEPT, 'dtcg', hierarchy, 'input.json'), 'utf8'))
  const legacy = toLegacy(source)

  for (const [dialect, document] of [
    ['sd-legacy', legacy],
    ['tokens-studio', toTokensStudio(legacy)],
  ]) {
    const directory = join(ACCEPT, dialect, hierarchy)
    const path = join(directory, 'input.json')
    const wanted = render(document)

    if (check) {
      let actual = null
      try {
        actual = readFileSync(path, 'utf8')
      } catch {
        /* missing counts as drift */
      }
      if (actual !== wanted) drifted.push(`${dialect}/${hierarchy}`)
      continue
    }

    mkdirSync(directory, { recursive: true })
    writeFileSync(path, wanted)
    console.log(`  wrote ${dialect}/${hierarchy}/input.json`)
  }
}

if (check && drifted.length > 0) {
  console.error('These fixtures no longer match the DTCG source they are derived from:\n')
  for (const id of drifted) console.error(`  ${id}`)
  console.error('\nRun: node scripts/derive-dialects.mjs')
  process.exit(1)
}
if (check) console.log('every derived fixture matches its DTCG source')
