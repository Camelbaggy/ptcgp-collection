// Génère les icônes de lancement Android depuis public/icons/icon-512.png (notre propre logo).
// Usage : node scripts/android-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = new URL('../public/icons/icon-512.png', import.meta.url).pathname
const RES = new URL('../android/app/src/main/res/', import.meta.url).pathname
const BG = '#15122e'
// densité -> facteur (mdpi = 1) ; icône classique 48 dp, adaptative 108 dp
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [d, f] of Object.entries(DENSITIES)) {
  const dir = `${RES}mipmap-${d}/`
  mkdirSync(dir, { recursive: true })
  const legacy = Math.round(48 * f)
  const adaptive = Math.round(108 * f)

  const square = await sharp(SRC).resize(legacy, legacy).png().toBuffer()
  await sharp(square).toFile(`${dir}ic_launcher.png`)

  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(`${dir}ic_launcher_round.png`)

  // premier plan adaptatif : logo à 60 % au centre (zone sûre = 66 %), fond transparent
  const inner = Math.round(adaptive * 0.6)
  const logo = await sharp(SRC).resize(inner, inner).png().toBuffer()
  const rounded = await sharp(logo)
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><rect width="${inner}" height="${inner}" rx="${Math.round(inner * 0.22)}"/></svg>`), blend: 'dest-in' }])
    .png().toBuffer()
  await sharp({ create: { width: adaptive, height: adaptive, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rounded, gravity: 'center' }]).png().toFile(`${dir}ic_launcher_foreground.png`)
}
console.log('icônes Android écrites, fond adaptatif', BG)
