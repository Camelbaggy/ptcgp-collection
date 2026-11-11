// Pure description of an event reward / shop item: which card, which booster, which cosmetic, with the image to show.
// Our own images first (card images, pack images, Serebii icons), then the Pokémon-Zone asset (`src`) for what we do not
// have (cosmetics, promo packs). Names: our French card / set / booster names, cosmetics named after the Pokémon in the
// asset file name (`PLAYMAT_100920_MEGAGEKKOUGA` -> « Tapis de jeu Méga-Amphinobi », see public/data/jp-names.json).
import type { Booster, Card, CardSet } from '../types'
import { setIdFromSlug } from './pokemonZone'
import { itemLabelFr } from './translate'

export type RewardKind = 'card' | 'pack' | 'cosmetic' | 'deck' | 'item'

export interface RewardView {
  kind: RewardKind
  /** French label, without the amount: « Méga-Amphinobi », « Booster Pulsation Aurale », « Tapis de jeu Hoopa ». */
  label: string
  /** Short kind label for cosmetics and packs (« Tapis de jeu », « Booster promo »). */
  sub?: string
  cardId?: string
  boosterId?: string
  setId?: string
  /** Image on the Pokémon-Zone asset CDN (absolute URL), for what we do not ship. */
  pzImage?: string
}

export interface RewardCtx {
  cards: Pick<Card, 'id' | 'name' | 'setId'>[]
  sets: Pick<CardSet, 'id' | 'name' | 'order'>[]
  boosters: Pick<Booster, 'id' | 'setId' | 'name' | 'entryOnly'>[]
  /** public/data/jp-names.json */
  jp?: Record<string, string>
}

export interface RewardInput { item?: string; link?: string; src?: string; cardId?: string; name?: string; kind?: string }

export const PZ_ASSETS = 'https://assets.pokemon-zone.com/game-assets/'
/** Absolute URL of a Pokémon-Zone asset path, resized by their CDN. */
export const pzAssetUrl = (src: string, width = 160) => `${PZ_ASSETS}${src}?width=${width}&quality=90`

const COSMETIC: [RegExp, string][] = [
  [/^EMBLEM_/i, 'Emblème'], [/^COIN_/i, 'Pièce'], [/^DECKSHIELD_/i, 'Protège-cartes'], [/^PLAYMAT_/i, 'Tapis de jeu'],
  [/^ICON_BOARD/i, 'Fond de présentoir'], [/^ICON_FILE/i, 'Couverture de classeur'], [/^PROFILE_ICON/i, 'Icône de profil'],
]
const GRADE_FR: Record<string, string> = { NOR: 'participation', BRZ: 'bronze', SIL: 'argent', GOL: 'or' }
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const MASCOT_EN: Record<string, string> = { dracaufeu: 'charizard', braségali: 'blaziken', 'léviator': 'gyarados' }
const bareMascot = (s: string) => s.normalize('NFC').trim().toLowerCase().replace(/^m[ée]ga[- ]/, '').replace(/\s+[xy]$/, '').replace(/[’']/g, '')

/** French name of one asset-name token (`MEGAGEKKOUGA` -> Méga-Amphinobi, `PremiumSet03` -> Set premium 3). */
function tokenFr(tok: string, jp: Record<string, string>): string | undefined {
  const t = tok.toUpperCase()
  if (jp[t]) return jp[t]
  const prem = /^PREMIUMSET0*(\d+)$/.exec(t)
  if (prem) return `Pass premium ${prem[1]}`
  if (t === 'MEGAEVOLUTION') return 'Méga-Évolution'
  const friends = /^(\w+?)FRIENDS$/.exec(t)
  if (friends && jp[friends[1]]) return `${jp[friends[1]]} et ses amis`
  const mega = /^MEGA(\w+?)([XY])?$/.exec(t)
  if (mega && jp[mega[1]]) return `Méga-${jp[mega[1]]}${mega[2] ? ' ' + mega[2] : ''}`
  // only known as a regional form in the cards (DOOH -> PALDEADOOH « Terraiste de Paldea » -> Terraiste)
  for (const region of ['PALDEA', 'ALOLA', 'GALAR', 'HISUI']) {
    const fr = jp[region + t]
    if (fr) return fr.replace(/\s+d['’]\S+$|\s+de\s+\S+$/, '')
  }
  return undefined
}

/** Subject of a cosmetic file name: `PLAYMAT_100790_PIKACHU_KODUCK_METAMON_BIPPA_PlayMat` -> « Pikachu, Psykokwak, Métamorph et Keunotor ». */
export function cosmeticSubject(file: string, jp: Record<string, string> = {}): string | undefined {
  const rest = file
    .replace(/^(EMBLEM|COIN|DECKSHIELD|PLAYMAT|PROFILE_ICON|ICON_BOARD|ICON_FILE)_\d+_?/i, '')
    .replace(/_(PlayMat|DeckShield|BattleCoin)$/i, '')
    .replace(/_Ver\d+$/i, '').replace(/_\d+$/, '')
  if (!rest) return undefined
  const names = rest.split('_').map((t) => tokenFr(t, jp))
  if (names.some((n) => !n)) return undefined
  const uniq = [...new Set(names as string[])]
  return uniq.length > 1 ? `${uniq.slice(0, -1).join(', ')} et ${uniq.at(-1)}` : uniq[0]
}

/** Booster of a Pokémon-Zone pack link / icon, or null (promo packs, unknown sets). */
export function packBooster(setId: string | null, packSlug: string, icon: string | undefined, ctx: RewardCtx): string | null {
  let own = setId ? ctx.boosters.filter((b) => b.setId === setId && !b.entryOnly) : []
  if (!own.length && icon) {
    // icon code: AN005 = 5th regular set of series A (promo packs: AP, BP, CP, EVP -> none)
    const m = /^PACK_ICON_([A-Z])N(\d{3})_/.exec(icon)
    if (m) {
      const regular = ctx.sets.filter((s) => s.id.startsWith(m[1]) && /^[A-Z]\d/.test(s.id)).sort((a, b) => a.order - b.order)
      const sid = regular[Number(m[2]) - 1]?.id
      own = sid ? ctx.boosters.filter((b) => b.setId === sid && !b.entryOnly) : []
    }
  }
  if (own.length === 1) return own[0].id
  const slug = '-' + packSlug + '-'
  const hit = own.find((b) => {
    const fr = bareMascot(b.name)
    return slug.includes('-' + slugify(MASCOT_EN[fr] ?? fr) + '-')
  })
  return hit?.id ?? null
}

const titleCase = (slug: string) => slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

/** Describes a reward or a shop item. */
export function describeReward(r: RewardInput, ctx: RewardCtx): RewardView {
  const item = r.item ?? ''
  const jp = ctx.jp ?? {}
  const pzImage = r.src ? pzAssetUrl(r.src) : undefined
  const img = pzImage ? { pzImage } : {}
  // card
  const cardLink = r.link ? /^\/cards\/([a-z0-9-]+)\/(\d{1,4})\//i.exec(r.link) : null
  if (r.cardId || cardLink || /^c(PK|TR)_/.test(item) || r.kind === 'pokemon_card' || r.kind === 'trainers_card') {
    const id = r.cardId ?? (cardLink ? `${setIdFromSlug(cardLink[1], ctx.sets.map((s) => s.id))}-${Number(cardLink[2])}` : undefined)
    const card = id ? ctx.cards.find((c) => c.id === id) : undefined
    const tok = /^c(?:PK|TR)_\d+_\d+_\d+_([A-Za-z0-9]+?)(?:ex)?_[A-Z]+$/.exec(item)?.[1]
    const label = card?.name ?? r.name ?? (tok && tokenFr(tok, jp)) ?? 'Carte'
    return { kind: 'card', label, ...(card ? { cardId: card.id, setId: card.setId } : {}), ...(card ? {} : img) }
  }
  // booster pack
  const packLink = r.link ? /^\/sets\/([a-z0-9-]+)\/packs\/([a-z0-9-]+)\//i.exec(r.link) : null
  if (packLink || /^PACK_ICON/i.test(item) || r.kind === 'pack') {
    const known = ctx.sets.map((s) => s.id)
    const sid = packLink && packLink[1] !== 'unk' ? setIdFromSlug(packLink[1], known) : null
    const setId = sid && known.includes(sid) ? sid : null
    const slug = packLink?.[2] ?? ''
    const boosterId = packBooster(setId, slug, item || undefined, ctx)
    const booster = boosterId ? ctx.boosters.find((b) => b.id === boosterId) : undefined
    const set = ctx.sets.find((s) => s.id === (booster?.setId ?? setId))
    const guaranteed = /1-card-guaranteed/.test(slug) ? ' (1 carte ★★ garantie)' : ''
    const promo = /^promo-pack-([a-z])-series-vol-(\d+)/.exec(slug)
    let label: string
    if (promo) label = `Booster promo série ${promo[1].toUpperCase()} vol. ${promo[2]}`
    else if (booster && set) label = (booster.name === set.name || /unique/i.test(booster.id) ? set.name : `${set.name} · ${booster.name}`) + guaranteed
    else if (set) label = set.name + guaranteed
    else label = slug ? titleCase(slug.replace(/-1-card-guaranteed$/, '')) + guaranteed : r.name ?? 'Booster'
    return {
      kind: 'pack', label, sub: promo ? 'Booster promo' : 'Booster',
      ...(boosterId ? { boosterId } : {}), ...(set ? { setId: set.id } : {}), ...(boosterId ? {} : img),
    }
  }
  // themed deck
  if (r.link && /^\/decks\//.test(r.link)) return { kind: 'deck', label: r.name ?? 'Deck à thème', ...img }
  // cosmetic
  const cos = COSMETIC.find(([re]) => re.test(item))
  if (cos) {
    let subject = cosmeticSubject(item, jp)
    const grade = /^EMBLEM_\d+_EVENT\d+_(NOR|BRZ|SIL|GOL)$/i.exec(item)?.[1].toUpperCase()
    if (grade) subject = GRADE_FR[grade]
    // shop items: « Méga-Amphinobi (cover) » (name already translated by the caller)
    const shopName = r.name?.replace(/\s*\([^)]*\)\s*$/, '').trim()
    const who = subject ?? (shopName || undefined)
    return { kind: 'cosmetic', label: who ? `${cos[1]} ${who}` : cos[1], sub: cos[1], ...img }
  }
  return { kind: 'item', label: item ? itemLabelFr(item) : r.name ?? 'Objet', ...img }
}
