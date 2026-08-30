#!/usr/bin/env node
/**
 * Measures a conversion, so the performance bar is a number rather than a guess.
 *
 * SM-5 was inherited as an assumption — ten thousand tokens in under two
 * seconds — and an assumption carried to release is one you find out about when
 * changing your mind is expensive. This runs at the end of the epic, while the
 * pipeline can still change.
 *
 * Reports and exits zero. It is an instrument at this point, not a gate; the
 * gate arrives once the bar has been ratified against a real number.
 */
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { cpus, totalmem, platform, arch, release } from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateTokenDocument } from './generate.mjs'
import { generateCss } from '../dist/index.js'

const TOKEN_COUNT = Number(process.env.BENCH_TOKENS ?? 10_000)
const RUNS = 3

/**
 * The ratified bar: 10,000 tokens in 300ms (SM-5, OQ-2 closed 2026-08-30).
 *
 * Chosen from measurement, not from comfort. A developer laptop converts them
 * in 30ms; twelve samples on CI across three Node versions land between 46 and
 * 83ms. 300 leaves roughly 3.5x over the slowest thing actually observed —
 * enough that ordinary variance on a shared runner never trips it, tight enough
 * that a genuine regression does.
 *
 * The bar it replaces was 2,000ms, inherited as a guess. At sixty-six times the
 * real number it was not a bar at all: the emitter could have become sixty times
 * slower and still passed.
 */
const BAR_MS = Number(process.env.BENCH_BAR_MS ?? 300)

/**
 * Judged on the best of three, never on a single sample.
 *
 * A shared CI runner occasionally produces a wildly slow sample — one run here
 * measured 301ms where the same commit measured 74ms on the other two. Gating on
 * any-sample would make the build flake, and a flaky performance gate gets
 * ignored, which is worse than not having one.
 */
const gated = TOKEN_COUNT === 10_000

const hardware = () => {
  const cpu = cpus()[0]
  return [
    `${cpu?.model?.trim() ?? 'unknown cpu'} × ${cpus().length}`,
    `${Math.round(totalmem() / 1024 ** 3)} GB RAM`,
    `${platform()} ${release()} ${arch()}`,
    `node ${process.versions.node}`,
  ].join(' · ')
}

const time = async (label, run) => {
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    const started = performance.now()
    const result = await run()
    samples.push(performance.now() - started)
    if (i === 0) console.log(`  ${label}: ${result.tokenCount} custom properties`)
  }
  const best = Math.min(...samples)
  const worst = Math.max(...samples)
  console.log(`  ${label}: ${best.toFixed(0)}ms best, ${worst.toFixed(0)}ms worst of ${RUNS}`)
  return best
}

const base = mkdtempSync(join(tmpdir(), 'bench-'))
const document = generateTokenDocument(TOKEN_COUNT)
const json = JSON.stringify(document)
writeFileSync(join(base, 'tokens.json'), json)

console.log(`\ntokens-to-css benchmark`)
console.log(`  ${TOKEN_COUNT} tokens, three-tier, ${(json.length / 1024).toFixed(0)} KB of JSON`)
console.log(`  ${hardware()}\n`)

const fromDisk = await time('from disk', () =>
  generateCss('tokens.json', { baseDir: base, outDir: 'out' }),
)

// The same document over the network, because a URL is a supported source and
// the fetch is part of what a caller waits for.
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(json)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/tokens.json`

let fromNetwork = null
try {
  fromNetwork = await time('over http', () =>
    generateCss(url, { baseDir: base, outDir: 'out', http: { allowInsecure: true } }),
  )
} catch (err) {
  // The address guard refuses loopback, which is correct and makes this half of
  // the measurement unavailable without weakening the guard for a benchmark.
  console.log(`  over http: not measured (${err.code ?? err.message})`)
} finally {
  server.close()
}

console.log('')
if (fromNetwork !== null) console.log(`  network adds ${(fromNetwork - fromDisk).toFixed(0)}ms`)

if (!gated) {
  console.log(`  ${fromDisk.toFixed(0)}ms for ${TOKEN_COUNT} tokens — not gated, the bar is for 10,000\n`)
  process.exit(0)
}

if (fromDisk <= BAR_MS) {
  console.log(`  within the ${BAR_MS}ms bar — ${(BAR_MS / fromDisk).toFixed(1)}x of headroom (SM-5)\n`)
  process.exit(0)
}

console.error(`\n  OVER the ${BAR_MS}ms bar: ${fromDisk.toFixed(0)}ms, best of ${RUNS}.\n`)
console.error(`  This is a performance regression, not a slow machine — the bar sits at roughly`)
console.error(`  3.5x the slowest measurement ever recorded on CI. Find what changed, or make a`)
console.error(`  deliberate decision to move the bar and say so in the PRD.\n`)
process.exit(1)
