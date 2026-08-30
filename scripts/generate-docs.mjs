#!/usr/bin/env node
/**
 * Writes the failure-code reference from the code that defines it.
 *
 * The eight codes are public contract, and a table maintained by hand goes
 * stale on the day someone adds a ninth. This reads `src/errors.ts` — the codes
 * and the doc comment above each one — so the documentation cannot describe a
 * different set of failures from the one the library throws.
 *
 * `--check` fails when the file on disk is out of date, and runs in lint and CI.
 *
 *   npm run docs:generate
 *   node scripts/generate-docs.mjs --check
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const check = process.argv.includes('--check')

const source = readFileSync(new URL('src/errors.ts', ROOT), 'utf8')

/** Each code, with the sentence written above it. */
function readCodes() {
  const block = source.slice(
    source.indexOf('export const FailureCode'),
    source.indexOf('} as const)'),
  )
  const codes = []
  for (const match of block.matchAll(/\/\*\* (.+?) \*\/\s*\n\s*([A-Z_]+):/g)) {
    codes.push({ code: match[2], when: match[1] })
  }
  return codes
}

const codes = readCodes()
if (codes.length === 0) {
  console.error('found no failure codes in src/errors.ts — has the shape changed?')
  process.exit(1)
}

const document = `<!--
  GENERATED FILE — do not edit.

  Written by scripts/generate-docs.mjs from src/errors.ts. Change the doc comment
  on a code and run \`npm run docs:generate\`; lint and CI fail if this file and
  that source disagree.
-->

# Failure codes

Every failure this library raises is a \`TokenCssError\` carrying one of these
codes. Branch on \`error.code\`; never match on the message, which is free to
improve.

The codes are **public contract**. Adding one is a minor release; renaming,
merging or removing one is a major release.

| Code | Raised when |
| --- | --- |
${codes.map((c) => `| \`${c.code}\` | ${c.when} |`).join('\n')}

## What an error carries

\`\`\`ts
try {
  await generateCss('design/tokens.json')
} catch (error) {
  error.code        // one of the ${codes.length} above
  error.source      // the Token Source, as you passed it
  error.tokenPaths  // the offending tokens — empty when the failure is not token-scoped
}
\`\`\`

## Nothing is written on a failure

Whatever goes wrong, no stylesheet is produced: not an empty one, not a partial
one, and not a truncated overwrite of the one already there. A failed run leaves
your last good output exactly as it was.
`

const path = new URL('docs/failures.md', ROOT)

if (check) {
  let current = null
  try {
    current = readFileSync(path, 'utf8')
  } catch {
    /* missing counts as out of date */
  }
  if (current !== document) {
    console.error('docs/failures.md is out of date with src/errors.ts.\n')
    console.error('Run: npm run docs:generate')
    process.exit(1)
  }
  console.log(`docs/failures.md matches src/errors.ts (${codes.length} codes)`)
} else {
  writeFileSync(path, document)
  console.log(`  wrote docs/failures.md (${codes.length} codes)`)
}
