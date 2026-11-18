// Choix de la source de la tier list affichée par l'écran Méta : PocketMads quand sa lecture est
// récente, sinon le calcul Holothèque (score maison de meta.json, calculé depuis Limitless toutes
// les 6 h par update-meta.yml). Pur et testé.
import type { MetaDeck, MetaFile, WindowKey } from './compute'
import type { PmDeck, PmTierKey, PmTierList } from '../pocketMads/types'

/** Au-delà, la tier list PocketMads est jugée périmée (site hors ligne, lecture en échec…). */
export const PM_STALE_HOURS = 48
export const HOME_WINDOW: WindowKey = '7d'

export type MetaSource = 'pm' | 'home'
/** pourquoi le calcul Holothèque remplace PocketMads */
export type FallbackReason = 'none' | 'stale' | 'error'

export interface SourceChoice {
  source: MetaSource | null
  /** renseigné quand la source est le calcul Holothèque par repli */
  reason?: FallbackReason
  /** âge de la lecture PocketMads, en heures */
  pmAgeHours?: number
}

export function pmAgeHours(pm: PmTierList, now: number): number | null {
  const t = Date.parse(pm.fetchedAt)
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 3600000)) : null
}

/** Vrai si meta.json porte des tiers maison pour la période. */
export function hasHomeTiers(meta: MetaFile | null | undefined, win: WindowKey = HOME_WINDOW): boolean {
  return !!meta?.decks.some((d) => d.stats[win]?.tier != null)
}

/**
 * PocketMads si la lecture date de moins de PM_STALE_HOURS et que la dernière lecture n'a pas
 * échoué ; sinon le calcul Holothèque s'il existe ; à défaut, la vieille liste PocketMads.
 */
export function chooseMetaSource(pm: PmTierList | null | undefined, meta: MetaFile | null | undefined, now: number, pmError = false): SourceChoice {
  const age = pm ? pmAgeHours(pm, now) : null
  const fresh = !!pm && age !== null && age < PM_STALE_HOURS && !pmError
  if (fresh) return { source: 'pm' }
  if (hasHomeTiers(meta)) {
    const reason: FallbackReason = !pm ? 'none' : pmError ? 'error' : 'stale'
    return { source: 'home', reason, pmAgeHours: age ?? undefined }
  }
  if (pm) return { source: 'pm' }
  return { source: null }
}

const HOME_TIERS: PmTierKey[] = ['0', '1', '2', '3', 'S']
const HOME_LABEL: Record<PmTierKey, string> = { '0': 'Tier 0', '1': 'Tier 1', '2': 'Tier 2', '3': 'Tier 3', S: 'Sleepers' }

/** Tier list maison au format de la tier list PocketMads (mêmes lignes, même fiche). */
export function homeTierList(meta: MetaFile, win: WindowKey = HOME_WINDOW): PmTierList {
  const rows = meta.decks
    .map((d) => ({ d, s: d.stats[win] }))
    .filter((x): x is { d: MetaDeck; s: NonNullable<typeof x.s> } => !!x.s && x.s.tier !== null)
    .sort((a, b) => b.s.score - a.s.score)
  return {
    fetchedAt: meta.generatedAt,
    range: win,
    tiers: HOME_TIERS.map((key) => ({
      label: HOME_LABEL[key],
      key,
      decks: rows.filter((x) => String(x.s.tier) === key).map(({ d, s }): PmDeck => ({
        name: d.name, id: d.id, score: s.score, winRate: s.winRate, games: s.games, share: s.share, delta: s.delta,
      })),
    })),
  }
}
