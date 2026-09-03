#!/usr/bin/env node
/**
 * A local demo of tokens-to-css.
 *
 * The library is Node-only and writes to disk — that is a decision in the PRD,
 * not an oversight — so a demo cannot be a page on its own. This is the thinnest
 * server that lets a browser drive it: it holds no state, keeps no uploads, and
 * calls exactly the same entry point an application would.
 *
 * `node:http` only. The package promises zero dependencies and it would be a
 * strange demo that needed some.
 *
 *   npm run demo
 */
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateCss } from '../dist/index.js'

const PORT = Number(process.env.PORT ?? 4321)
const PREVIEW_LINES = 200
const MAX_UPLOAD = 8 * 1024 * 1024

const page = readFileSync(new URL('./index.html', import.meta.url))

const SAMPLES_DIR = new URL('./samples/', import.meta.url).pathname

/**
 * The worked examples, read from `samples/` at startup.
 *
 * They live on disk rather than inside the page because they are the point:
 * somebody reviewing what this library does with a composite should be able to
 * open the file, change it, and reload. Each one documents itself in its own
 * `$description`, which the converter reads and ignores.
 *
 * The list is also the allowlist. A request names a sample by id and the id has
 * to be one of these, so no request can name a path.
 */
const SAMPLES = readdirSync(SAMPLES_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const id = name.replace(/\.json$/, '')
    const text = readFileSync(join(SAMPLES_DIR, name), 'utf8')
    // Each sample's `$description` opens with its own title, then a `·`, then
    // what it is for. Splitting there means the file names the button and the
    // caption in one place — the place a reader of the file already looks.
    const [title, ...rest] = (JSON.parse(text).$description ?? id).split(' · ')
    return { id, label: title.trim(), description: rest.join(' · ').trim(), text }
  })

/** Reads a request body, refusing anything absurd. */
const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_UPLOAD) {
        request.destroy()
        reject(new Error('that file is larger than this demo accepts'))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })

/**
 * Converts, and reports the result the way the library reports it.
 *
 * A failure is not an error page here. The failure codes are half of what this
 * library is for, so the demo shows them the way a caller would see them — and
 * so are the tokens a successful conversion left behind.
 */
async function convert({ url, upload, fileName, sample }) {
  const workspace = mkdtempSync(join(tmpdir(), 'tokens-to-css-demo-'))
  try {
    let source = url
    if (sample) {
      source = join(workspace, `${sample.id}.json`)
      writeFileSync(source, sample.text)
    } else if (upload) {
      source = join(workspace, fileName || 'tokens.json')
      writeFileSync(source, upload)
    }

    const result = await generateCss(source, {
      outDir: join(workspace, 'out'),
      // The demo reaches the same guard an application does: https by default,
      // internal addresses refused. Nothing is relaxed to make a demo prettier.
    })

    const css = readFileSync(result.outputPath, 'utf8')
    const lines = css.split('\n')
    return {
      ok: true,
      tokenCount: result.tokenCount,
      totalLines: lines.length,
      truncated: lines.length > PREVIEW_LINES,
      preview: lines.slice(0, PREVIEW_LINES).join('\n'),
      css,
      // A conversion can succeed while leaving tokens out. Reporting only the
      // count would make a partial conversion look like a whole one, which is
      // the failure partial conversion was designed not to be.
      skipped: result.skipped,
      ...describe(sample),
    }
  } catch (error) {
    return {
      ok: false,
      code: error.code ?? 'UNEXPECTED',
      message: error.message ?? String(error),
      tokenPaths: error.tokenPaths ?? [],
      ...describe(sample),
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

/**
 * The input and its caption, for a sample.
 *
 * Only for samples. An uploaded file is already in front of whoever uploaded
 * it, and a remote one is a URL away — echoing either back would be filling the
 * page with something the reader already has.
 */
const describe = (sample) =>
  sample ? { input: sample.text, description: sample.description } : {}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`)

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(page)
    return
  }

  if (request.method === 'GET' && url.pathname === '/samples') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify(SAMPLES.map(({ id, label, description }) => ({ id, label, description }))))
    return
  }

  if (request.method === 'POST' && url.pathname === '/convert') {
    try {
      const wanted = url.searchParams.get('sample')
      const sample = wanted ? SAMPLES.find((s) => s.id === wanted) : undefined
      if (wanted && !sample) throw new Error(`there is no sample called "${wanted}"`)

      const remote = sample ? null : url.searchParams.get('url')
      const body = sample || remote ? null : await readBody(request)
      const outcome = await convert({
        sample,
        url: remote ?? undefined,
        upload: body?.length ? body : undefined,
        fileName: url.searchParams.get('name') ?? 'tokens.json',
      })
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(outcome))
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ ok: false, code: 'BAD_REQUEST', message: error.message }))
    }
    return
  }

  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('not found')
})

/**
 * Starts on the first free port at or after the one asked for.
 *
 * Loopback only: this converts whatever it is pointed at, including files on
 * this machine. It is a demo for the person running it, not a service.
 *
 * A demo that dies with a stack trace because something else already holds a
 * port is a bad demo, and 4321 is a popular number.
 */
// Announced once, from the port actually bound. Passing a callback to each
// `listen` attempt leaves the failed attempt's callback registered, and the
// demo greets you with two different URLs, one of which is a lie.
server.on('listening', () => {
  console.log(`\n  tokens-to-css demo → http://localhost:${server.address().port}\n`)
})

function listen(port, attemptsLeft = 12) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`  puerto ${port} ocupado, probando ${port + 1}…`)
      listen(port + 1, attemptsLeft - 1)
      return
    }
    console.error(`\n  no se pudo abrir el servidor: ${error.message}\n`)
    process.exit(1)
  })
  server.listen(port, '127.0.0.1')
}

listen(PORT)
