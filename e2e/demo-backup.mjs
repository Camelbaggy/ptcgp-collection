// Jeu de données de démonstration pour les tests E2E : généré à partir des données de référence publiques
// (public/data), de façon déterministe. Aucune donnée personnelle.
import { readFileSync } from 'node:fs'

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'))

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const day = 86400000
const iso = (offsetDays, hour = 12) => new Date(Date.UTC(2026, 10, 11, hour) + offsetDays * day).toISOString()

export function buildDemoBackup() {
  const sets = read('sets.json')
  const boosters = read('boosters.json')
  const cards = read('cards.json')
  const rates = read('rates.json')
  const rand = rng(42)
  const stamp = { updatedAt: iso(0), by: 'demo' }

  // ~60 % des cartes possédées, avec des doubles et triples pour alimenter Échange / Partage.
  const owned = []
  for (const c of cards) {
    const r = rand()
    if (r < 0.4) continue
    owned.push({ cardId: c.id, quantity: r > 0.97 ? 4 : r > 0.9 ? 3 : r > 0.75 ? 2 : 1, ...stamp })
  }
  const ownedIds = owned.map((o) => o.cardId)
  const missing = cards.filter((c) => !ownedIds.includes(c.id))
  const wishlist = missing.slice(0, 12).map((c, i) => ({ cardId: c.id, priority: (i % 3) + 1, ...stamp }))

  const booster = boosters.find((b) => !b.entryOnly) ?? boosters[0]
  const boosterCards = cards.filter((c) => c.boosterIds?.includes(booster.id))
  const history = []
  for (let i = 0; i < 6; i++) {
    history.push({
      id: `demo-pack-${i}`, kind: 'pack', date: iso(-i * 2), boosterId: booster.id,
      cardIds: Array.from({ length: 5 }, () => boosterCards[Math.floor(rand() * boosterCards.length)].id), ...stamp,
    })
  }
  const dup = owned.filter((o) => o.quantity >= 2).slice(0, 2)
  if (dup[0]) history.push({ id: 'demo-share-0', kind: 'share', date: iso(-1), cardId: dup[0].cardId, direction: 'given', friend: 'Ami test', ...stamp })
  if (dup[1] && wishlist[0]) history.push({ id: 'demo-trade-0', kind: 'trade', date: iso(-3), given: dup[1].cardId, received: wishlist[0].cardId, friend: 'Ami test', tokens: 0, ...stamp })

  const events = [
    ['demo-ev-1', 'drop', 'Évènement de démonstration (en cours)', -2, 5],
    ['demo-ev-2', 'special', 'Mission de démonstration', -1, 3],
    ['demo-ev-3', 'wonderpick', 'Choix magique de démonstration', 1, 4],
    ['demo-ev-4', 'special', 'Évènement à venir de démonstration', 8, 14],
  ].map(([id, type, name, s, e]) => ({
    id, type, name, nameFr: name, source: 'pokemon-zone', group: 'picks', start: iso(s, 0), end: iso(e, 23),
    cardIds: wishlist.slice(0, 3).map((w) => w.cardId),
    missions: [{ text: 'Ouvre 3 boosters', target: 3 }], ...stamp,
  }))

  return {
    app: 'ptcgp-collection', version: 1, date: iso(0), sets, boosters, cards, rates, owned, wishlist, history,
    meta: [], importedEvents: events,
  }
}
