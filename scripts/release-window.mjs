#!/usr/bin/env node
// Decides whether the update-sets (every 3 h) run must do its job. Prints "run=true|false" (and appends it to
// $GITHUB_OUTPUT). True for the daily 06:15 UTC run, a manual dispatch (--always), or when today (UTC) is within
// [release date, release date + 3 days] of an entry of public/data/releases.json (committed).
//
//   node scripts/release-window.mjs [--releases public/data/releases.json] [--now ISO] [--always]
import { appendFileSync, readFileSync } from 'node:fs'
import { shouldRun } from '../src/lib/events/releaseWindow.ts'

const a = process.argv.slice(2)
const opt = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d }
let releases = []
try { releases = JSON.parse(readFileSync(opt('releases', 'public/data/releases.json'), 'utf8')) } catch { /* none */ }
const run = shouldRun(releases, new Date(opt('now', '') || Date.now()), a.includes('--always'))
console.log(run ? 'run=true' : 'run=false (not the daily run and not a release window)')
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`)
