// Outil de mesure de l'interface (lot L02) : une seule définition des mesures pour les agents et la CI.
//
//   npm run build            (avec BASE_PATH=/ptcgp-collection/ comme en CI)
//   npm run ui:audit -- [--shots <dossier>] [--out <dossier>] [--url <adresse>] [--full] [--only a,b] [--strict]
//
// Mesures par écran : débordement horizontal, cibles tactiles < 44 px, tailles de police distinctes, textes < 12 px,
// mots du premier écran, mots d'explication (phrases ≥ 8 mots hors boutons/liens), position verticale du premier
// élément de contenu (attribut `data-content-start`), violations de contraste axe-core (wcag2a/aa).
// Données : jeu de démonstration de `e2e/demo-backup.mjs`, ou le fichier indiqué par la variable BACKUP.
// Sortie : ui-audit.json et ui-audit.md (+ résumé du job CI). Code de sortie 0 sauf avec --strict (étape bloquante de la CI, lot L16).
//
// Mode --strict : échec (code 1) si, sur un écran, l'une de ces règles est enfreinte (voir `violationsOf`) :
//   débordement horizontal · cible tactile < 44 px (hors lien dans une phrase et hors commande dans un <label> assez haut) ·
//   texte < 12 px · contraste axe insuffisant · plus de 60 mots au premier écran (80 pour Stats) · phrase d'explication
//   (≥ 8 mots) hors bouton/lien · premier contenu sous 300 px · erreur JavaScript.
// Les mots ne sont comptés que sur les vues mobiles (412 et 360 px : c'est le budget du plan) ; les autres règles valent partout.
// Les dérogations sont dans `EXCEPTIONS` : chacune est justifiée, plafonnée (elle ne peut pas empirer) et ne couvre que la
// règle citée. Pour en ajouter une, écris la raison ; pour la retirer, baisse l'écran sous la limite.
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDemoBackup } from './demo-backup.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined }
const outDir = opt('--out') ?? 'ui-audit'
const shotsDir = opt('--shots')
const only = opt('--only')?.split(',')
const strict = flag('--strict')
const full = flag('--full')
const PORT = 4174
const WORD_LIMIT = 60, WORD_LIMIT_STATS = 80, HELP_LIMIT = 0, CONTENT_START_MAX = 300

/** Dérogations au contrôle strict, par écran : plafond accepté (jamais plus que la valeur actuelle) et raison. */
const EXCEPTIONS = {
  // Pages de lecture : leur contenu est du texte (règle 1 : pas de mode d'emploi sur les écrans d'usage, mais ici c'est le sujet).
  aide: { words: 140, help: 120, why: 'page d’aide : le texte est le contenu' },
  'a-propos': { words: 140, help: 95, why: 'mentions légales, crédits, confidentialité : texte obligatoire' },
  guide: { words: 125, help: 85, why: 'guide pas à pas Pokémon-Zone : le texte est le contenu' },
  nouvelle: { help: 8, why: 'écran de saisie rare : une phrase de consigne' },
  themed: { help: 22, why: 'état vide de Collections à thème (consigne d’import)' },
  'stats-vie': { help: 25, why: 'état vide de l’onglet À vie (consigne d’import) ; sans instantané PZ dans le jeu de démonstration' },
  // Dettes connues, à résorber avant de baisser le plafond (le plafond ne doit jamais monter).
  home: { words: 76, why: 'tableau de bord : chiffres, noms de boosters et de cartes (données, pas de prose)' },
  evenements: { words: 85, why: 'liste d’évènements : noms, durées et catégories (données)' },
  meta: { words: 98, why: 'liste de decks : noms, tiers et parts (données)' },
  pokedex: { words: 142, why: 'grille d’espèces : noms et compteurs (données)' },
  points: { words: 119, help: 12, why: 'tableau de prix par rareté et achats conseillés (données) ; une phrase de source à déplacer dans « ? »' },
  historique: { words: 68, help: 12, why: 'liste d’évènements datés ; une phrase de synthèse à déplacer dans « ? »' },
  partage: { help: 8, why: 'une phrase de consigne à déplacer dans « ? »' },
  ami: { help: 8, why: 'une phrase de consigne à déplacer dans « ? »' },
}
const BASE_PATH = '/ptcgp-collection/'
let base = opt('--url')

/** Écrans : [nom, route]. */
const SCREENS = [
  ['home', ''], ['ajout-booster', 'ajout?onglet=booster'], ['ajout-boosters', 'ajout?onglet=boosters'], ['ajout-extension', 'ajout?onglet=extension'],
  ['ajout-massive', 'ajout?onglet=massive'], ['ajout-saisie', 'ajout?onglet=saisie'],
  ['echange', 'echange-partage?onglet=echange'], ['partage', 'echange-partage?onglet=partage'], ['ami', 'echange-partage?onglet=ami'],
  ['collection', 'collection'], ['evenements', 'evenements'], ['meta', 'meta'], ['pokedex', 'pokedex'], ['souhaits', 'souhaits'],
  ['stats-collection', 'stats?onglet=collection'], ['stats-activite', 'stats?onglet=activite'], ['stats-vie', 'stats?onglet=vie'],
  ['historique', 'historique'], ['reglages-profil', 'reglages?onglet=profil'], ['reglages-affichage', 'reglages?onglet=affichage'],
  ['reglages-donnees', 'reglages?onglet=donnees'], ['reglages-appli', 'reglages?onglet=appli'],
  ['aide', 'aide'], ['a-propos', 'a-propos'], ['points', 'points-booster'], ['themed', 'collections-a-theme'],
  ['guide', 'guide-pokemon-zone'], ['plus', 'plus'], ['nouvelle', 'extension/nouvelle'],
]
const pick = (names) => SCREENS.filter(([n]) => names.includes(n))
const DESKTOP = ['home', 'collection', 'stats-collection', 'stats-activite', 'ajout-booster', 'echange', 'reglages-donnees', 'meta', 'pokedex', 'points', 'historique', 'plus']
const RUNS = [
  { tag: 'm', w: 412, h: 900, theme: 'dark', list: SCREENS, axe: true },
  { tag: 'd', w: 1280, h: 800, theme: 'dark', list: pick(DESKTOP), axe: false },
  ...(full ? [
    { tag: 'l', w: 412, h: 900, theme: 'light', list: pick(['home', 'collection', 'stats-collection', 'ajout-booster', 'plus', 'echange', 'reglages-affichage']), axe: true },
    { tag: 's', w: 360, h: 740, theme: 'dark', list: pick(['home', 'ajout-booster', 'stats-collection', 'echange', 'reglages-profil']), axe: false },
  ] : []),
].map((r) => ({ ...r, list: only ? r.list.filter(([n]) => only.includes(n)) : r.list })).filter((r) => r.list.length)

async function startServer() {
  if (!existsSync('dist')) throw new Error('Pas de dossier dist : lance d’abord `BASE_PATH=/ptcgp-collection/ npm run build`.')
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { env: { ...process.env, BASE_PATH }, stdio: 'ignore' })
  const url = `http://localhost:${PORT}${BASE_PATH}`
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return { child, url } } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error('Le serveur de prévisualisation ne répond pas.')
}

/** Mesures dans la page (exécutées côté navigateur). */
function measure(vh) {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length
  const small = [...document.querySelectorAll('button,a[href],[role=button],[role=tab],select,input:not([type=hidden])')]
    .filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44 })
    .filter((e) => { // lien au milieu d'une phrase : exempté (WCAG 2.5.8) ; commande dans un <label> d'au moins 44 px : la cible est le label
      const blk = e.closest('p,li,small,span.muted')
      if (e.tagName === 'A' && blk && blk !== e && (blk.textContent || '').trim().length > (e.textContent || '').trim().length + 6) return false
      const lab = e.closest('label')
      if (lab && lab.getBoundingClientRect().height >= 44) return false
      return true
    })
    .map((e) => `${(e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  const fonts = {}
  let tiny = 0
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const f = parseFloat(getComputedStyle(e).fontSize)
    fonts[f] = (fonts[f] || 0) + 1
    if (f < 12) tiny++
  }
  let first = 0, help = 0
  const tw = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue
    const e = n.parentElement, r = e.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue
    if (r.top < vh - 84) { // 84 px : barre de navigation du bas
      first += words(t)
      if (words(t) >= 8 && !e.closest('button,a,[role=tab]')) help += words(t)
    }
  }
  let cs = null
  for (const el of document.querySelectorAll('[data-content-start]')) {
    const box = getComputedStyle(el).display === 'contents' ? el.firstElementChild : el
    const r = box?.getBoundingClientRect()
    if (r && r.width > 0 && r.height > 0) { cs = Math.round(r.top + scrollY); break }
  }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight,
    small: small.length, smallEx: [...new Set(small)].slice(0, 6),
    fontSizes: Object.keys(fonts).length, tiny, words: first, helpWords: help, contentStart: cs,
  }
}

const server = base ? null : await startServer()
base = base ?? server.url
const backup = process.env.BACKUP ? JSON.parse(readFileSync(process.env.BACKUP, 'utf8')) : buildDemoBackup()
const payload = { name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }
if (shotsDir) mkdirSync(shotsDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const rows = []
const errors = []
const browser = await chromium.launch()
try {
  for (const run of RUNS) {
    const ctx = await browser.newContext({ viewport: { width: run.w, height: run.h }, serviceWorkers: 'block', deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    page.on('pageerror', (e) => errors.push(`${run.tag}: ${e.message.slice(0, 160)}`))
    await page.addInitScript((t) => { try { localStorage.setItem('ptcgp:theme', t); localStorage.setItem('ptcgp:reveal.enabled', 'false') } catch { /* ignore */ } }, run.theme)
    await page.goto(base + '#/reglages?onglet=donnees')
    await page.locator('input[type=file]').first().setInputFiles(payload)
    await page.getByText('Sauvegarde restaurée').waitFor({ timeout: 30_000 })
    for (const [name, route] of run.list) {
      await page.goto(base + '#/' + route)
      await page.waitForTimeout(1200)
      const m = await page.evaluate(measure, run.h)
      let contrast = null, axeAll = null
      if (run.axe) {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        axeAll = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, ex: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 90)) }))
        contrast = r.violations.filter((v) => v.id === 'color-contrast').reduce((a, v) => a + v.nodes.length, 0)
      }
      if (shotsDir) await page.screenshot({ path: join(shotsDir, `${run.tag}-${name}.png`), fullPage: true }).catch(() => {})
      rows.push({ run: run.tag, viewport: `${run.w}x${run.h}`, theme: run.theme, screen: name, ...m, contrast, axe: axeAll })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  server?.child.kill()
}

writeFileSync(join(outDir, 'ui-audit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), errors, rows }, null, 1))
const cell = (v) => (v === null || v === undefined ? '–' : String(v))
let md = '## Mesure de l’interface\n\n'
md += '| Vue | Écran | Mots 1er écran | Dont explications | Début du contenu (px) | Débord. | Cibles < 44 px | Polices | Textes < 12 px | Contrastes |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n'
for (const r of rows) md += `| ${r.run} | ${r.screen} | ${r.words} | ${r.helpWords} | ${cell(r.contentStart)} | ${r.overflow} | ${r.small} | ${r.fontSizes} | ${r.tiny} | ${cell(r.contrast)} |\n`
if (errors.length) md += `\nErreurs JS :\n${[...new Set(errors)].map((e) => `- ${e}`).join('\n')}\n`
writeFileSync(join(outDir, 'ui-audit.md'), md)
console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)

/** Règles du contrôle strict, une ligne de mesure à la fois. Renvoie la liste des infractions. */
function violationsOf(r) {
  const out = []
  const ex = EXCEPTIONS[r.screen] ?? {}
  if (r.overflow > 1) out.push(`débordement horizontal de ${r.overflow} px`)
  if (r.small > 0) out.push(`${r.small} cible(s) < 44 px (${r.smallEx.join(', ')})`)
  if (r.tiny > 0) out.push(`${r.tiny} texte(s) < 12 px`)
  if (r.contrast) out.push(`${r.contrast} contraste(s) insuffisant(s)`)
  if (r.contentStart !== null && r.contentStart > CONTENT_START_MAX) out.push(`premier contenu à ${r.contentStart} px (> ${CONTENT_START_MAX})`)
  if (Number(r.viewport.split('x')[0]) <= 412) { // budget de mots défini pour les vues mobiles
    const wmax = ex.words ?? (r.screen.startsWith('stats') ? WORD_LIMIT_STATS : WORD_LIMIT)
    if (r.words > wmax) out.push(`${r.words} mots au premier écran (max ${wmax}${ex.words ? `, dérogation : ${ex.why}` : ''})`)
    const hmax = ex.help ?? HELP_LIMIT
    if (r.helpWords > hmax) out.push(`${r.helpWords} mots d’explication hors état vide (max ${hmax}${ex.help ? `, dérogation : ${ex.why}` : ''})`)
  }
  return out
}
const failures = rows.map((r) => ({ r, v: violationsOf(r) })).filter((x) => x.v.length)
if (failures.length || errors.length) {
  let f = '\n### Infractions au contrôle strict\n\n'
  for (const { r, v } of failures) f += `- **${r.run} · ${r.screen}** (${r.viewport}) : ${v.join(' ; ')}\n`
  for (const e of new Set(errors)) f += `- erreur JS ${e}\n`
  console.log(f)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, f)
  writeFileSync(join(outDir, 'ui-audit.md'), md + f)
}
if (strict && (errors.length || failures.length)) process.exit(1)
