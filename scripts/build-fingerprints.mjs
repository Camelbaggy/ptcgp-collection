#!/usr/bin/env node
// Empreintes d'illustration de toutes les cartes (même calcul que l'appli, src/lib/videoScan/fingerprint.ts),
// pour reconnaître les cartes d'une capture ou d'une vidéo sans recharger toutes les images.
// Sortie : public/data/fingerprints.json  { "v": 1, "fp": { "<cardId>": "<base64>" } }  (généré, non versionné)
// Usage : node --experimental-strip-types scripts/build-fingerprints.mjs [--cards-dir public]
import { readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { encodeFp, fingerprint } from '../src/lib/videoScan/fingerprint.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const i = args.indexOf('--cards-dir')
const pub = resolve(root, i >= 0 ? args[i + 1] : 'public')
const cards = JSON.parse(await readFile(resolve(root, 'public/data/cards.json'), 'utf8'))
const out = {}
let n = 0, missing = 0
for (const c of cards) {
  const rel = c.image && c.image.length ? c.image : `cards/${c.setId}/${c.id}.webp`
  const f = resolve(pub, rel)
  if (!(await stat(f).then((s) => s.size > 0, () => false))) { missing++; continue }
  try {
    const { data, info } = await sharp(f).resize({ width: 120 }).flatten({ background: '#f0f4fc' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    out[c.id] = encodeFp(fingerprint({ width: info.width, height: info.height, data }))
    n++
  } catch (e) { missing++; console.warn('fingerprint', c.id, e.message) }
}
await writeFile(resolve(root, 'public/data/fingerprints.json'), JSON.stringify({ v: 1, fp: out }))
console.log(`fingerprints: ${n} cards, ${missing} without image`)
