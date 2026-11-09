import type { Box } from './fingerprint'
import { cardFromBadge, findBadges, type BadgeRect } from './screenshot.ts'
import type { RGBAImage } from './image'
import { BADGE_TEMPLATES, HEADER_TEMPLATES } from './recapDigits.ts'

/**
 * Lecture du « Résumé ouverture » de plusieurs boosters (partie pure, sans DOM) :
 * repérage des blocs « Booster n° X » (cartes par badges), lecture des nombres d'exemplaires
 * et du numéro de l'en-tête, regroupement des blocs vus sur plusieurs captures.
 */

// ───────────────────────── lecture de chiffres ─────────────────────────

const TW = 10, TH = 14

interface Glyph { x0: number; y0: number; w: number; h: number }

/** Plan d'« encre » 0..1 sur un rectangle : tracé des chiffres. */
interface Ink { w: number; h: number; v: Float32Array }

function colSegments(ink: Ink, minGap = 1): [number, number][] {
  const segs: [number, number][] = []
  let s = -1, gap = 0
  for (let x = 0; x <= ink.w; x++) {
    let any = false
    if (x < ink.w) for (let y = 0; y < ink.h; y++) if (ink.v[y * ink.w + x] > 0.5) { any = true; break }
    if (any) { if (s < 0) s = x; gap = 0 } else if (s >= 0) {
      gap++
      if (gap >= minGap) { segs.push([s, x - gap + 1]); s = -1; gap = 0 }
    }
  }
  return segs
}

function glyphBox(ink: Ink, a: number, b: number): Glyph {
  let y0 = ink.h, y1 = -1
  for (let x = a; x < b; x++) for (let y = 0; y < ink.h; y++) if (ink.v[y * ink.w + x] > 0.5) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  return { x0: a, y0, w: b - a, h: Math.max(0, y1 - y0 + 1) }
}

function normGlyph(ink: Ink, g: Glyph): Float32Array {
  const nw = Math.max(1, Math.min(TW, Math.round((g.w * TH) / g.h)))
  const out = new Float32Array(TW * TH)
  const ox = (TW - nw) >> 1
  const val = (x: number, y: number) => (x >= 0 && y >= 0 && x < g.w && y < g.h ? ink.v[(g.y0 + y) * ink.w + g.x0 + x] : 0)
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

/** Sépare les chiffres d'une ligne d'encre ; les chiffres collés sont coupés au creux de la projection. */
function digitGlyphs(ink: Ink, segs: [number, number][]): Glyph[] {
  let glyphs = segs.map(([a, b]) => glyphBox(ink, a, b))
  if (!glyphs.length) return []
  const maxH = Math.max(...glyphs.map((g) => g.h))
  glyphs = glyphs.filter((g) => g.h >= 0.7 * maxH)
  const out: Glyph[] = []
  for (const g of glyphs) {
    if (g.w > 0.95 * g.h) {
      let best = g.x0 + (g.w >> 2), bv = Infinity
      for (let x = g.x0 + (g.w >> 2); x < g.x0 + g.w - (g.w >> 2); x++) {
        let n = 0
        for (let y = 0; y < ink.h; y++) n += ink.v[y * ink.w + x]
        if (n < bv) { bv = n; best = x }
      }
      out.push(glyphBox(ink, g.x0, best), glyphBox(ink, best, g.x0 + g.w))
    } else out.push(g)
  }
  return out
}

/** Vecteurs normalisés des chiffres du badge d'exemplaires (blanc sur ardoise). */
export function badgeGlyphVectors(img: RGBAImage, b: BadgeRect): Float32Array[] {
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0
  const x0 = Math.max(0, Math.round(b.x0 + bw * 0.05)), x1 = Math.min(img.width, Math.round(b.x0 + bw * 0.78))
  const y0 = Math.max(0, Math.round(b.y0 + bh * 0.06)), y1 = Math.min(img.height, Math.round(b.y1 - bh * 0.04))
  const w = x1 - x0, h = y1 - y0
  if (w < 8 || h < 8) return []
  const v = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = ((y0 + y) * img.width + x0 + x) * 4
      const lum = 0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2]
      v[y * w + x] = Math.max(0, Math.min(1, (lum - 125) / 90))
    }
  }
  const ink: Ink = { w, h, v }
  const glyphs = digitGlyphs(ink, colSegments(ink))
  if (glyphs.length < 1 || glyphs.length > 3) return []
  // un chiffre doit occuper l'essentiel de la hauteur du badge
  if (glyphs.some((g) => g.h < h * 0.5)) return []
  return glyphs.map((g) => normGlyph(ink, g))
}

/** Vecteurs normalisés du ou des derniers chiffres de « Booster n° X » (gris sur fond clair). */
export function headerGlyphVectors(img: RGBAImage, firstRowTop: number, cardH: number): Float32Array[] {
  const { width: W, data } = img
  const x0 = Math.round(W * 0.3), x1 = Math.round(W * 0.7)
  const y0 = Math.max(0, Math.round(firstRowTop - cardH * 0.3)), y1 = Math.min(img.height, Math.round(firstRowTop - cardH * 0.04))
  const w = x1 - x0, h = y1 - y0
  if (h < 12 || w < 20) return []
  const lumAt = (x: number, y: number) => { const p = ((y0 + y) * W + x0 + x) * 4; return 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2] }
  const sample: number[] = []
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 4) sample.push(lumAt(x, y))
  sample.sort((a, b) => a - b)
  const bg = sample[Math.floor(sample.length * 0.7)]
  const v = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = ((y0 + y) * W + x0 + x) * 4
      const mx = Math.max(data[p], data[p + 1], data[p + 2]), mn = Math.min(data[p], data[p + 1], data[p + 2])
      // texte gris-bleu sombre ; les filets colorés (arc-en-ciel) sont saturés et écartés
      if (mx - mn > 55) continue
      v[y * w + x] = Math.max(0, Math.min(1, (bg - lumAt(x, y) - 25) / 80))
    }
  }
  // ligne de texte : la plus longue plage de rangées avec de l'encre
  const rowInk = new Float32Array(h)
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) if (v[y * w + x] > 0.5) s++; rowInk[y] = s }
  let best: [number, number] = [0, 0], s = -1
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowInk[y] >= 2
    if (on && s < 0) s = y
    if (!on && s >= 0) { if (y - s > best[1] - best[0]) best = [s, y]; s = -1 }
  }
  if (best[1] - best[0] < 10) return []
  const ink: Ink = { w, h: best[1] - best[0], v: v.slice(best[0] * w, best[1] * w) }
  const segs = colSegments(ink)
  if (segs.length < 3) return []
  const boxes = segs.map(([a, b]) => glyphBox(ink, a, b))
  const maxH = Math.max(...boxes.map((g) => g.h))
  // de la droite vers la gauche : chiffres hauts, séparés par moins de 0,25 × hauteur
  const digits: Glyph[] = []
  for (let i = boxes.length - 1; i >= 0; i--) {
    const g = boxes[i]
    if (g.h < 0.8 * maxH) break
    if (digits.length) {
      const gap = digits[0].x0 - (g.x0 + g.w)
      if (gap > maxH * 0.25) break
    }
    digits.unshift(g)
    if (digits.length === 2) break
  }
  if (!digits.length) return []
  return digits.map((g) => normGlyph(ink, g))
}

export interface DigitRead { value: number | null; conf: number }

/** Plus proche modèle d'un chiffre ; conf = 1 − meilleure distance / deuxième. */
function classify(templates: Float32Array[], v: Float32Array): { digit: number; conf: number } {
  const d = templates.map((t) => { let e = 0; for (let i = 0; i < t.length; i++) e += (t[i] - v[i]) ** 2; return e })
  const order = d.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0])
  return { digit: order[0][1], conf: Math.max(0, 1 - order[0][0] / (order[1][0] || 1)) }
}

function readDigits(templates: Float32Array[], vecs: Float32Array[], minConf: number): DigitRead {
  if (!vecs.length || vecs.length > 3 || !templates.length) return { value: null, conf: 0 }
  let value = 0, conf = 1
  for (const v of vecs) {
    const c = classify(templates, v)
    value = value * 10 + c.digit
    conf = Math.min(conf, c.conf)
  }
  return conf < minConf ? { value: null, conf } : { value, conf }
}

const decodeTemplates = (list: string[]) => list.map((s) => Float32Array.from(s, (ch) => parseInt(ch, 16) / 15))
const BADGE_T = decodeTemplates(BADGE_TEMPLATES)
const HEADER_T = decodeTemplates(HEADER_TEMPLATES)

export const COUNT_MIN_CONF = 0.3
export const HEADER_MIN_CONF = 0.3

export function readCount(img: RGBAImage, b: BadgeRect, templates: Float32Array[] = BADGE_T): DigitRead {
  return readDigits(templates, badgeGlyphVectors(img, b), COUNT_MIN_CONF)
}

export function readHeader(img: RGBAImage, firstRowTop: number, cardH: number, templates: Float32Array[] = HEADER_T): DigitRead {
  const r = readDigits(templates, headerGlyphVectors(img, firstRowTop, cardH), HEADER_MIN_CONF)
  return r.value !== null && (r.value < 1 || r.value > 99) ? { value: null, conf: 0 } : r
}

// ───────────────────────── blocs de cartes ─────────────────────────

export interface Positioned { x: number; y: number; w: number; h: number }

export interface BlockLayout<T extends Positioned> {
  /** cartes dans l'ordre de lecture */
  items: T[]
  /** nombre de cartes par rangée */
  rows: number[]
  /** vrai si le bloc est entier et son en-tête visible */
  complete: boolean
}

/**
 * Regroupe des boîtes en rangées (même ordonnée) puis en blocs (rangées séparées par un petit
 * intervalle ; l'en-tête « Booster n° X » crée un grand intervalle entre deux blocs).
 * Un bloc est complet s'il a la forme 3+2 ou 3+3, tient entièrement dans l'image et laisse
 * assez de marge au-dessus pour son en-tête.
 */
export function groupBlocks<T extends Positioned>(boxes: T[], imgH: number): BlockLayout<T>[] {
  if (!boxes.length) return []
  const h = boxes.reduce((a, b) => a + b.h, 0) / boxes.length
  const sorted = [...boxes].sort((a, b) => a.y - b.y)
  const rows: T[][] = []
  for (const b of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(b.y - row[0].y) < h * 0.3) row.push(b)
    else rows.push([b])
  }
  for (const r of rows) r.sort((a, b) => a.x - b.x)
  const blocks: T[][][] = []
  for (const r of rows) {
    const last = blocks[blocks.length - 1]
    const prev = last?.[last.length - 1]
    const gap = prev ? r[0].y - (prev[0].y + prev[0].h) : Infinity
    if (last && gap < h * 0.3) last.push(r)
    else blocks.push([r])
  }
  return blocks.map((rs, bi) => {
    const shape = rs.map((r) => r.length)
    const okShape = rs.length === 2 && shape[0] === 3 && (shape[1] === 2 || shape[1] === 3)
    const first = rs[0][0], lastRow = rs[rs.length - 1][0]
    // le premier bloc de la capture n'est complet que si son en-tête (≈ 0,24 × h au-dessus) est visible
    const headerOk = first.y >= h * 0.26 || bi > 0
    const inside = first.y >= -h * 0.02 && lastRow.y + lastRow.h <= imgH + h * 0.04
    return { items: rs.flat(), rows: shape, complete: okShape && headerOk && inside }
  })
}

// ───────────────────────── lecture d'une image ─────────────────────────

export interface ShotBlock {
  /** boîtes des cartes, dans l'ordre de lecture */
  boxes: Box[]
  /** numéro lu dans l'en-tête, ou null */
  header: number | null
  /** nombres d'exemplaires lus (null si illisible) */
  counts: (number | null)[]
  /** ordonnée du bloc dans l'image */
  y: number
}

export interface ImageBlocks {
  complete: ShotBlock[]
  /** nombre de blocs (ou restes de blocs) coupés, ignorés */
  partial: number
}

/** Blocs d'un « Résumé ouverture » (une capture, ou une image de la vidéo). */
export function analyzeImage(img: RGBAImage): ImageBlocks {
  const badges = findBadges(img)
  if (!badges.length) return { complete: [], partial: 0 }
  const items = badges.map((b) => ({ ...cardFromBadge(b, b.w), badge: b }))
  const blocks = groupBlocks(items, img.height)
  const out: ShotBlock[] = []
  let partial = 0
  for (const bl of blocks) {
    if (!bl.complete) { partial++; continue }
    const first = bl.items[0]
    const header = readHeader(img, first.y, first.h)
    out.push({
      boxes: bl.items.map(({ x, y, w, h }) => ({ x, y, w, h })),
      header: header.value,
      counts: bl.items.map((it) => readCount(img, it.badge).value),
      y: first.y,
    })
  }
  return { complete: out, partial }
}

// ───────────────────────── regroupement des blocs ─────────────────────────

/** Une carte reconnue : meilleure correspondance + sa distance. */
export interface ReadCard<T> { id: string; dist: number; payload: T }

export interface ReadBlock<T> {
  header: number | null
  counts: (number | null)[]
  cards: ReadCard<T>[]
}

/** Même contenu de blocs ? Entête et exemplaires d'abord, identités en recoupement. */
export function sameBlock<T>(a: { header: number | null; counts: (number | null)[]; cards?: ReadCard<T>[] }, b: { header: number | null; counts: (number | null)[]; cards?: ReadCard<T>[] }): boolean {
  if (a.counts.length !== b.counts.length) return false
  if (a.header !== null && b.header !== null && a.header !== b.header) return false
  let known = 0, equal = 0
  for (let i = 0; i < a.counts.length; i++) {
    if (a.counts[i] === null || b.counts[i] === null) continue
    known++
    if (a.counts[i] === b.counts[i]) equal++
  }
  const countsOk = known === 0 || equal >= known - (known >= 5 ? 1 : 0)
  if (!countsOk) return false
  const headerSame = a.header !== null && a.header === b.header
  if (a.cards && b.cards) {
    const n = a.cards.length
    let idEq = 0
    for (let i = 0; i < n; i++) if (a.cards[i].id === b.cards[i].id) idEq++
    if (headerSame) return idEq >= n - 2 || known >= 3
    // sans en-tête commun : mêmes cartes ET mêmes exemplaires (connus) exigés
    return idEq >= n - 1 && known >= Math.min(3, n)
  }
  // sans identités : en-tête commun ou au moins 4 exemplaires lus, tous égaux
  return headerSame ? known >= 3 : known >= 4 && equal === known
}

const total = <T>(b: ReadBlock<T>) => b.cards.reduce((s, c) => s + c.dist, 0)

export interface RecapBlockOut<T> {
  index: number
  indexRead: boolean
  cards: ReadCard<T>[]
  counts: (number | null)[]
}

/**
 * Fusionne les lectures d'un même bloc vues sur plusieurs images (ordre d'apparition conservé),
 * garde la meilleure lecture de chaque carte, numérote les boosters et signale les manques.
 */
export function mergeBlocks<T>(blocks: ReadBlock<T>[]): { boosters: RecapBlockOut<T>[]; warnings: string[] } {
  const groups: ReadBlock<T>[] = []
  for (const b of blocks) {
    const g = groups.find((x) => sameBlock(x, b))
    if (!g) { groups.push({ header: b.header, counts: [...b.counts], cards: [...b.cards] }); continue }
    g.header ??= b.header
    g.counts = g.counts.map((c, i) => c ?? b.counts[i])
    // meilleure lecture par carte
    if (total(b) < total(g) || g.cards.some((c, i) => b.cards[i].dist < c.dist - 0.02)) {
      g.cards = g.cards.map((c, i) => (b.cards[i].dist < c.dist ? b.cards[i] : c))
    }
  }
  // numérotation : en-tête lu, sinon suite du bloc précédent
  const out: RecapBlockOut<T>[] = []
  let prev = 0
  for (const g of groups) {
    const read = g.header !== null
    const index = read ? g.header! : prev + 1
    out.push({ index, indexRead: read, cards: g.cards, counts: g.counts })
    prev = index
  }
  // si tous les en-têtes sont lus et que l'ordre d'apparition est inversé (défilement vers le haut), on trie
  if (out.every((o) => o.indexRead)) out.sort((a, b) => a.index - b.index)
  const warnings: string[] = []
  const read = out.filter((o) => o.indexRead).map((o) => o.index)
  if (read.length) {
    const have = new Set(out.map((o) => o.index))
    for (let k = 1; k < Math.max(...read); k++) {
      if (!have.has(k)) warnings.push(`Booster n° ${k} introuvable : refais une capture de ce passage.`)
    }
  }
  const seen = new Set<number>()
  for (const o of out) {
    if (seen.has(o.index)) warnings.push(`Le booster n° ${o.index} apparaît deux fois : vérifie les numéros.`)
    seen.add(o.index)
  }
  return { boosters: out, warnings }
}

// ───────────────────────── images quasi identiques ─────────────────────────

/** Miniature en gris (largeur 48) d'une image, pour repérer les images quasi identiques d'une vidéo. */
export function thumbOf(img: RGBAImage): { w: number; h: number; v: Uint8Array } {
  const w = 48, h = Math.max(1, Math.round((img.height * w) / img.width))
  const v = new Uint8Array(w * h)
  const sx = img.width / w, sy = img.height / h
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = ((Math.min(img.height - 1, Math.floor((y + 0.5) * sy))) * img.width + Math.min(img.width - 1, Math.floor((x + 0.5) * sx))) * 4
      v[y * w + x] = 0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2]
    }
  }
  return { w, h, v }
}

/** Écart moyen entre deux miniatures (grande valeur si les tailles diffèrent). */
export function thumbDiff(a: { w: number; h: number; v: Uint8Array }, b: { w: number; h: number; v: Uint8Array }): number {
  if (a.w !== b.w || a.h !== b.h) return 255
  let s = 0
  for (let i = 0; i < a.v.length; i++) s += Math.abs(a.v[i] - b.v[i])
  return s / a.v.length
}

// ───────────────────────── chaîne complète ─────────────────────────

/** Détection d'une carte : au moins ses meilleures correspondances (la plus proche d'abord). */
export interface DetLike { candidates: { card: { id: string; setId: string }; dist: number }[] }

/** Écart de miniature en dessous duquel une image est jugée identique à la précédente. */
export const SAME_IMAGE_DIFF = 0.8
const SET_BONUS = 0.03

/**
 * Les boosters d'un même récap viennent presque toujours de la même extension : à ressemblance
 * presque égale, on préfère l'extension majoritaire (réimpressions d'autres extensions).
 */
export function preferMajoritySet(dets: DetLike[]): void {
  const votes = new Map<string, number>()
  for (const d of dets) {
    const top = d.candidates[0]
    if (top && top.dist < 0.1) votes.set(top.card.setId, (votes.get(top.card.setId) ?? 0) + 1)
  }
  if (!votes.size) return
  const major = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0]
  for (const d of dets) {
    d.candidates.sort((a, b) => (a.dist - (a.card.setId === major ? SET_BONUS : 0)) - (b.dist - (b.card.setId === major ? SET_BONUS : 0)))
  }
}

export interface RecapSource<T extends DetLike> {
  count: number
  load: (i: number) => Promise<RGBAImage>
  /** Identifie les cartes de `boxes` dans `img`. */
  identify: (img: RGBAImage, boxes: Box[]) => T[]
  onProgress?: (done: number, total: number) => void
}

export interface RecapOut<T> { boosters: { index: number; indexRead: boolean; cards: T[]; counts: (number | null)[] }[]; warnings: string[] }

/** Lecture complète : repérage des blocs, exemplaires, identification (sans refaire un bloc déjà lu), fusion. */
export async function runRecap<T extends DetLike>(src: RecapSource<T>): Promise<RecapOut<T>> {
  const read: ReadBlock<T>[] = []
  const warnings: string[] = []
  let prevThumb: ReturnType<typeof thumbOf> | null = null
  let partials = 0
  for (let i = 0; i < src.count; i++) {
    const img = await src.load(i)
    const th = thumbOf(img)
    const same = prevThumb !== null && thumbDiff(prevThumb, th) < SAME_IMAGE_DIFF
    prevThumb = th
    src.onProgress?.(i + 1, src.count)
    if (same) continue
    const { complete, partial } = analyzeImage(img)
    partials += partial
    for (const b of complete) {
      // bloc déjà lu (même en-tête et mêmes exemplaires) : inutile de le reconnaître encore
      if (read.some((r) => sameBlock({ header: r.header, counts: r.counts }, { header: b.header, counts: b.counts }))) continue
      const dets = src.identify(img, b.boxes)
      read.push({
        header: b.header,
        counts: b.counts,
        cards: dets.map((d) => ({ id: d.candidates[0]?.card.id ?? '', dist: d.candidates[0]?.dist ?? 1, payload: d })),
      })
    }
  }
  if (!read.length) {
    warnings.push(partials
      ? 'Aucun bloc complet : chaque booster doit apparaître en entier (avec son titre « Booster n° X ») sur au moins une capture.'
      : 'Aucun « Résumé ouverture » reconnu sur ces images.')
    return { boosters: [], warnings }
  }
  const all = read.flatMap((r) => r.cards.map((c) => c.payload))
  preferMajoritySet(all)
  for (const r of read) r.cards = r.cards.map((c) => ({ ...c, id: c.payload.candidates[0]?.card.id ?? '', dist: c.payload.candidates[0]?.dist ?? 1 }))
  const merged = mergeBlocks(read)
  return {
    boosters: merged.boosters.map((b) => ({ index: b.index, indexRead: b.indexRead, cards: b.cards.map((c) => c.payload), counts: b.counts })),
    warnings: [...warnings, ...merged.warnings],
  }
}
