import type { Booster, Card, CardSet, HistoryEvent, OwnedCard, PackSlotRates, Wishlist } from '../types'
import { stamp } from '../sync/device'
import { BASE, db } from './schema'

// ---------- Chargement des données de référence ----------

interface DataBundle {
  sets: CardSet[]; boosters: Booster[]; cards: Card[]; rates: PackSlotRates[]
  owned?: OwnedCard[]; wishlist?: Wishlist[]; history?: HistoryEvent[]
  version: string
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + s.length
}

async function fetchText(name: string): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}data/${name}.json`, { cache: 'no-cache' })
    if (!r.ok) return null
    const t = await r.text()
    // Un fallback SPA peut renvoyer du HTML : on l'ignore.
    return t.trim().startsWith('<') ? null : t
  } catch { return null }
}

/** Version des données livrées (`data/version.json`, générée au build) ; null si illisible. */
async function fetchDataVersion(): Promise<string | null> {
  const t = await fetchText('version')
  if (!t) return null
  try {
    const v = (JSON.parse(t) as { version?: unknown }).version
    return typeof v === 'string' && v ? v : null
  } catch { return null }
}

async function loadExtras(): Promise<Pick<DataBundle, 'owned' | 'wishlist' | 'history'>> {
  const extra = await Promise.all(['owned', 'wishlist', 'history'].map(fetchText))
  const [owned, wishlist, history] = extra.map((t) => (t ? JSON.parse(t) : undefined))
  return { owned, wishlist, history }
}

/**
 * Lit les données de référence livrées. Renvoie null si l'un des fichiers manque
 * (réseau instable) : l'appelant garde alors les données en place.
 */
async function loadBundle(remoteVersion: string | null, withRef: boolean): Promise<DataBundle | null> {
  const extras = await loadExtras()
  if (!withRef) return { sets: [], boosters: [], cards: [], rates: [], ...extras, version: remoteVersion ?? '' }
  const names = ['sets', 'boosters', 'cards', 'rates'] as const
  const texts = await Promise.all(names.map(fetchText))
  if (texts.every((t) => t !== null)) {
    const [sets, boosters, cards, rates] = texts.map((t) => JSON.parse(t!))
    return { sets, boosters, cards, rates, ...extras, version: remoteVersion ?? hash(texts.join('|')) }
  }
  if (import.meta.env.DEV) {
    // Jeu de développement (absent du build de production).
    const [s, b, c, r] = await Promise.all([
      import('../fixtures/sets.json'), import('../fixtures/boosters.json'),
      import('../fixtures/cards.json'), import('../fixtures/rates.json'),
    ])
    return {
      sets: s.default as CardSet[], boosters: b.default as Booster[],
      cards: c.default as Card[], rates: r.default as PackSlotRates[], version: 'fixtures',
    }
  }
  return null
}

export interface ReseedPlan { drop: string[]; bundleBoosterIds: Set<string>; rates: PackSlotRates[]; notices: string[] }

/**
 * Prépare le rechargement des tables de référence (hors écriture) :
 * - les taux saisis par l'utilisateur (lignes horodatées) l'emportent sur les taux livrés du même booster,
 *   y compris quand une extension livrée a le même id qu'une extension ajoutée à la main ;
 * - `notices` : extensions livrées nouvelles pour cet appareil (pas déjà présentes, ni livrées avant),
 *   à annoncer sur l'accueil. Vide à la première installation.
 */
export async function planReseed(bundle: Pick<DataBundle, 'sets' | 'boosters' | 'rates'>, prevShipped: string[], hadData: boolean): Promise<ReseedPlan> {
  const bundleBoosterIds = new Set(bundle.boosters.map((b) => b.id))
  const drop = [...new Set([...prevShipped, ...bundle.sets.map((s) => s.id)])]
  const userRates = (await db.rates.toArray()).filter((r) => r.updatedAt && bundleBoosterIds.has(r.boosterId))
  const overridden = new Set(userRates.map((r) => r.boosterId))
  const rates = [...bundle.rates.filter((r) => !overridden.has(r.boosterId)), ...userRates]
  const previous = new Set(prevShipped)
  const notices: string[] = []
  if (hadData && prevShipped.length) {
    const present = new Set((await db.sets.toArray()).map((s) => s.id))
    for (const s of bundle.sets) if (!previous.has(s.id) && !present.has(s.id)) notices.push(s.id)
  }
  return { drop, bundleBoosterIds, rates, notices }
}

/**
 * Charge public/data/*.json (sets, boosters, cards, rates, + optionnels owned/wishlist/history).
 * Tables de référence remplacées quand la version change (les extensions ajoutées par
 * l'utilisateur, absentes des données livrées, sont conservées).
 * Tables utilisateur remplies seulement si vides.
 */
export async function seedIfNeeded(): Promise<void> {
  const remoteVersion = await fetchDataVersion()
  const cur = await db.meta.get('dataVersion')
  const hasCards = (await db.cards.count()) > 0
  const emptyUser = {
    owned: (await db.owned.count()) === 0,
    wishlist: (await db.wishlist.count()) === 0,
    history: (await db.history.count()) === 0,
  }
  // Version identique et cartes présentes : pas besoin de relire les gros fichiers de référence.
  const refUpToDate = hasCards && remoteVersion !== null && cur?.value === remoteVersion
  if (refUpToDate && !emptyUser.owned && !emptyUser.wishlist && !emptyUser.history) return

  const bundle = await loadBundle(remoteVersion, !refUpToDate)
  if (!bundle) {
    // Fichiers injoignables : on garde les données en place et on réessaiera au prochain démarrage.
    if (hasCards) return
    throw new Error('Impossible de charger les données de référence. Vérifie ta connexion puis réessaie.')
  }
  const needRef = !refUpToDate && cur?.value !== bundle.version
  const prevShipped = ((await db.meta.get('shippedSetIds'))?.value as string[] | undefined) ?? []
  if (!needRef && !emptyUser.owned && !emptyUser.wishlist && !emptyUser.history) return

  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta], async () => {
    if (needRef) {
      const plan = await planReseed(bundle, prevShipped, cur !== undefined)
      await db.sets.bulkDelete(plan.drop)
      await db.boosters.where('setId').anyOf(plan.drop).delete()
      await db.cards.where('setId').anyOf(plan.drop).delete()
      await db.rates.filter((r) => plan.bundleBoosterIds.has(r.boosterId)).delete()
      await db.sets.bulkPut(bundle.sets)
      await db.boosters.bulkPut(bundle.boosters)
      await db.cards.bulkPut(bundle.cards)
      // Taux saisis par l'utilisateur (ligne horodatée) : prioritaires sur ceux livrés pour le même booster.
      await db.rates.bulkPut(plan.rates)
      await db.meta.bulkPut([
        { key: 'dataVersion', value: bundle.version },
        { key: 'shippedSetIds', value: bundle.sets.map((s) => s.id) },
        ...(plan.notices.length
          ? [{ key: 'newSetNotices', value: [...new Set([...(((await db.meta.get('newSetNotices'))?.value as string[] | undefined) ?? []), ...plan.notices])] }]
          : []),
      ])
    }
    const st = stamp()
    const sd = <T extends object>(x: T): T => ({ ...x, ...st })
    if (emptyUser.owned && bundle.owned?.length) await db.owned.bulkPut(bundle.owned.map(sd))
    if (emptyUser.wishlist && bundle.wishlist?.length) await db.wishlist.bulkPut(bundle.wishlist.map(sd))
    if (emptyUser.history && bundle.history?.length) await db.history.bulkPut(bundle.history.map(sd))
  })
}

