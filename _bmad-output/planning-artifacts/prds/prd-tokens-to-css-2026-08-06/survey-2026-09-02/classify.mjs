import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'dtcg-examples'
const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (e === '.git' || e === '.vscode') continue
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.tokens.json')) files.push(p)
  }
})(ROOT)

const WEIGHTS = new Set(['thin','hairline','extra-light','ultra-light','light','normal','regular','book','medium','semi-bold','demi-bold','bold','extra-bold','ultra-bold','black','heavy','extra-black','ultra-black'])
const STROKE_KEYWORDS = new Set(['solid','dashed','dotted','double','groove','ridge','outset','inset'])
const isRef = v => typeof v === 'string' && /^\{.+\}$/.test(v)
const isDim = v => isRef(v) || typeof v === 'number' ||
  (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && Object.keys(v).every(k => k === 'value' || k === 'unit'))
const isColor = v => isRef(v) || typeof v === 'string' ||
  (v && typeof v === 'object' && 'colorSpace' in v && 'components' in v)

// Returns null if the value is acceptable under the new design, else a reason.
function check(value, type) {
  const need = (o, keys) => keys.filter(k => !(k in o))

  if (Array.isArray(value)) {
    if (type === 'fontFamily') return value.every(v => typeof v === 'string') ? null : 'fontFamily entry not a string'
    if (type === 'cubicBezier') return value.length === 4 && value.every(n => typeof n === 'number') ? null : 'malformed cubicBezier'
    if (type === 'shadow') {
      for (const s of value) { const r = check(s, 'shadow'); if (r) return r }
      return null
    }
    if (type === 'gradient') {
      for (const s of value) {
        if (isRef(s)) continue
        const m = need(s, ['color', 'position']); if (m.length) return `gradient stop missing ${m}`
      }
      return null
    }
    return `array of $type ${type}`
  }

  if (!value || typeof value !== 'object') return null // scalar: already handled today

  switch (type) {
    case 'typography': {
      const m = need(value, ['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight'])
      if (m.length) return `typography missing ${m.join(', ')}`
      const w = value.fontWeight
      if (typeof w === 'string' && !isRef(w) && !WEIGHTS.has(w)) return `fontWeight "${w}" outside the alias table`
      if (!isDim(value.fontSize)) return 'fontSize not a dimension'
      return null
    }
    case 'shadow': {
      const m = need(value, ['color','offsetX','offsetY','blur','spread'])
      if (m.length) return `shadow missing ${m.join(', ')}`
      return isColor(value.color) ? null : 'shadow color malformed'
    }
    case 'border': {
      const m = need(value, ['color','width','style'])
      if (m.length) return `border missing ${m.join(', ')}`
      if (value.style && typeof value.style === 'object') return 'border style in object form (unrepresentable in CSS)'
      if (typeof value.style === 'string' && !isRef(value.style) && !STROKE_KEYWORDS.has(value.style)) return `stroke style "${value.style}" not a keyword`
      return null
    }
    case 'transition': {
      const m = need(value, ['duration','delay','timingFunction'])
      return m.length ? `transition missing ${m.join(', ')}` : null
    }
    case 'strokeStyle': {
      const m = need(value, ['dashArray','lineCap'])
      return m.length ? `strokeStyle missing ${m.join(', ')}` : null
    }
    default:
      if ('colorSpace' in value || ('value' in value && Object.keys(value).every(k => k === 'value' || k === 'unit'))) return null
      return `object of $type ${type ?? '(undeclared)'}`
  }
}

const report = []
for (const f of files.sort()) {
  let doc
  try { doc = JSON.parse(readFileSync(f, 'utf8')) } catch { continue }
  const blockers = new Map()
  ;(function walkTok(node, path, inherited) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const type = node.$type ?? inherited
    if ('$value' in node) {
      const v = node.$value
      if (typeof v === 'object' && v !== null) {
        const r = check(v, type)
        if (r) blockers.set(r, (blockers.get(r) ?? 0) + 1)
      }
      return
    }
    for (const k of Object.keys(node)) if (!k.startsWith('$')) walkTok(node[k], [...path, k], type)
  })(doc, [], undefined)
  report.push({ file: relative(ROOT, f), blockers })
}

const unresolved = report.filter(r => r.blockers.size)
console.log(`files with a composite/array value the NEW design still could not emit: ${unresolved.length}/${report.length}\n`)
for (const r of unresolved) {
  console.log(r.file)
  for (const [reason, n] of r.blockers) console.log(`    ${n}×  ${reason}`)
}

// ---- projection: every blocker class, not just composites ----
const CSS_UNITS = new Set(['px','rem','em','ex','ch','cap','ic','lh','rlh','%','vw','vh','vmin','vmax','svw','svh','lvw','lvh','dvw','dvh','cqw','cqh','cqi','cqb','cqmin','cqmax','cm','mm','q','in','pt','pc','deg','grad','rad','turn','s','ms','fr'])

function scan(f) {
  const doc = JSON.parse(readFileSync(f, 'utf8'))
  const paths = new Set(), refs = [], embedded = [], badUnits = []
  ;(function walk(node, path, inherited) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const type = node.$type ?? inherited
    if ('$value' in node) {
      paths.add(path.join('.'))
      ;(function values(v) {
        if (typeof v === 'string') {
          if (isRef(v)) refs.push({ from: path.join('.'), to: v.slice(1, -1) })
          else if (/\{[^}]+\}/.test(v)) embedded.push(path.join('.'))
        } else if (Array.isArray(v)) v.forEach(values)
        else if (v && typeof v === 'object') {
          if ('value' in v && 'unit' in v && typeof v.unit === 'string' && v.unit !== '' && !CSS_UNITS.has(v.unit)) badUnits.push(`${path.join('.')} (${v.unit})`)
          for (const k of Object.keys(v)) values(v[k])
        }
      })(node.$value)
      return
    }
    for (const k of Object.keys(node)) if (!k.startsWith('$')) walk(node[k], [...path, k], type)
  })(doc, [], undefined)
  const dangling = refs.filter(r => !paths.has(r.to))
  return { dangling: dangling.length, embedded: embedded.length, badUnits: badUnits.length }
}

console.log('\n================ projection ================\n')
const rows = report.map(r => {
  const s = scan(join(ROOT, r.file))
  const reasons = []
  if (r.blockers.size) reasons.push('composite')
  if (s.dangling) reasons.push(`dangling×${s.dangling}`)
  if (s.embedded) reasons.push(`embedded×${s.embedded}`)
  if (s.badUnits) reasons.push(`unit×${s.badUnits}`)
  return { file: r.file, reasons }
})
const converts = rows.filter(r => !r.reasons.length)
console.log(`projected: ${converts.length}/${rows.length} files convert after the revision\n`)
const tally = {}
for (const r of rows.filter(r => r.reasons.length)) {
  const key = r.reasons.map(x => x.split('×')[0]).sort().join(' + ')
  ;(tally[key] ??= []).push(r.file)
}
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(v.length).padStart(3)}  ${k}`)
  if (v.length <= 6) for (const f of v) console.log(`       ${f}`)
}
