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
const BAR_MS = 2_000
const RUNS = 3

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
const verdict = fromDisk <= BAR_MS ? 'within' : 'OVER'
console.log(`  ${verdict} the assumed ${BAR_MS}ms bar (SM-5, OQ-2)`)
if (fromNetwork !== null) console.log(`  network adds ${(fromNetwork - fromDisk).toFixed(0)}ms`)
console.log('')
