import { readdirSync, statSync, readFileSync, mkdtempSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { generateCss, TokenCssError } from '/Users/macbook/my_personal_projects/tokens-to-css/dist/index.js'

const ROOT = 'dtcg-examples'
const files = []
;(function walk(d){for(const e of readdirSync(d)){const p=join(d,e);if(e==='.git'||e==='.vscode')continue;statSync(p).isDirectory()?walk(p):e.endsWith('.tokens.json')&&files.push(p)}})(ROOT)
files.sort()

const { execSync } = await import('node:child_process')
const cls = execSync('node classify.mjs', { encoding: 'utf8', maxBuffer: 1e8 })
const blocked = new Set()
for (const line of cls.split('\n')) {
  const m = line.match(/^(\S+\.tokens\.json)$/)
  if (m) blocked.add(m[1])
}

const CSS_UNITS = new Set(['px','rem','em','ex','ch','cap','ic','lh','rlh','%','vw','vh','vmin','vmax','svw','svh','lvw','lvh','dvw','dvh','cqw','cqh','cqi','cqb','cqmin','cqmax','cm','mm','q','in','pt','pc','deg','grad','rad','turn','s','ms','fr'])
const isRef = v => typeof v === 'string' && /^\{.+\}$/.test(v)
function scan(f){const doc=JSON.parse(readFileSync(f,'utf8'));const paths=new Set(),refs=[];let embedded=0,badUnits=0,tokens=0
 ;(function walk(node,path){if(!node||typeof node!=='object'||Array.isArray(node))return
  if('$value' in node){tokens++;paths.add(path.join('.'))
   ;(function vals(v){if(typeof v==='string'){if(isRef(v))refs.push(v.slice(1,-1));else if(/\{[^}]+\}/.test(v))embedded++}
    else if(Array.isArray(v))v.forEach(vals)
    else if(v&&typeof v==='object'){if('value' in v&&'unit' in v&&typeof v.unit==='string'&&v.unit!==''&&!CSS_UNITS.has(v.unit))badUnits++;for(const k of Object.keys(v))vals(v[k])}})(node.$value)
   return}
  for(const k of Object.keys(node))if(!k.startsWith('$'))walk(node[k],[...path,k])})(doc,[])
 return{tokens,dangling:refs.filter(r=>!paths.has(r)).length,embedded,badUnits}}

const rows=[]
for(const f of files){
  const rel=relative(ROOT,f)
  let now='ok'
  try{await generateCss(f,{outDir:mkdtempSync(join(tmpdir(),'s-'))})}catch(e){now=e instanceof TokenCssError?e.code:'ERR'}
  const s=scan(f)
  const after = !blocked.has(rel) && !s.dangling && !s.embedded && !s.badUnits
  rows.push({rel,system:rel.split('/')[0],tokens:s.tokens,now,after,s,composite:blocked.has(rel)})
}
const sys={}
for(const r of rows){const b=(sys[r.system]??={f:0,t:0,now:0,after:0});b.f++;b.t+=r.tokens;if(r.now==='ok')b.now++;if(r.after)b.after++}
console.log('system              files  tokens   now  after')
for(const[k,v]of Object.entries(sys))console.log(`${k.padEnd(20)}${String(v.f).padStart(4)}${String(v.t).padStart(8)}${String(v.now).padStart(6)}${String(v.after).padStart(7)}`)
const T=rows.length,N=rows.filter(r=>r.now==='ok').length,A=rows.filter(r=>r.after).length
console.log(`${'TOTAL'.padEnd(20)}${String(T).padStart(4)}${String(rows.reduce((a,r)=>a+r.tokens,0)).padStart(8)}${String(N).padStart(6)}${String(A).padStart(7)}`)
console.log('\ngained by this revision:')
for(const r of rows.filter(r=>r.now!=='ok'&&r.after))console.log(`  + ${r.rel}  (${r.now}, ${r.tokens} tokens)`)
console.log('\nstill blocked, by cause:')
const cause=r=>r.composite?'composite (missing required sub-property)':r.s.dangling?'cross-file reference':r.s.embedded?'reference inside a larger value':r.s.badUnits?'non-CSS unit':'?'
const t={}
for(const r of rows.filter(r=>!r.after)) (t[cause(r)]??=[]).push(r.rel)
for(const[k,v]of Object.entries(t).sort((a,b)=>b[1].length-a[1].length)){console.log(`  ${String(v.length).padStart(3)}  ${k}`);if(v.length<=5)v.forEach(f=>console.log(`         ${f}`))}
