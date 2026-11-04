import type { DexEntry } from './types'

/** Minuscules, sans accents ni ponctuation (apostrophes, tirets, points, espaces) ; ♀/♂ conservés en « f »/« m ». */
export function normName(s: string): string {
  return s
    .replace(/♀/g, ' f ').replace(/♂/g, ' m ').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Fautes / formes collées présentes dans les données communautaires (clé normalisée -> parse). */
const ALIASES: Record<string, { name: string; region?: Region }> = {
  alolaneggutor: { name: 'exeggutor', region: 'alola' },
  baoijan: { name: 'chienpao' },
}

type Region = 'alola' | 'galar' | 'hisui' | 'paldea'
const REGION_EN: Record<string, Region> = { alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea' }
const REGION_SUFFIX: Record<string, Region> = { alola: 'alola', galar: 'galar', hisui: 'hisui', paldea: 'paldea' }
const REGION_KEY: Record<Region, string> = { alola: 'alola', galar: 'galar', hisui: 'hisui', paldea: 'paldea' }

export interface ParsedName {
  /** Nom de l'espèce, normalisé (sans ex/Méga/région/Team Rocket). */
  base: string
  mega: boolean
  /** « x » | « y » | « z » pour les Méga multiples. */
  megaLetter?: string
  region?: Region
}

/** Décompose un nom de carte (EN ou FR). */
export function parseCardName(raw: string): ParsedName {
  let s = raw.replace(/[’‘`]/g, "'").trim()
  s = s.replace(/\s+ex$/i, '').trim()
  let region: Region | undefined
  let mega = false
  let megaLetter: string | undefined

  // Team Rocket : EN « Team Rocket's X », FR « X de la Team Rocket » -> espèce de base
  s = s.replace(/^team rocket'?s\s+/i, '').replace(/\s+de la team rocket$/i, '')

  // Méga : « Mega X », « Mega-X », « Méga-X » (le trait d'union / l'espace évite Méganium, Mégapagos, Yanméga)
  const m = /^m[eé]ga[\s-]+(.+)$/i.exec(s)
  if (m) {
    mega = true
    s = m[1].trim()
    const l = /^(.*\S)\s+([xyz])$/i.exec(s)
    if (l) { s = l[1]; megaLetter = l[2].toLowerCase() }
  }

  // Régions : préfixe EN « Alolan X », suffixes « X Alola », FR « X d'Alola » / « X de Galar »…
  const pre = /^(alolan|galarian|hisuian|paldean)\s+(.+)$/i.exec(s)
  if (pre) { region = REGION_EN[pre[1].toLowerCase()]; s = pre[2] }
  const suf = /^(.+?)\s+(?:d'|de\s+)?(alola|galar|hisui|paldea)$/i.exec(s)
  if (suf) { region = REGION_SUFFIX[suf[2].toLowerCase()]; s = suf[1] }

  let base = normName(s)
  const al = ALIASES[base]
  if (al) { base = al.name; region ??= al.region }
  return { base, mega, megaLetter, region }
}

export interface DexIndex {
  entries: DexEntry[]
  /** Nom normalisé (FR ou EN) -> numéro de Pokédex. */
  byName: Map<string, number>
  /** Noms triés du plus long au plus court (repli « contient le nom »). */
  longest: string[]
  byDex: Map<number, DexEntry[]>
}

export function buildIndex(entries: DexEntry[]): DexIndex {
  const byName = new Map<string, number>()
  const byDex = new Map<number, DexEntry[]>()
  for (const e of entries) {
    const list = byDex.get(e.dex) ?? []
    list.push(e)
    byDex.set(e.dex, list)
    for (const n of [e.nameFr, e.nameEn]) {
      const k = normName(n)
      if (k && !byName.has(k)) byName.set(k, e.dex)
    }
  }
  const longest = [...byName.keys()].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length)
  return { entries, byName, longest, byDex }
}

/** Espèce d'un nom normalisé : exact, sinon plus long nom d'espèce contenu dans le nom (« Teal Mask Ogerpon », « Necrozma Dawn »). */
function findSpecies(idx: DexIndex, base: string): number | null {
  const exact = idx.byName.get(base)
  if (exact) return exact
  for (const k of idx.longest) if (base.includes(k)) return idx.byName.get(k)!
  return null
}

function pickEntry(idx: DexIndex, dex: number, p: ParsedName): DexEntry | null {
  const list = idx.byDex.get(dex)
  if (!list?.length) return null
  const baseEntry = list.find((e) => e.formKind === 'base') ?? list[0]
  if (p.mega) {
    const megas = list.filter((e) => e.formKind === 'mega')
    if (p.megaLetter) {
      const hit = megas.find((e) => e.formLabelEn?.toLowerCase().includes(' ' + p.megaLetter))
      if (hit) return hit
    }
    return megas.find((e) => !/ [xyz]\b/i.test(e.formLabelEn ?? '')) ?? megas[0] ?? baseEntry
  }
  if (p.region) {
    const key = REGION_KEY[p.region]
    const reg = list.filter((e) => e.formKind === 'regional' && regionOf(e) === key)
    // Plusieurs races (Tauros de Paldea) : la première (Combat). Pas de forme régionale (Terraiste de Paldea) : l'espèce de base.
    return reg[0] ?? baseEntry
  }
  return baseEntry
}

function regionOf(e: DexEntry): string | undefined {
  const l = (e.formLabelEn ?? '').toLowerCase()
  if (l.startsWith('alolan')) return 'alola'
  if (l.startsWith('galarian')) return 'galar'
  if (l.startsWith('hisuian')) return 'hisui'
  if (l.startsWith('paldean')) return 'paldea'
  return undefined
}

/** Entrée du Pokédex correspondant à une carte Pokémon (noms EN et FR), ou null. */
export function matchCard(idx: DexIndex, card: { name: string; nameEn?: string }): DexEntry | null {
  for (const raw of [card.nameEn, card.name]) {
    if (!raw) continue
    const p = parseCardName(raw)
    const dex = findSpecies(idx, p.base)
    if (dex) return pickEntry(idx, dex, p)
  }
  return null
}
