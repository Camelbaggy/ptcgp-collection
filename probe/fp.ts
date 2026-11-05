import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { fingerprint, encodeFp } from './videoScan/fingerprint'
const cards = JSON.parse(readFileSync('public/data/cards.json', 'utf8')).filter((c: any) => c.setId === 'C1')
for (const c of cards) {
  const f = `public/cards/C1/${c.id}.webp`
  if (!existsSync(f)) { console.log('FP', c.id, 'MISSING'); continue }
  const { data, info } = await sharp(f).flatten({ background: '#f0f4fc' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  console.log('FP', c.id, info.width, info.height, encodeFp(fingerprint({ width: info.width, height: info.height, data })))
}
