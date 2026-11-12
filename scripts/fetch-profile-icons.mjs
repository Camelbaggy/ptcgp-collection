#!/usr/bin/env node
// Icônes de profil du jeu (image de profil d'un membre du foyer) depuis Serebii, embarquées dans l'appli au déploiement :
//   https://www.serebii.net/tcgpocket/icons.shtml  -> public/profile-icons/<id>.webp (128 px)
// et le manifeste public/data/profile-icons.json { updatedAt, icons: [{id, nameEn, method, path, added}] }.
// Serebii ne liste que les icônes récentes : les icônes déjà publiées (manifeste et images du site en ligne) sont
// reprises, puis complétées. Jamais bloquant ; images jamais commitées (© The Pokémon Company).
// L'appli complète avec le catalogue Pokémon-Zone lu dans le navigateur (src/lib/profileIcons/).
//
//   node scripts/fetch-profile-icons.mjs [--force] [--page <url|fichier>] [--prev <url du site>] [--out public]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBuffer, getText, loadSharp, sleep } from './lib/common.mjs'
import { mergeIconLists, parseSerebiiIcons } from './lib/profileIcons.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SEREBII_ICONS = 'https://www.serebii.net/tcgpocket/icons.shtml'
export const LIVE_SITE = 'https://camelbaggy.github.io/ptcgp-collection/'
export const MANIFEST = 'data/profile-icons.json'

async function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
  const force = args.includes('--force')
  const PAGE = opt('page', SEREBII_ICONS)
  const PREV = opt('prev', LIVE_SITE)
  const out = resolve(root, opt('out', 'public'))
  const sharp = loadSharp()
  const present = (f) => stat(f).then((s) => s.size > 0, () => false)
  await mkdir(join(out, 'profile-icons'), { recursive: true })
  await mkdir(join(out, 'data'), { recursive: true })

  // Liste déjà publiée : celle du site en ligne, sinon la copie locale (cache).
  const prevText = (PREV && await getText(PREV + MANIFEST, { retries: 1 })) || await readFile(join(out, MANIFEST), 'utf8').catch(() => null)
  let prev = []
  try { prev = JSON.parse(prevText ?? 'null')?.icons ?? [] } catch { prev = [] }

  const html = /^https?:/.test(PAGE) ? await getText(PAGE) : await readFile(PAGE, 'utf8').catch(() => null)
  const fresh = html ? parseSerebiiIcons(html, /^https?:/.test(PAGE) ? PAGE : SEREBII_ICONS) : []
  if (!html) console.log('profile-icons: Serebii page unreachable (not fatal)')
  const { icons, added } = mergeIconLists(prev, fresh.map(({ id, nameEn, method }) => ({ id, nameEn, method })), new Date().toISOString().slice(0, 10))
  const srcOf = new Map(fresh.map((f) => [f.id, f.src]))

  const count = { written: 0, cached: 0, failed: 0 }
  const kept = []
  for (const icon of icons) {
    const path = `profile-icons/${icon.id}.webp`
    const file = join(out, path)
    let state = 'cached'
    if (force || !(await present(file))) {
      await sleep(150) // throttle
      // Serebii d'abord ; une icône qu'il ne liste plus vient de notre propre site.
      const buf = (srcOf.has(icon.id) && await getBuffer(srcOf.get(icon.id), { retries: 1 })) || (PREV && await getBuffer(PREV + path, { retries: 1 }))
      state = 'failed'
      if (buf) {
        try {
          await writeFile(file, await sharp(buf).resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer())
          state = 'written'
        } catch { /* image illisible */ }
      }
    }
    count[state]++
    if (state !== 'failed') kept.push({ ...icon, path })
  }
  // Manifeste = ce qui est sur le disque (un échec partiel reste cohérent).
  await writeFile(join(out, MANIFEST), JSON.stringify({ updatedAt: new Date().toISOString(), icons: kept }))
  console.log(`profile-icons: ${kept.length} icons (new: ${added.length ? added.join(', ') : 'none'}); written ${count.written}, cached ${count.cached}, failed ${count.failed}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => console.log('profile-icons: error (not fatal):', e.message))
}
