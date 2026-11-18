/**
 * Catalogue des icônes de profil du jeu (image de profil d'un membre du foyer), logique pure. Deux sources :
 * - Serebii : icônes récentes, images embarquées dans l'appli au déploiement (`public/data/profile-icons.json`,
 *   `scripts/fetch-profile-icons.mjs`, nouveautés guettées par `update-profile-icons.yml`) ; marche hors connexion.
 * - Pokémon-Zone : catalogue complet, lu dans l'appli Android ou importé d'une page enregistrée (Cloudflare bloque
 *   les serveurs) ; images affichées depuis assets.pokemon-zone.com (cache `pz-assets`). Jamais dans le dépôt.
 * Une icône présente des deux côtés n'apparaît qu'une fois, avec l'image embarquée.
 */

/** Icône du manifeste Serebii embarqué (`path` relatif à la base des images de l'appli). */
export interface SerebiiIcon { id: string; nameEn: string; method?: string; path: string; added?: string }
export interface SerebiiManifest { updatedAt?: string; icons: SerebiiIcon[] }

/** Icône lue sur Pokémon-Zone (`asset` relatif à `PZ_ASSETS`). */
export interface PzIcon { num: number; nameEn: string; source: string; asset: string }

/** Jeton japonais du fichier (`PROFILE_ICON_101280_TRIMMIEN_B4a` → `TRIMMIEN`). */
export const pzToken = (asset: string): string => /PROFILE_ICON_\d+_([A-Za-z]+)/.exec(asset)?.[1]?.toUpperCase() ?? ''

export type IconKind = 'pokemon' | 'trainer'

/** Entrée du catalogue affiché. `ids` : tous les identifiants qui désignent cette icône (choix faits avant une fusion). */
export interface ProfileIcon {
  id: string
  ids: string[]
  name: string
  kind: IconKind
  /** chemin relatif à la base des images de l'appli (Serebii) ou adresse complète (Pokémon-Zone) */
  src: string
  local: boolean
  /** comment l'obtenir, en français */
  source: string
  /** rang de récence (plus grand = plus récent) */
  rank: number
}

export const PZ_ASSETS = 'https://assets.pokemon-zone.com/game-assets/'
export const pzIconId = (num: number): string => `pz-${num}`

/** Noms anglais des extensions (Pokémon-Zone, Serebii) → id d'extension de l'appli. */
export const SET_EN: Record<string, string> = {
  'Genetic Apex': 'A1', 'Mythical Island': 'A1a', 'Space-Time Smackdown': 'A2', 'Triumphant Light': 'A2a', 'Shining Revelry': 'A2b',
  'Celestial Guardians': 'A3', 'Extradimensional Crisis': 'A3a', 'Eevee Grove': 'A3b', 'Wisdom of Sea and Sky': 'A4', 'Secluded Springs': 'A4a',
  'Deluxe Pack: ex': 'A4b', 'Mega Rising': 'B1', 'Crimson Blaze': 'B1a', 'Fantastical Parade': 'B2', 'Paldean Wonders': 'B2a', 'Mega Shine': 'B2b',
  'Pulsing Aura': 'B3', 'Paradox Drive': 'B3a', 'Everyday Wonders': 'B3b', 'Ruler of the Skies': 'B4', "Team Rocket's Ambition": 'B4a',
  'Deluxe Pack: Mega': 'B4b', 'Dual Fusion': 'C1',
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&eacute;/g, 'é')
  .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

/** Page « Icon Accessories » de Pokémon-Zone (HTML entier ou `<main>`) → icônes, dans l'ordre de la page. */
export function parsePzIcons(html: string): PzIcon[] {
  const out: PzIcon[] = []
  const seen = new Set<number>()
  const re = /<img\b[^>]*\bsrc=["'][^"']*?game-assets\/([^"'?]*ProfileDecoration\/Icon\/PROFILE_ICON_(\d+)[^"'?/]*\.(?:webp|png))[^"']*["'][^>]*>/gi
  const imgs = [...html.matchAll(re)]
  imgs.forEach((m, i) => {
    const num = Number(m[2])
    if (!Number.isFinite(num) || seen.has(num)) return
    const alt = decode(/\balt=(?:"([^"]*)"|'([^']*)')/i.exec(m[0])?.slice(1).find((x) => x != null) ?? '').replace(/\s*\(icon\)\s*$/i, '')
    if (!alt) return
    seen.add(num)
    const after = html.slice((m.index ?? 0) + m[0].length, imgs[i + 1]?.index ?? html.length)
    const source = /accessory-tile__source-name[^>]*>([^<]*)</i.exec(after)?.[1] ?? ''
    out.push({ num, nameEn: alt, source: decode(source), asset: m[1] })
  })
  return out
}

/** Nom anglais découpé : « Genetic Apex: Pikachu », « Team Rocket's Boss (Team Rocket's Ambition) », « Pikachu ver. 14 », « Grunt 3 ». */
export function splitIconName(nameEn: string): { base: string; prefix: string; ver: string } {
  let s = decode(nameEn)
  let prefix = ''
  const set = Object.keys(SET_EN).sort((a, b) => b.length - a.length).find((k) => s.toLowerCase().startsWith(k.toLowerCase() + ': '))
  const colon = set ? set.length : s.lastIndexOf(': ')
  if (colon > 0) { prefix = s.slice(0, colon); s = s.slice(colon + 2) }
  const par = /\s*\(([^)]+)\)$/.exec(s)
  if (par) { prefix = prefix || par[1]; s = s.slice(0, par.index) }
  let ver = ''
  const v = /\s+(?:ver\.?\s*)?(\d+)$/i.exec(s)
  if (v && !/^Mega .* [XY]$/.test(s)) { ver = v[1]; s = s.slice(0, v.index) }
  return { base: s.trim(), prefix: prefix.trim(), ver }
}

const compact = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const fullKey = (n: { base: string; prefix: string; ver: string }) => `${compact(n.base)}|${compact(n.prefix)}|${n.ver}`
const baseKey = (n: { base: string; ver: string }) => `${compact(n.base)}|${n.ver}`

export interface Names {
  /** nom anglais d'une carte → nom français et Dresseur ou non */
  card: (en: string) => { name: string; trainer: boolean } | undefined
  /** id d'extension → nom français */
  setName: (id: string) => string | undefined
  /** jeton japonais des fichiers Pokémon-Zone (`SIRNIGHT`) → nom français du Pokémon */
  jp?: (token: string) => string | undefined
}

/** Personnages sans carte du même nom anglais. */
const ALIASES: Record<string, { name: string; trainer: boolean }> = {
  'professor oak': { name: 'Professeur Chen', trainer: true },
  blue: { name: 'Blue', trainer: true },
  'poké ball': { name: 'Poké Ball', trainer: true },
}

const setFr = (en: string, n: Names) => { const id = SET_EN[en.replace(/[’‘]/g, "'")]; return (id && n.setName(id)) || (/^deluxe pack$/i.test(en) ? 'Booster de Luxe' : en) }
/** « de » élidé : « d'Aura Palpitante », « de Fusion Double ». */
const de = (s: string) => (/^[aeiouyhéèêàâîôûAEIOUYHÉÈÊÀÂÎÔÛ]/.test(s) ? `d'${s}` : `de ${s}`)

/** Nom français et genre d'une icône d'après son nom anglais (et le jeton japonais du fichier Pokémon-Zone). */
export function iconFrench(nameEn: string, n: Names, token = ''): { name: string; kind: IconKind } {
  const { base, prefix, ver } = splitIconName(nameEn)
  const look = (en: string) => n.card(en) ?? ALIASES[en.toLowerCase()]
  const card = look(base) ?? look(base.replace(/^(Shiny|ex) /, ''))
  let name = base
  if (card) name = /^Shiny /.test(base) && !look(base) ? `${card.name} chromatique` : card.name
  else {
    // « Furfrou Heart Trim » : le Pokémon par le jeton japonais, la précision anglaise entre parenthèses
    const jp = token ? n.jp?.(token) : undefined
    const words = base.split(' ')
    if (jp) name = words.length > 1 ? `${jp} (${words.slice(1).join(' ')})` : jp
  }
  const extra = [prefix && setFr(prefix, n), ver && `version ${ver}`].filter(Boolean)
  if (extra.length) name += ` (${extra.join(', ')})`
  const trainer = card?.trainer ?? /\b(Grunt|Boss|Researcher|Professor|Ball)\b/i.test(base)
  return { name, kind: trainer ? 'trainer' : 'pokemon' }
}

/** Comment obtenir l'icône, en français (best effort ; le texte anglais reste sinon). */
export function sourceFrench(src: string, n: Names): string {
  const s = decode(src)
  if (!s) return ''
  const card = (en: string) => n.card(en)?.name ?? en
  if (/^available by default$/i.test(s)) return 'Dès le départ'
  if (/^launch$/i.test(s)) return 'Lancement du jeu'
  let m = /^Dex Missions: Collect (\d+) cards from (.+)$/i.exec(s)
  if (m) return `Missions : ${m[1]} cartes ${de(setFr(m[2], n))}`
  m = /^(.+?) release$/i.exec(s)
  if (m) return `Sortie ${de(setFr(m[1], n))}`
  m = /^(.+?) and (.+?) Wonder ?pick(?: event)?$/i.exec(s)
  if (m) return `Pioche miracle ${card(m[1])} et ${card(m[2])}`
  m = /^Complete (?:the )?(.+?) Themed Collection$/i.exec(s)
  if (m) return `Collection à thème ${setFr(m[1], n)}`
  m = /^(?:Complete (?:the )?)?(.+?) Missions?$/i.exec(s)
  if (m) return `Missions ${setFr(m[1], n)}`
  m = /^(\S+) and (\S+)$/.exec(s)
  if (m) return `${card(m[1])} et ${card(m[2])}`
  if (/^(special )?event$/i.test(s)) return 'Évènement'
  return s
}

/** Catalogue fusionné, plus récentes d'abord. */
export function buildCatalog(serebii: SerebiiIcon[], pz: PzIcon[], n: Names): ProfileIcon[] {
  const out: ProfileIcon[] = []
  const byFull = new Map<string, ProfileIcon>()
  const byBase = new Map<string, ProfileIcon[]>()
  const maxNum = pz.reduce((m, i) => Math.max(m, i.num), 0)
  for (const i of pz) {
    const fr = iconFrench(i.nameEn, n, pzToken(i.asset))
    const e: ProfileIcon = { id: pzIconId(i.num), ids: [pzIconId(i.num)], ...fr, src: PZ_ASSETS + i.asset + '?width=160', local: false, source: sourceFrench(i.source, n), rank: i.num }
    out.push(e)
    const parts = splitIconName(i.nameEn)
    if (!byFull.has(fullKey(parts))) byFull.set(fullKey(parts), e)
    byBase.set(baseKey(parts), [...(byBase.get(baseKey(parts)) ?? []), e])
  }
  serebii.forEach((s, k) => {
    const parts = splitIconName(s.nameEn)
    const same = byBase.get(baseKey(parts))
    const twin = byFull.get(fullKey(parts)) ?? (same?.length === 1 ? same[0] : undefined)
    if (twin && !twin.local) { twin.ids.push(s.id); twin.src = s.path; twin.local = true; return }
    // pas (encore) lue sur Pokémon-Zone : en tête, dans l'ordre du manifeste (le plus récent d'abord)
    out.push({ id: s.id, ids: [s.id], ...iconFrench(s.nameEn, n), src: s.path, local: true, source: sourceFrench(s.method ?? '', n), rank: maxNum + serebii.length - k })
  })
  return out.sort((a, b) => b.rank - a.rank)
}

/** Icône désignée par un identifiant (y compris un ancien identifiant d'avant une fusion). */
export function findIcon(catalog: ProfileIcon[], id: string | undefined): ProfileIcon | undefined {
  return id ? catalog.find((i) => i.ids.includes(id)) : undefined
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filtre du sélecteur : genre + recherche (nom ou provenance, sans accents). */
export function filterIcons(catalog: ProfileIcon[], kind: IconKind | 'all', q: string): ProfileIcon[] {
  const words = fold(q).split(/\s+/).filter(Boolean)
  return catalog.filter((i) => (kind === 'all' || i.kind === kind) && words.every((w) => fold(`${i.name} ${i.source}`).includes(w)))
}
