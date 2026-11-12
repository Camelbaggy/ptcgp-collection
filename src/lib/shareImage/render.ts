import { logoUrl } from '../assets'
import { fmtPct, type ShareData } from './data'

export const SHARE_W = 1080
export const SHARE_H = 1350
const FONT = 'Nunito, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = url
  })
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/**
 * Dessine l'image de progression (option A : gros % puis une barre par extension, logos d'extension).
 * Tout est dessiné localement dans un canvas ; rien n'est envoyé nulle part.
 */
export async function renderShareImage(data: ShareData): Promise<Blob> {
  try { await document.fonts?.load(`900 100px Nunito`); await document.fonts?.load(`700 30px Nunito`) } catch { /* police système */ }
  const logos = await Promise.all(data.sets.map((s) => loadImage(logoUrl(s.id))))
  const c = document.createElement('canvas')
  c.width = SHARE_W; c.height = SHARE_H
  const ctx = c.getContext('2d')!
  const P = 70

  // Fond
  ctx.fillStyle = '#14102b'; ctx.fillRect(0, 0, SHARE_W, SHARE_H)
  let g = ctx.createRadialGradient(870, -60, 0, 870, -60, 760); g.addColorStop(0, '#5b3fd1'); g.addColorStop(1, 'rgba(91,63,209,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, SHARE_W, SHARE_H)
  g = ctx.createRadialGradient(-20, SHARE_H + 60, 0, -20, SHARE_H + 60, 640); g.addColorStop(0, '#0e8aa8'); g.addColorStop(1, 'rgba(14,138,168,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, SHARE_W, SHARE_H)

  // Logo Holothèque (carte sombre au cadre arc-en-ciel) + nom + date
  const lg = ctx.createLinearGradient(P, 70, P + 64, 134)
  ;['#ff6ec7', '#ffd36e', '#6effc2', '#6ec6ff', '#b06eff'].forEach((col, i, a) => lg.addColorStop(i / (a.length - 1), col))
  rrect(ctx, P, 70, 64, 64, 14); ctx.fillStyle = lg; ctx.fill()
  rrect(ctx, P + 5, 75, 54, 54, 10); ctx.fillStyle = '#1b1633'; ctx.fill()
  ctx.fillStyle = '#f3f0ff'; ctx.textBaseline = 'alphabetic'
  ctx.font = `900 40px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Holothèque', P + 84, 116)
  ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'right'; ctx.globalAlpha = 0.7; ctx.fillText(data.date, SHARE_W - P, 114); ctx.globalAlpha = 1

  // Titre + gros pourcentage
  ctx.textAlign = 'left'; ctx.globalAlpha = 0.85; ctx.font = `700 38px ${FONT}`
  ctx.fillText('Ma collection Pokémon TCG Pocket', P, 228); ctx.globalAlpha = 1
  const pctTxt = fmtPct(data.pct)
  ctx.font = `900 250px ${FONT}`
  const w = ctx.measureText(pctTxt).width
  const tg = ctx.createLinearGradient(P, 260, P + w + 150, 480)
  tg.addColorStop(0, '#ffd36e'); tg.addColorStop(0.5, '#ff6ec7'); tg.addColorStop(1, '#6ec6ff')
  ctx.fillStyle = tg; ctx.fillText(pctTxt, P, 470)
  ctx.font = `900 110px ${FONT}`; ctx.fillText('%', P + w + 14, 470)
  ctx.fillStyle = '#f3f0ff'; ctx.globalAlpha = 0.85; ctx.font = `700 38px ${FONT}`
  ctx.fillText(`${data.owned.toLocaleString('fr-FR')} cartes sur ${data.total.toLocaleString('fr-FR')}`, P, 535); ctx.globalAlpha = 1

  // Barre globale
  const bw = SHARE_W - 2 * P
  rrect(ctx, P, 570, bw, 34, 17); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill()
  const bar = ctx.createLinearGradient(P, 0, P + bw, 0); bar.addColorStop(0, '#6ec6ff'); bar.addColorStop(0.5, '#b06eff'); bar.addColorStop(1, '#ff6ec7')
  if (data.pct > 0) { rrect(ctx, P, 570, Math.max(34, bw * Math.min(1, data.pct)), 34, 17); ctx.fillStyle = bar; ctx.fill() }

  // Pastilles
  let px = P
  ctx.font = `800 32px ${FONT}`
  for (const t of [`${fmtPct(data.pct2)} % avec 2e copie`, `${data.packs.toLocaleString('fr-FR')} packs ouverts`]) {
    const pw = ctx.measureText(t).width + 52
    rrect(ctx, px, 632, pw, 66, 33); ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill()
    ctx.fillStyle = '#f3f0ff'; ctx.textBaseline = 'middle'; ctx.fillText(t, px + 26, 666); ctx.textBaseline = 'alphabetic'
    px += pw + 16
  }

  // Barres par extension
  ctx.font = `800 40px ${FONT}`; ctx.fillStyle = '#f3f0ff'; ctx.fillText('Par extension', P, 782)
  const n = Math.max(1, data.sets.length)
  const rowH = Math.min(64, Math.floor(430 / n))
  data.sets.forEach((s, i) => {
    const y = 812 + i * rowH
    const logo = logos[i]
    rrect(ctx, P, y, 150, rowH - 8, 12); ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fill()
    if (logo) {
      const k = Math.min(130 / logo.width, (rowH - 22) / logo.height)
      ctx.drawImage(logo, P + 75 - (logo.width * k) / 2, y + (rowH - 8) / 2 - (logo.height * k) / 2, logo.width * k, logo.height * k)
    } else {
      ctx.font = `800 26px ${FONT}`; ctx.fillStyle = '#f3f0ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(s.id, P + 75, y + (rowH - 8) / 2 + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    }
    const tx = P + 172, tw = bw - 172 - 130, th = Math.min(22, rowH - 30)
    const ty = y + (rowH - 8) / 2 - th / 2
    rrect(ctx, tx, ty, tw, th, th / 2); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill()
    if (s.pct > 0) {
      const fg = ctx.createLinearGradient(tx, 0, tx + tw, 0); fg.addColorStop(0, '#6ec6ff'); fg.addColorStop(1, '#b06eff')
      rrect(ctx, tx, ty, Math.max(th, tw * s.pct), th, th / 2); ctx.fillStyle = fg; ctx.fill()
    }
    ctx.font = `800 30px ${FONT}`; ctx.fillStyle = '#f3f0ff'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.floor(s.pct * 100)} %`, SHARE_W - P, y + (rowH - 8) / 2 + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  })

  // Pied
  ctx.font = `700 26px ${FONT}`; ctx.globalAlpha = 0.6; ctx.fillStyle = '#f3f0ff'
  ctx.fillText('Holothèque · suivi de collection Pokémon TCG Pocket', P, SHARE_H - 50); ctx.globalAlpha = 1

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image impossible à générer'))), 'image/png'))
}
