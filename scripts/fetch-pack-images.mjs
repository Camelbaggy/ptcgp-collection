#!/usr/bin/env node
// Booster pack artwork from Pokekalos (robots.txt allows it) -> public/packs/<boosterId, ASCII>.webp (max 320px tall).
// Explicit table booster id -> image path (verified from the Pokekalos "cartodex" extension pages on 2026-11-04).
// Promo boosters have no single pack and are skipped. Never fatal: prints a summary.
//
//   node scripts/fetch-pack-images.mjs [--force] [--out public/packs]
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emblemFile, getBuffer, loadSharp } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const force = flag('force')
const outDir = resolve(root, opt('out', 'public/packs'))

const BASE = 'https://www.media.pokekalos.fr/img/jeux/pocket/extensions/'
// booster id -> '<pokekalos set slug>/boosters/<file>.png'
export const PACKS = {
  'A1-Dracaufeu': 'puissance-genetique/boosters/dracaufeu.png',
  'A1-Mewtwo': 'puissance-genetique/boosters/mewtwo.png',
  'A1-Pikachu': 'puissance-genetique/boosters/pikachu.png',
  'A1a-Unique': 'l-ile-fabuleuse/boosters/mew.png',
  'A2-Dialga': 'choc-spatio-temporel/boosters/dialga.png',
  'A2-Palkia': 'choc-spatio-temporel/boosters/palkia.png',
  'A2a-Unique': 'lumiere-triomphale/boosters/arceus.png',
  'A2b-Unique': 'rejouissances-rayonnantes/boosters/giratina.png',
  'A3-Lunala': 'gardiens-astraux/boosters/lunala.png',
  'A3-Solgaleo': 'gardiens-astraux/boosters/solgaleo.png',
  'A3a-Unique': 'crise-interdimensionnelle/boosters/mouscoto.png',
  'A3b-Unique': 'la-clairiere-d-evoli/boosters/evoli.png',
  'A4-Ho-Oh': 'sagesse-entre-ciel-et-mer/boosters/ho-oh.png',
  'A4-Lugia': 'sagesse-entre-ciel-et-mer/boosters/lugia.png',
  'A4a-Unique': 'source-secrete/boosters/suicune.png',
  'A4b-Unique': 'booster-de-luxe-ex/boosters/booster.png',
  'B1-Altaria': 'mega-ascension/boosters/mega-altaria.png',
  'B1-Braségali': 'mega-ascension/boosters/mega-brasegali.png',
  'B1-Léviator': 'mega-ascension/boosters/mega-leviator.png',
  'B1a-Unique': 'embrasement-ecarlate/boosters/mega-dracaufeu-y.png',
  'B2-Unique': 'parade-onirique/boosters/mega-gardevoir.png',
  'B2a-Unique': 'merveilles-de-paldea/boosters/merveilles-de-paldea.png',
  'B2b-Unique': 'mega-rayonnement/boosters/mega-rayonnement.png',
  'B3-Unique': 'aura-palpitante/boosters/aura-palpitante.png',
  'B3a-Unique': 'propulsion-paradoxe/boosters/propulsion-paradoxe.png',
  'B3b-Unique': 'jours-heureux/boosters/jours-heureux.png',
  'B4-Unique': 'domination-celeste/boosters/domination-celeste.png',
  'B4a-Unique': 'l-ambition-de-la-team-rocket/boosters/l-ambition-de-la-team-rocket.png',
  'B4b-Unique': 'booster-de-luxe-mega/boosters/booster-de-luxe-mega.png',
  'C1-Mewtwo': 'fusion-double/boosters/fusion-double-mega-mewtwo-x.png',
  'C1-Pikachu': 'fusion-double/boosters/fusion-double-pikachu.png',
  'SP1-Unique': 'sp1/boosters/sp-premiers-partenaires.png',
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const sharp = loadSharp()
    await mkdir(outDir, { recursive: true })
    let written = 0, skipped = 0
    const failed = []
    for (const [id, path] of Object.entries(PACKS)) {
      const file = join(outDir, emblemFile(id))
      if (!force && (await stat(file).then((s) => s.size > 0, () => false))) { skipped++; continue }
      try {
        await new Promise((r) => setTimeout(r, 600)) // polite throttle
        const buf = await getBuffer(BASE + path, { retries: 1, headers: { 'user-agent': 'ptcgp-collection-build' } })
        if (!buf) { failed.push(`${id} (${path})`); continue }
        await writeFile(file, await sharp(buf).resize({ height: 320, width: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer())
        written++
      } catch (err) { failed.push(`${id} (${err.message})`) }
    }
    console.log(`pack images: written ${written}, already present ${skipped}, failed ${failed.length}`)
    if (failed.length) console.log('failed:', failed.join(', '))
  } catch (e) { console.log('pack images: error (not fatal):', e.message) }
}
