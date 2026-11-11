import type { RGBAImage } from './image'

/**
 * Lecture du nombre d'exemplaires dans le badge d'une carte.
 * Badge ardoise + chiffres blancs = carte possédée ; badge clair = 0 exemplaire.
 * Chaque chiffre est isolé, ramené à 10×14 en gardant ses proportions, puis comparé
 * à des modèles moyens appris sur une capture du jeu (police fixe).
 */
const TW = 10, TH = 14
export const TEMPLATES = [
  '026aefc73017ceffec304bfcacee71add8459fb5dfb5116feaefa3005efbffa2004efbff81005ffbff81005ffaefa2006ff8bfd6339fd45dfdaaee8138deeeeb30139ceea520',
  '005bea3000007efe8000004bffb1000028dfc1000006cfc1000005cfc1000004cfc1000004cfc1000004cfc1000004cfc1000004cfb1000004cfb1000003bea10000028d6100',
  '049cdb83105adfffea30beecbdee80aeb637dfc0475115dfd0110017dfb000003afe7000026deb300016bec710015bed820003aeeb610038dffda7306cefffed9139deedca71',
  '15acdc82005adfffd7106cdabdec3037756bed4011115cec4100027eeb3000039efb3000027dfd40000038ee80242016dfc06a8437efb0aeecbded507bdfffe920238ddc9200',
  '000125b96100014aec6100138dfe710026cffe71004aeffe61028ceffe6105cdccee6238dd98de737dfd79dea39efdbceec59efeefffe67ccbccefd5146668cea30000039b61',
  '0147bba920028cffec4005adeda72006bcb8410007cec9400009beedb621069bcdfd61023458eea2010005ded3010005ced4122128ded358879ceda19fffffea603acfeec700',
  '00018b73000004aea3000019ee8000016cfc500005befd93001aefffeb403effccefb4befa54afe9dfd5117fdcdfd4117edc8ee6247ddc4ddb99ceda08bcddedb3006bacca50',
  '8befffeba8deffffffe76999ceffe212238dfeb000005ceb7000017dd74000129ec6100016cd7200003aea4000007de8100004cfb4000008de8100002aeb4000003aa7200000',
  '139ddca21028efedd9203dec79ed504de935bd604ce935cc502becaced401cffeefc402dfedded405deb68de707dd834bfc18dd745afb28cea7adfa159eeddfc60049bcda620',
  '008aeffc5029ceffffb2befe77eeea9ffb214cff8df9102cff6cfb503eff39fe98cffb06cfddfff7035cefffd10117cffe700001afe6200001ae820020039d400000028b1000',
].map((s) => Float32Array.from(s, (ch) => parseInt(ch, 16) / 15))

export interface BadgeRead {
  /** Nombre lu, ou null si illisible. */
  value: number | null
  /** 0 (incertain) à 1 (sûr). */
  conf: number
}

/** `img` : rectangle autour du badge (≈ 62×26, badge en haut à gauche avec ~2 px de marge). */
export function readBadge(img: RGBAImage): BadgeRead {
  const { width: W, height: H, data } = img
  const L = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) L[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  const at = (x: number, y: number) => L[y * W + x]

  const core: number[] = []
  for (let y = 5; y < Math.min(21, H); y++) for (let x = 4; x < Math.min(44, W); x++) core.push(at(x, y))
  core.sort((a, b) => a - b)
  const bg = core[core.length >> 1]
  if (bg > 150) return { value: 0, conf: bg > 175 ? 1 : 0.7 }
  const hi = core[Math.floor(core.length * 0.99)]
  if (hi - bg < 40) return { value: null, conf: 0 }
  const thr = bg + 0.5 * (hi - bg)

  // étendue du badge : lignes / colonnes dont la médiane est sombre
  const rowsIn: number[] = []
  for (let y = 0; y < H; y++) {
    const r: number[] = []
    for (let x = 4; x < Math.min(44, W); x++) r.push(at(x, y))
    if (median(r) < bg + 25) rowsIn.push(y)
  }
  if (rowsIn.length < 8) return { value: null, conf: 0 }
  const r0 = rowsIn[0] + 1, r1 = rowsIn[rowsIn.length - 1]
  const colsIn: number[] = []
  for (let x = 0; x < W; x++) {
    const c: number[] = []
    for (let y = r0; y < r1; y++) c.push(at(x, y))
    if (median(c) < bg + 25) colsIn.push(x)
  }
  const c0 = colsIn[0] + 1, c1 = colsIn[colsIn.length - 1]

  const on = (x: number, y: number) => y >= r0 && y < r1 && x >= c0 && x < c1 && at(x, y) > thr
  // découpe en glyphes par projection verticale
  const segs: [number, number][] = []
  let s = -1
  for (let x = 0; x <= W; x++) {
    let any = false
    if (x < W) for (let y = r0; y < r1; y++) if (on(x, y)) { any = true; break }
    if (any && s < 0) s = x
    if (!any && s >= 0) { segs.push([s, x]); s = -1 }
  }
  let glyphs = segs.map(([a, b]) => box(a, b))
  if (!glyphs.length) return { value: null, conf: 0 }
  const maxH = Math.max(...glyphs.map((g) => g.h))
  glyphs = glyphs.filter((g) => g.h >= 0.7 * maxH)
  // deux chiffres collés : on coupe au creux de la projection
  const split: Glyph[] = []
  for (const g of glyphs) {
    if (g.w > 0.95 * g.h) {
      let best = g.x0 + (g.w >> 2), bv = Infinity
      for (let x = g.x0 + (g.w >> 2); x < g.x0 + g.w - (g.w >> 2); x++) {
        let n = 0
        for (let y = g.y0; y < g.y0 + g.h; y++) if (on(x, y)) n++
        if (n < bv) { bv = n; best = x }
      }
      // deux chiffres collés, ou un seul chiffre élargi (vidéo étirée) ? on garde la lecture qui ressemble le plus aux modèles
      const a = box(g.x0, best), b = box(best, g.x0 + g.w)
      if (a.h > 0 && b.h > 0 && (bestErr(a) + bestErr(b)) / 2 < 0.8 * bestErr(g)) split.push(a, b)
      else split.push(g)
    } else split.push(g)
  }
  if (!split.length || split.length > 3) return { value: null, conf: 0 }

  let value = 0, conf = 1
  for (const g of split) {
    const v = normGlyph(g)
    const d = TEMPLATES.map((t) => { let e = 0; for (let i = 0; i < t.length; i++) e += (t[i] - v[i]) ** 2; return e })
    const order = d.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0])
    value = value * 10 + order[0][1]
    conf = Math.min(conf, Math.max(0, 1 - order[0][0] / order[1][0]))
  }
  // au-delà de 99 exemplaires, c'est presque sûrement un chiffre en trop : à vérifier
  return { value, conf: Math.min(1, conf * 2) * (value >= 100 ? 0.3 : 1) }

  interface Glyph { x0: number; y0: number; w: number; h: number }
  function bestErr(g: Glyph): number {
    const v = normGlyph(g)
    return Math.min(...TEMPLATES.map((t) => { let e = 0; for (let i = 0; i < t.length; i++) e += (t[i] - v[i]) ** 2; return e }))
  }
  function box(a: number, b: number): Glyph {
    let y0 = H, y1 = -1
    for (let x = a; x < b; x++) for (let y = r0; y < r1; y++) if (on(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    return { x0: a, y0, w: b - a, h: Math.max(0, y1 - y0 + 1) }
  }
  function normGlyph(g: Glyph): Float32Array {
    // mise à l'échelle sur la hauteur, centrée horizontalement, interpolation bilinéaire
    const nw = Math.max(1, Math.min(TW, Math.round((g.w * TH) / g.h)))
    const out = new Float32Array(TW * TH)
    const ox = (TW - nw) >> 1
    const val = (x: number, y: number) => (x >= 0 && y >= 0 && x < g.w && y < g.h && on(g.x0 + x, g.y0 + y) ? 1 : 0)
    for (let y = 0; y < TH; y++) {
      const sy = Math.max(0, (y + 0.5) * (g.h / TH) - 0.5)
      const yi = Math.floor(sy), fy = sy - yi
      for (let x = 0; x < nw; x++) {
        const sx = Math.max(0, (x + 0.5) * (g.w / nw) - 0.5)
        const xi = Math.floor(sx), fx = sx - xi
        const yj = Math.min(g.h - 1, yi + 1), xj = Math.min(g.w - 1, xi + 1)
        out[y * TW + ox + x] = val(xi, yi) * (1 - fx) * (1 - fy) + val(xj, yi) * fx * (1 - fy) + val(xi, yj) * (1 - fx) * fy + val(xj, yj) * fx * fy
      }
    }
    return out
  }
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}

/** Vote entre plusieurs lectures du même badge (plusieurs images de la vidéo). */
export function voteBadge(reads: BadgeRead[]): BadgeRead {
  const score = new Map<number, number>()
  for (const r of reads) if (r.value !== null) score.set(r.value, (score.get(r.value) ?? 0) + 0.2 + r.conf)
  if (!score.size) return { value: null, conf: 0 }
  const sorted = [...score.entries()].sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((a, b) => a + b[1], 0)
  const best = sorted[0]
  const agree = best[1] / total
  const maxConf = Math.max(...reads.filter((r) => r.value === best[0]).map((r) => r.conf))
  return { value: best[0], conf: Math.min(1, agree * (0.5 + maxConf / 2) * (reads.length > 1 ? 1 : 0.9)) }
}
