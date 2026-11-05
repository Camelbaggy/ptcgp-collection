import type { Box } from './fingerprint'
import type { RGBAImage } from './image'

/** Rapport hauteur / largeur d'une carte (63 × 88 mm). */
export const CARD_RATIO = 88 / 63

/**
 * Repère les cartes d'une capture d'écran de fin d'ouverture de booster (4 à 6 cartes,
 * disposées en rangées sur fond clair). Méthode par projections : les rangées de cartes
 * puis, dans chaque rangée, les colonnes où l'écran n'est pas le fond uni.
 * Les étiquettes « NOUVEAU » et les badges d'exemplaires, plus petits, sont ignorés.
 */
export function detectCards(img: RGBAImage): Box[] {
  const { width: W, height: H, data } = img
  // masque « pas le fond » : le fond du jeu est clair et peu saturé
  const fg = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < fg.length; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    fg[i] = mx - mn > 38 || mx < 175 ? 1 : 0
  }
  const minCardW = W * 0.12
  const rowProf = new Float32Array(H)
  for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) s += fg[y * W + x]; rowProf[y] = s / W }
  const found: Box[] = []
  const rowRuns = mergeRuns(runsAbove(smooth(rowProf, Math.round(W * 0.008)), 0.18, 4), W * 0.015).filter(([a, b]) => b - a >= minCardW * 0.9)
  for (const [y0, y1] of rowRuns) {
    const colProf = new Float32Array(W)
    for (let x = 0; x < W; x++) { let s = 0; for (let y = y0; y < y1; y++) s += fg[y * W + x]; colProf[x] = s / (y1 - y0) }
    const cols = mergeRuns(runs(colProf, 0.25, 4), W * 0.01).filter(([a, b]) => b - a >= minCardW).filter(([a, b]) => (y1 - y0) / (b - a) > 0.9 && (y1 - y0) / (b - a) < 2.2)
    for (const [x0, x1] of cols) {
      // hauteur exacte de cette carte : lignes de la colonne majoritairement occupées
      const prof = new Float32Array(y1 - y0)
      for (let y = y0; y < y1; y++) { let s = 0; for (let x = x0; x < x1; x++) s += fg[y * W + x]; prof[y - y0] = s / (x1 - x0) }
      const vr = runs(prof, 0.5, 4)
      const top = y0 + (vr.length ? vr[0][0] : 0), bottom = y0 + (vr.length ? vr[vr.length - 1][1] : y1 - y0)
      found.push({ x: x0, y: top, w: x1 - x0, h: bottom - top })
    }
  }
  if (!found.length) return []
  // toutes les cartes d'une capture ont la même taille : largeur médiane (une carte Dresseur
  // très blanche paraît plus étroite, une carte holo plus large)
  const w = [...found].map((b) => b.w).sort((a, b) => a - b)[found.length >> 1]
  const h = w * CARD_RATIO
  return found.map((b) => {
    const cx = b.x + b.w / 2
    const bottom = b.y + b.h
    // zone plus haute que la carte (étiquette au-dessus) : on garde le bas ; sinon on centre
    const y = b.h > h ? bottom - h : b.y + b.h / 2 - h / 2
    const yy = Math.max(0, Math.min(H - h, y))
    return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: yy, w, h: Math.min(h, H) }
  })
}

function smooth(prof: Float32Array, r: number): Float32Array {
  const out = new Float32Array(prof.length)
  let s = 0
  for (let i = 0; i < prof.length + r; i++) {
    if (i < prof.length) s += prof[i]
    if (i - 2 * r - 1 >= 0) s -= prof[i - 2 * r - 1]
    const c = i - r
    if (c >= 0 && c < prof.length) out[c] = s / (Math.min(prof.length, i + 1) - Math.max(0, i - 2 * r))
  }
  return out
}

function mergeRuns(rs: [number, number][], gap: number): [number, number][] {
  const out: [number, number][] = []
  for (const r of rs) {
    const last = out[out.length - 1]
    if (last && r[0] - last[1] < gap) last[1] = r[1]
    else out.push([r[0], r[1]])
  }
  return out
}

/** Plages contiguës où `prof` dépasse `frac` × son maximum, d'au moins `minLen`. */
function runs(prof: Float32Array, frac: number, minLen: number): [number, number][] {
  let max = 0
  for (const v of prof) if (v > max) max = v
  return runsAbove(prof, max * frac, minLen)
}

/** Plages contiguës où `prof` dépasse `thr`, d'au moins `minLen`. */
function runsAbove(prof: Float32Array, thr: number, minLen: number): [number, number][] {
  const out: [number, number][] = []
  let s = -1
  for (let i = 0; i <= prof.length; i++) {
    const on = i < prof.length && prof[i] > thr
    if (on && s < 0) s = i
    if (!on && s >= 0) { if (i - s >= minLen) out.push([s, i]); s = -1 }
  }
  return out
}

/**
 * Empreintes d'une carte repérée, pour de petites variations de cadrage (le bord blanc
 * de la carte se confond avec le fond, la boîte trouvée est un peu trop petite).
 */
export function boxVariants(b: Box): Box[] {
  const out: Box[] = []
  for (const s of [1.04, 1.08, 1.12]) {
    for (const dx of [-0.03, 0, 0.03]) {
      for (const dy of [-0.05, 0, 0.05]) {
        const w = b.w * s, h = b.h * s
        out.push({ x: b.x + b.w / 2 - w / 2 + dx * b.w, y: b.y + b.h / 2 - h / 2 + dy * b.h, w, h })
      }
    }
  }
  return out
}
