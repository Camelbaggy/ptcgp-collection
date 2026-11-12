#!/usr/bin/env node
// Bilan des pipelines : liste les anomalies silencieuses (meta.json périmé, images en baisse) et écrit
// le corps d'une issue. Ne fait jamais échouer le job ; le workflow ouvre l'issue si `problems=true`.
//
//   node scripts/pipeline-check.mjs [--meta-url URL | --meta-file f.json] [--now ISO] [--max-hours 24]
//        [--counts cards=4100,logos=40 --expected cards=4126,logos=41] [--out body.md] [--title "..."]
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { checkCounts, checkMetaAge } from './lib/health.mjs'

const a = process.argv.slice(2)
const opt = (n, d = '') => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d }
const kv = (s) => Object.fromEntries(s.split(',').filter(Boolean).map((p) => p.split('=')).map(([k, v]) => [k, Number(v)]))
const now = opt('now') ? Date.parse(opt('now')) : Date.now()
const problems = []

if (opt('meta-url') || opt('meta-file')) {
  try {
    const text = opt('meta-file') ? readFileSync(opt('meta-file'), 'utf8') : await (await fetch(opt('meta-url'), { signal: AbortSignal.timeout(30000) })).text()
    problems.push(...checkMetaAge(JSON.parse(text).generatedAt, now, Number(opt('max-hours', 24))))
  } catch (e) { problems.push(`meta.json introuvable ou invalide (${e.message}).`) }
}
if (opt('counts')) problems.push(...checkCounts(kv(opt('counts')), kv(opt('expected'))))

const title = opt('title', 'Pipelines : anomalie détectée')
const body = problems.length
  ? `${title}\n\n${problems.map((p) => `- ${p}`).join('\n')}\n\nContrôle automatique (\`scripts/pipeline-check.mjs\`). L'issue se ferme toute seule quand le contrôle redevient vert.\n`
  : ''
console.log(problems.length ? body : 'OK')
if (opt('out')) writeFileSync(opt('out'), body)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `problems=${problems.length > 0}\n`)
