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

  // Gros pourcentage + total
  ctx.textAlign = 'left'
  const pctTxt = fmtPct(data.pct)
  ctx.font = `900 200px ${FONT}`
  const w = ctx.measureText(pctTxt).width
  const tg = ctx.createLinearGradient(P, 200, P + w + 120, 380)
  tg.addColorStop(0, '#ffd36e'); tg.addColorStop(0.5, '#ff6ec7'); tg.addColorStop(1, '#6ec6ff')
  ctx.fillStyle = tg; ctx.fillText(pctTxt, P, 380)
  ctx.font = `900 90px ${FONT}`; ctx.fillText('%', P + w + 12, 380)
  ctx.fillStyle = '#f3f0ff'; ctx.globalAlpha = 0.85; ctx.font = `700 36px ${FONT}`
  ctx.fillText(`${data.owned.toLocaleString('fr-FR')} / ${data.total.toLocaleString('fr-FR')} cartes`, P, 440); ctx.globalAlpha = 1

  // Anneaux de complétion par extension (5 par ligne)
  const cols = 5, gap = 18, bw = SHARE_W - 2 * P
  const d = Math.floor((bw - gap * (cols - 1)) / cols)
  const top = 500
  data.sets.forEach((s, i) => {
    const cx = P + (i % cols) * (d + gap) + d / 2
    const cy = top + Math.floor(i / cols) * (d + gap) + d / 2
    const r = d / 2 - 9
    ctx.lineWidth = 16; ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    if (s.pct > 0) {
      const rg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); rg.addColorStop(0, '#6ec6ff'); rg.addColorStop(1, '#b06eff')
      ctx.strokeStyle = s.pct >= 1 ? '#6effc2' : rg
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.pct)); ctx.stroke()
    }
    const logo = logos[i]
    ctx.fillStyle = '#f3f0ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (logo) {
      const k = Math.min((d - 70) / logo.width, 42 / logo.height)
      ctx.drawImage(logo, cx - (logo.width * k) / 2, cy - 26 - (logo.height * k) / 2, logo.width * k, logo.height * k)
    } else {
      ctx.font = `900 32px ${FONT}`; ctx.fillText(s.id, cx, cy - 22)
    }
    ctx.font = `700 26px ${FONT}`; ctx.globalAlpha = 0.8; ctx.fillText(`${Math.floor(s.pct * 100)} %`, cx, cy + 28); ctx.globalAlpha = 1
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  })

  // Pastilles
  const rows = Math.max(1, Math.ceil(data.sets.length / cols))
  const py = top + rows * (d + gap) + 14
  let px = P
  ctx.font = `800 32px ${FONT}`
  for (const t of [`${fmtPct(data.pct2)} % avec 2e copie`, `${data.packs.toLocaleString('fr-FR')} packs ouverts`]) {
    const pw = ctx.measureText(t).width + 52
    rrect(ctx, px, py, pw, 66, 33); ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill()
    ctx.fillStyle = '#f3f0ff'; ctx.textBaseline = 'middle'; ctx.fillText(t, px + 26, py + 34); ctx.textBaseline = 'alphabetic'
    px += pw + 16
  }

  // Pied
  ctx.font = `700 26px ${FONT}`; ctx.globalAlpha = 0.6; ctx.fillStyle = '#f3f0ff'
  ctx.fillText('Holothèque · suivi de collection Pokémon TCG Pocket', P, SHARE_H - 50); ctx.globalAlpha = 1

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image impossible à générer'))), 'image/png'))
}
