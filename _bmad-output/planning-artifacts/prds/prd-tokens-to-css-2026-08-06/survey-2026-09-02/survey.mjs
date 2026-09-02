import { generateCss, TokenCssError } from '/Users/macbook/my_personal_projects/tokens-to-css/dist/index.js'
import { readdirSync, statSync, mkdtempSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = 'dtcg-examples'
const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (e === '.git' || e === 'node_modules' || e === '.vscode') continue
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.tokens.json')) files.push(p)
  }
})(ROOT)

const countTokens = (o, n = { total: 0 }) => {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    if ('$value' in o || 'value' in o) n.total++
    else for (const k of Object.keys(o)) if (!k.startsWith('$')) countTokens(o[k], n)
  }
  return n.total
}

const out = []
for (const f of files.sort()) {
  const outDir = mkdtempSync(join(tmpdir(), 'survey-'))
  let status = 'ok', code = '', msg = ''
  try {
    await generateCss(f, { outDir })
  } catch (e) {
    status = 'fail'
    code = e instanceof TokenCssError ? e.code : e.constructor.name
    msg = String(e.message).slice(0, 160)
  }
  let tokens = 0
  try { tokens = countTokens(JSON.parse(readFileSync(f, 'utf8'))) } catch {}
  out.push({ file: relative(ROOT, f), tokens, status, code, msg })
}

const ok = out.filter(r => r.status === 'ok')
console.log(`${ok.length}/${out.length} files convert · ${out.reduce((a, r) => a + r.tokens, 0)} tokens`)
console.log('')
for (const r of out) {
  console.log(`${r.status === 'ok' ? 'OK  ' : 'FAIL'} ${r.file.padEnd(58)} ${String(r.tokens).padStart(5)}  ${r.code}`)
}
console.log('\n--- failure messages ---')
for (const r of out.filter(r => r.status === 'fail')) console.log(`${r.file}\n    ${r.msg}`)
