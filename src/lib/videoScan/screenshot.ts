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
  return detectByBadges(img) ?? detectByProjections(img)
}

/** Couleur du badge d'exemplaires du jeu (ardoise sombre), identique sur toutes les cartes. */
const BADGE_RGB = [76, 92, 116]
/** Largeur d'une carte / largeur de son badge (mesuré sur un « Résumé ouverture »). */
const CARD_W_PER_BADGE_W = 2.02

/**
 * Repère les cartes grâce à leur badge d'exemplaires, au coin bas-gauche de chaque carte :
 * il est foncé, de forme et de taille constantes, donc bien plus fiable que la carte elle-même
 * (cartes Incolores quasi blanches sur fond clair). Renvoie null sans badges cohérents.
 */
export function detectByBadges(img: RGBAImage): Box[] | null {
  const { width: W, height: H, data } = img
  const F = 3
  const gw = Math.floor(W / F), gh = Math.floor(H / F)
  const g = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let n = 0
      for (let dy = 0; dy < F; dy++) {
        for (let dx = 0; dx < F; dx++) {
          const p = ((gy * F + dy) * W + gx * F + dx) * 4
          if (Math.abs(data[p] - BADGE_RGB[0]) < 22 && Math.abs(data[p + 1] - BADGE_RGB[1]) < 22 && Math.abs(data[p + 2] - BADGE_RGB[2]) < 22) n++
        }
      }
      g[gy * gw + gx] = n >= 5 ? 1 : 0
    }
  }
  // composantes connexes (chiffres blancs = trous, le contour reste connecté)
  const seen = new Uint8Array(g.length)
  const comps: { x0: number; y0: number; x1: number; y1: number; n: number }[] = []
  const stack: number[] = []
  for (let i = 0; i < g.length; i++) {
    if (!g[i] || seen[i]) continue
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0
    stack.push(i); seen[i] = 1
    while (stack.length) {
      const k = stack.pop()!
      const x = k % gw, y = (k / gw) | 0
      n++
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
          const j = ny * gw + nx
          if (g[j] && !seen[j]) { seen[j] = 1; stack.push(j) }
        }
      }
    }
    comps.push({ x0: x0 * F, y0: y0 * F, x1: (x1 + 1) * F, y1: (y1 + 1) * F, n: n * F * F })
  }
  const badges = comps.filter((c) => {
    const w = c.x1 - c.x0, h = c.y1 - c.y0
    return w >= W * 0.07 && w <= W * 0.3 && h >= W * 0.03 && h <= W * 0.12 && w / h > 1.5 && w / h < 4.5 && c.n / (w * h) > 0.45
  })
  if (badges.length < 2 || badges.length > 6) return null
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]
  const bw = med(badges.map((b) => b.x1 - b.x0))
  // badges de taille cohérente seulement
  const ok = badges.filter((b) => Math.abs(b.x1 - b.x0 - bw) < bw * 0.25)
  if (ok.length < 2) return null
  const w = bw * CARD_W_PER_BADGE_W, h = w * CARD_RATIO
  return ok
    .map((b) => ({ x: Math.max(0, b.x0), y: Math.max(0, b.y1 - h), w, h }))
    .sort((a, b) => Math.abs(a.y - b.y) > h / 2 ? a.y - b.y : a.x - b.x)
}

function detectByProjections(img: RGBAImage): Box[] {
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
