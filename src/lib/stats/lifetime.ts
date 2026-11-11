/**
 * Statistiques « à vie » : l'instantané Pokémon-Zone (page Statistiques du profil) prolongé par les
 * packs complets saisis dans l'appli après l'import. Logique pure, sans accès à la base.
 *
 * Sources :
 *  - Pokémon-Zone compte tout ce que le jeu a enregistré (packs, pioches miracle, missions…) ;
 *  - l'appli n'ajoute que les packs complets saisis après `fetchedAt` (même règle que `computeBaseline`).
 */
import type { Booster, Card, CardSet, HistoryEvent, Rarity } from '../types'
import { RARITY_ORDER } from '../calc/rules'
import type { PzCounter, PzStats } from '../pzProfile/types'
import { packsAfter, pzSetToSetId } from '../pzProfile/baseline'
import { isFullPack, onlyPacks } from './packs'
import { dayKey } from './dates'
import { setIdOf } from '../setId'

/** Libellés français des compteurs du profil (clé = libellé anglais en kebab-case). */
export const PZ_COUNTER_FR: Record<string, string> = {
  'packs-opened': 'Packs ouverts',
  'cards-obtained': 'Cartes obtenues',
  'unique-cards-obtained': 'Cartes différentes obtenues',
  'wonder-picks': 'Pioches miracle',
  'trades': 'Échanges',
  'trade-partners': 'Partenaires d’échange',
  'days-played': 'Jours de jeu',
  'themed-collections-cleared': 'Collections à thème terminées',
  'flairs-crafted': 'Effets créés',
  'friends-added': 'Amis ajoutés',
  'thanks-sent': 'Remerciements envoyés',
  'decks-created': 'Decks créés',
  'display-boards-created': 'Présentoirs créés',
  'cards-given': 'Cartes offertes',
  'player-level': 'Niveau de joueur',
  'most-damage-in-a-battle': 'Dégâts max en un combat',
}
export const counterLabelFr = (c: Pick<PzCounter, 'key' | 'label'>): string => PZ_COUNTER_FR[c.key] ?? c.label

const TYPE_FR: Record<string, string> = {
  Grass: 'Plante', Fire: 'Feu', Water: 'Eau', Lightning: 'Électrique', Psychic: 'Psy', Fighting: 'Combat',
  Darkness: 'Obscurité', Metal: 'Métal', Dragon: 'Dragon', Colorless: 'Incolore',
  Supporter: 'Supporter', Item: 'Objet', 'Pokémon Tool': 'Outil Pokémon', Stadium: 'Stade', Fossil: 'Fossile',
  'Ultra Beasts': 'Ultra-Chimères', 'Mega Evolution ex': 'Méga-Évolutions ex', Ancient: 'Pokémon du passé', Future: 'Pokémon du futur',
  'Alolan forms': 'Formes d’Alola', 'Galarian forms': 'Formes de Galar', 'Hisuian forms': 'Formes de Hisui', 'Paldean forms': 'Formes de Paldea',
  "Team Rocket's Pokémon": 'Pokémon de la Team Rocket', 'Team Rocket’s Pokémon': 'Pokémon de la Team Rocket',
}
export const pzLabelFr = (label: string): string => TYPE_FR[label.trim()] ?? label

/** Noms anglais des Pokémon mascottes de booster quand ils diffèrent du français. */
const MASCOT_FR: Record<string, string> = { charizard: 'dracaufeu', blaziken: 'braségali', gyarados: 'léviator' }
const norm = (s: string) => s.normalize('NFC').trim().toLowerCase().replace(/^m[ée]ga[- ]/, '').replace(/\s+[xy]$/, '').replace(/[’']/g, '').trim()

/**
 * Icône de pack Pokémon-Zone (`PACK_ICON_AN005_0010_00_000`) -> id de booster de l'appli.
 * Le code `AN005` donne la série (A) et le rang de l'extension dans la série (5e = A2b) ;
 * le booster est retrouvé par le nom de la mascotte (« Genetic Apex: Charizard » -> A1-Dracaufeu),
 * ou directement quand l'extension n'a qu'un booster.
 */
export function pzPackToBoosterId(packIcon: string, name: string, sets: CardSet[], boosters: Booster[]): string | null {
  const m = /^PACK_ICON_([A-Z]+)N?(\d{3})_(\d{4})/.exec(packIcon)
  if (!m) return null
  const [, series, idx] = m
  let setId: string | null = null
  if (series === 'SP') setId = sets.find((s) => s.id.toUpperCase() === `SP${Number(idx)}`)?.id ?? null
  else {
    const letter = series.charAt(0)
    const regular = sets.filter((s) => s.id.startsWith(letter) && /^[A-Z]\d/.test(s.id)).sort((a, b) => a.order - b.order)
    setId = regular[Number(idx) - 1]?.id ?? null
  }
  if (!setId) return null
  const own = boosters.filter((b) => b.setId === setId && !b.entryOnly)
  if (own.length === 1) return own[0].id
  const mascot = norm(name.split(':').pop() ?? '')
  const fr = MASCOT_FR[mascot] ?? mascot
  return own.find((b) => norm(b.name) === fr)?.id ?? null
}

export interface LifetimeSet { setCode: string; setId: string | null; name: string; packs: number; added: number; cards: number; unique: number; total: number }
export interface LifetimeBooster { boosterId: string | null; name: string; packs: number; added: number }
export interface LifetimeBar { label: string; value: number; unique?: number }
export interface LifetimeRarity { rarity: Rarity; value: number; unique: number; added: number }

export interface Lifetime {
  /** Date des données du jeu sur Pokémon-Zone (« as of »), et date de l'import. */
  asOf: string | null
  fetchedAt: string
  packs: number | null
  cards: number | null
  uniqueCards: number | null
  daysPlayed: number | null
  /** Packs et cartes saisis dans l'appli depuis l'import. */
  addedPacks: number
  addedCards: number
  counters: (PzCounter & { labelFr: string })[]
  bySet: LifetimeSet[]
  byBooster: LifetimeBooster[]
  byRarity: LifetimeRarity[]
  byType: LifetimeBar[]
  trainers: LifetimeBar[]
  special: LifetimeBar[]
}

export interface LifetimeInput {
  fetchedAt: string
  stats: PzStats
  history: HistoryEvent[]
  cards: Card[]
  cardById: Map<string, Card>
  sets: CardSet[]
  boosters: Booster[]
}

const counter = (s: PzStats, key: string) => s.counters.find((c) => c.key === key)?.value ?? null

export function computeLifetime(i: LifetimeInput): Lifetime {
  const after = packsAfter(i.history, i.fetchedAt)
  const boosterSet = (id: string) => i.boosters.find((b) => b.id === id)?.setId ?? setIdOf(id)
  const setIds = i.sets.map((s) => s.id)
  const addedBySet = new Map<string, number>(), addedByBooster = new Map<string, number>()
  const addedByRarity = new Map<Rarity, number>()
  let addedCards = 0
  for (const e of after) {
    const sid = boosterSet(e.boosterId)
    addedBySet.set(sid, (addedBySet.get(sid) ?? 0) + 1)
    addedByBooster.set(e.boosterId, (addedByBooster.get(e.boosterId) ?? 0) + 1)
    for (const id of e.cardIds) {
      addedCards++
      const r = i.cardById.get(id)?.rarity
      if (r) addedByRarity.set(r, (addedByRarity.get(r) ?? 0) + 1)
    }
  }
  const totalBySet = new Map<string, number>()
  for (const c of i.cards) totalBySet.set(c.setId, (totalBySet.get(c.setId) ?? 0) + 1)

  const bySet: LifetimeSet[] = i.stats.packsBySet.map((p) => {
    const setId = pzSetToSetId(p.setCode, setIds)
    const added = setId ? addedBySet.get(setId) ?? 0 : 0
    return { setCode: p.setCode, setId, name: p.name, packs: p.packs + added, added, cards: p.cards, unique: p.unique, total: setId ? totalBySet.get(setId) ?? 0 : 0 }
  }).sort((a, b) => b.packs - a.packs)

  const seenBooster = new Set<string>()
  const byBooster: LifetimeBooster[] = i.stats.packsByPack.map((p) => {
    const boosterId = pzPackToBoosterId(p.packIcon, p.name, i.sets, i.boosters)
    const added = boosterId ? addedByBooster.get(boosterId) ?? 0 : 0
    if (boosterId) seenBooster.add(boosterId)
    return { boosterId, name: p.name, packs: p.packs + added, added }
  })
  // Boosters ouverts dans l'appli après l'import mais absents de la photo (nouvelle extension).
  for (const [id, n] of addedByBooster) if (!seenBooster.has(id)) byBooster.push({ boosterId: id, name: id, packs: n, added: n })
  byBooster.sort((a, b) => b.packs - a.packs)

  const rar = new Map<Rarity, LifetimeRarity>()
  for (const b of i.stats.byRarity) {
    if (!b.rarity) continue
    const x = rar.get(b.rarity) ?? { rarity: b.rarity, value: 0, unique: 0, added: 0 }
    x.value += b.value; x.unique += b.unique ?? 0
    rar.set(b.rarity, x)
  }
  for (const [r, n] of addedByRarity) {
    const x = rar.get(r) ?? { rarity: r, value: 0, unique: 0, added: 0 }
    x.value += n; x.added += n
    rar.set(r, x)
  }

  const bars = (list: { label: string; value: number; unique?: number }[]) =>
    list.map((b) => ({ label: pzLabelFr(b.label), value: b.value, unique: b.unique })).sort((a, b) => b.value - a.value)

  const pk = counter(i.stats, 'packs-opened'), ck = counter(i.stats, 'cards-obtained')
  return {
    asOf: i.stats.asOf,
    fetchedAt: i.fetchedAt,
    packs: pk === null ? null : pk + after.length,
    cards: ck === null ? null : ck + addedCards,
    uniqueCards: counter(i.stats, 'unique-cards-obtained'),
    daysPlayed: counter(i.stats, 'days-played'),
    addedPacks: after.length,
    addedCards,
    counters: i.stats.counters.map((c) => ({ ...c, labelFr: counterLabelFr(c) })),
    bySet,
    byBooster,
    byRarity: RARITY_ORDER.filter((r) => rar.has(r)).map((r) => rar.get(r)!),
    byType: bars(i.stats.byType),
    trainers: bars(i.stats.trainers),
    special: bars(i.stats.special),
  }
}

export interface JournalCoverage {
  /** Premier jour du journal de l'appli (null si vide). */
  since: string | null
  /** Packs complets saisis dans l'appli, depuis le début du journal. */
  packs: number
}
/** Ce que couvre le journal de saisies de l'appli (packs complets). */
export function journalCoverage(history: HistoryEvent[]): JournalCoverage {
  const live = history.filter((e) => !e.deleted)
  const since = live.length ? dayKey(live.reduce((m, e) => (e.date < m ? e.date : m), live[0].date)) : null
  return { since, packs: onlyPacks(history).filter(isFullPack).length }
}
