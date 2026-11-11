import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addPack, addPacks, applyCorrections, db, exportBackup, importBackup, resetUserData, saveImportedEvents,
  saveRates, setOwned, setPackBooster, setWish, share, syncImportedEvents, trade, undoLast, undoLastN, UndoError,
} from './db'
import type { ImportedEvent } from './events/pokemonZone'
import { onReveal } from './reveal'
import { fakeLocalStorage, resetDb, useDevice } from './testUtils'

vi.stubGlobal('localStorage', fakeLocalStorage)

const card = (id: string, rarity = 'D1', boosterIds = ['A1-X']) =>
  ({ id, setId: 'A1', number: 1, name: id, nameEn: id, type: 'Plante', stage: 'Base', rarity, boosterIds }) as never
const qty = async (id: string) => (await db.owned.get(id))?.quantity ?? 0

async function seedRef() {
  await db.sets.put({ id: 'A1', name: 'A1', nameEn: 'A1', releaseDate: '2024-10-30', order: 1 })
  await db.boosters.put({ id: 'A1-X', setId: 'A1', name: 'X' })
  await db.cards.bulkPut([card('A1-1'), card('A1-2'), card('A1-3', 'E1'), card('A1-4', 'E3')])
}

beforeEach(async () => {
  fakeLocalStorage.clear(); useDevice('dA')
  await resetDb()
  await seedRef()
})

describe('migrations Dexie', () => {
  it('v1 → v3 : horodate les lignes utilisateur et les extensions ajoutées à la main, pas les livrées', async () => {
    await db.delete(); db.close()
    // Base v1 telle que l'ancienne version l'écrivait.
    const old = new Dexie('ptcgp')
    old.version(1).stores({
      sets: 'id, order', boosters: 'id, setId', cards: 'id, setId, rarity, *boosterIds',
      rates: '[boosterId+packType], boosterId', owned: 'cardId', wishlist: 'cardId, priority',
      history: 'id, date, kind', meta: 'key',
    })
    await old.open()
    await old.table('sets').bulkPut([{ id: 'A1', order: 1 }, { id: 'U1', order: 2 }])
    await old.table('boosters').bulkPut([{ id: 'A1-X', setId: 'A1' }, { id: 'U1-Y', setId: 'U1' }])
    await old.table('cards').bulkPut([{ id: 'A1-1', setId: 'A1' }, { id: 'U1-1', setId: 'U1' }])
    await old.table('rates').bulkPut([{ boosterId: 'A1-X', packType: 'n' }, { boosterId: 'U1-Y', packType: 'n' }])
    await old.table('owned').put({ cardId: 'A1-1', quantity: 2 })
    await old.table('wishlist').put({ cardId: 'A1-1', priority: 1 })
    await old.table('history').put({ id: 'h1', kind: 'pack', date: '2025-01-01', boosterId: 'A1-X', cardIds: ['A1-1'] })
    await old.table('meta').put({ key: 'shippedSetIds', value: ['A1'] })
    old.close()

    await db.open()
    expect(db.verno).toBe(3)
    expect((await db.owned.get('A1-1'))?.updatedAt).toBeTruthy()
    expect((await db.wishlist.get('A1-1'))?.by).toBeTruthy()
    expect((await db.history.get('h1'))?.updatedAt).toBeTruthy()
    // Extension livrée : jamais synchronisée, donc pas d'horodatage.
    expect((await db.sets.get('A1') as { updatedAt?: string }).updatedAt).toBeUndefined()
    expect((await db.cards.get('A1-1') as { updatedAt?: string }).updatedAt).toBeUndefined()
    // Extension ajoutée à la main : horodatée avec ses boosters, cartes et taux.
    expect((await db.sets.get('U1') as { updatedAt?: string }).updatedAt).toBeTruthy()
    expect((await db.boosters.get('U1-Y') as { updatedAt?: string }).updatedAt).toBeTruthy()
    expect((await db.cards.get('U1-1') as { updatedAt?: string }).updatedAt).toBeTruthy()
    expect((await db.rates.get(['U1-Y', 'n']))?.updatedAt).toBeTruthy()
    expect((await db.rates.get(['A1-X', 'n']))?.updatedAt).toBeUndefined()
    // Les tables v2 et v3 existent.
    expect(await db.tombstones.count()).toBe(0)
    expect(await db.importedEvents.count()).toBe(0)
  })
})

describe('évènements', () => {
  it('addPack ajoute les cartes (doublons cumulés), écrit l’historique horodaté', async () => {
    const ev = await addPack('A1-X', ['A1-1', 'A1-1', 'A1-2'])
    expect(await qty('A1-1')).toBe(2)
    expect(await qty('A1-2')).toBe(1)
    const h = await db.history.get(ev.id)
    expect(h?.kind).toBe('pack')
    expect(h?.by).toBe('dA')
    expect(h?.updatedAt).toBeTruthy()
    expect((await db.owned.get('A1-1'))?.by).toBe('dA')
  })

  it('addPack sans carte est refusé', async () => {
    await expect(addPack('A1-X', [])).rejects.toThrow()
    expect(await db.history.count()).toBe(0)
  })

  it('addPacks écrit un évènement par pack, ignore les packs vides, une seule émission « nouvelle carte »', async () => {
    const seen: string[][] = []
    const off = onReveal((ids) => seen.push(ids))
    const evs = await addPacks([
      { boosterId: 'A1-X', cardIds: ['A1-1', 'A1-2'] },
      { boosterId: 'A1-X', cardIds: [] },
      { boosterId: 'A1-X', cardIds: ['A1-1', 'A1-3'] },
    ])
    off()
    expect(evs).toHaveLength(2)
    expect(await db.history.count()).toBe(2)
    expect(await qty('A1-1')).toBe(2)
    expect(seen).toHaveLength(1)
    expect(seen[0].sort()).toEqual(['A1-1', 'A1-2', 'A1-3'])
    await expect(addPacks([])).rejects.toThrow()
  })

  it('« nouvelle carte » ne se déclenche que pour 0 → ≥1', async () => {
    const seen: string[][] = []
    const off = onReveal((ids) => seen.push(ids))
    await addPack('A1-X', ['A1-1'])
    await addPack('A1-X', ['A1-1'])
    await setOwned('A1-2', 1)
    await setOwned('A1-2', 3)
    off()
    expect(seen).toEqual([['A1-1'], ['A1-2']])
  })

  it('share donné : exige une carte partageable avec 2 exemplaires', async () => {
    await setOwned('A1-1', 1)
    await expect(share('A1-1', 'given', 'Léa')).rejects.toThrow()
    await setOwned('A1-1', 2)
    await share('A1-1', 'given', 'Léa')
    expect(await qty('A1-1')).toBe(1)
    await setOwned('A1-3', 5)
    await expect(share('A1-3', 'given')).rejects.toThrow() // E1 non partageable
    await share('A1-2', 'received')
    expect(await qty('A1-2')).toBe(1)
  })

  it('trade : un échange déplace une carte contre une autre, refuse E3 et le manque d’exemplaires', async () => {
    await setOwned('A1-3', 2)
    const ev = await trade('A1-3', 'A1-1', 'Max', 1)
    expect(await qty('A1-3')).toBe(1)
    expect(await qty('A1-1')).toBe(1)
    expect(ev.kind).toBe('trade')
    await expect(trade('A1-3', 'A1-2')).rejects.toThrow() // 1 seul exemplaire
    await setOwned('A1-4', 3)
    await expect(trade('A1-4', 'A1-2')).rejects.toThrow() // E3
  })

  it('applyCorrections ne garde que les vrais changements, arrondit et plancher à 0', async () => {
    await setOwned('A1-1', 2)
    const ev = await applyCorrections([
      { cardId: 'A1-1', to: 2 }, // inchangé
      { cardId: 'A1-2', to: 3.7 },
      { cardId: 'A1-3', to: -4 }, // 0 → 0
    ])
    expect(ev?.kind).toBe('correction')
    expect(ev && ev.kind === 'correction' ? ev.changes : null).toEqual([{ cardId: 'A1-2', from: 0, to: 3 }])
    expect(await qty('A1-2')).toBe(3)
    expect(await applyCorrections([{ cardId: 'A1-1', to: 2 }])).toBeNull()
  })

  it('une quantité à 0 supprime la ligne et laisse une marque de suppression, qui disparaît au retour de la carte', async () => {
    await setOwned('A1-1', 2)
    await setOwned('A1-1', 0)
    expect(await db.owned.get('A1-1')).toBeUndefined()
    const t = await db.tombstones.get('owned:A1-1')
    expect(t).toMatchObject({ table: 'owned', id: 'A1-1', by: 'dA' })
    await setOwned('A1-1', 1)
    expect(await db.tombstones.get('owned:A1-1')).toBeUndefined()
  })

  it('setWish crée, met à jour puis retire avec marque de suppression', async () => {
    await setWish('A1-1', 2)
    expect((await db.wishlist.get('A1-1'))?.priority).toBe(2)
    await setWish('A1-1', 1)
    expect((await db.wishlist.get('A1-1'))?.priority).toBe(1)
    await setWish('A1-1', null)
    expect(await db.wishlist.get('A1-1')).toBeUndefined()
    expect(await db.tombstones.get('wishlist:A1-1')).toBeTruthy()
    await setWish('A1-1', 3)
    expect(await db.tombstones.get('wishlist:A1-1')).toBeUndefined()
  })

  it('setPackBooster change le booster sans toucher à l’inventaire', async () => {
    const ev = await addPack('A1-X', ['A1-1'])
    await setPackBooster(ev.id, 'A1-Y')
    expect(await qty('A1-1')).toBe(1)
    const h = await db.history.get(ev.id)
    expect(h && h.kind === 'pack' ? h.boosterId : null).toBe('A1-Y')
  })
})

describe('annulation', () => {
  it('annule le dernier évènement : quantités inversées, évènement retiré, marque de suppression posée', async () => {
    await addPack('A1-X', ['A1-1', 'A1-2'])
    const ev2 = await addPack('A1-X', ['A1-1'])
    const undone = await undoLast()
    expect(undone?.id).toBe(ev2.id)
    expect(await qty('A1-1')).toBe(1)
    expect(await db.history.get(ev2.id)).toBeUndefined()
    expect(await db.tombstones.get(`history:${ev2.id}`)).toBeTruthy()
  })

  it('undoLastN annule plusieurs évènements puis s’arrête sans erreur quand il n’en reste plus', async () => {
    await addPack('A1-X', ['A1-1'])
    await addPack('A1-X', ['A1-2'])
    await undoLastN(5)
    expect(await db.owned.count()).toBe(0)
    expect(await undoLast()).toBeNull()
  })

  it('annuler un pack dont les cartes ont changé depuis lève une UndoError claire et ne modifie rien', async () => {
    await addPack('A1-X', ['A1-1'])
    await setOwned('A1-1', 0)
    await expect(undoLast()).rejects.toBeInstanceOf(UndoError)
    expect(await db.history.count()).toBe(1)
  })

  it('n’annule pas les évènements d’un autre appareil', async () => {
    useDevice('dB')
    await addPack('A1-X', ['A1-1'])
    useDevice('dA')
    await expect(undoLast()).rejects.toBeInstanceOf(UndoError)
    expect(await qty('A1-1')).toBe(1)
    useDevice('dB')
    expect(await undoLast()).not.toBeNull()
  })

  it('annuler un échange rend les deux cartes', async () => {
    await setOwned('A1-3', 2)
    await trade('A1-3', 'A1-1')
    await undoLast()
    expect(await qty('A1-3')).toBe(2)
    expect(await qty('A1-1')).toBe(0)
  })
})

describe('sauvegarde : export / import', () => {
  it('aller-retour : l’export réimporté redonne le même état', async () => {
    await addPack('A1-X', ['A1-1', 'A1-2'])
    await setWish('A1-3', 1)
    await db.meta.put({ key: 'pz.home', value: { x: 1 } })
    const b = await exportBackup()
    expect(b.app).toBe('ptcgp-collection')
    await resetUserData()
    expect(await db.owned.count()).toBe(0)
    await importBackup(JSON.parse(JSON.stringify(b)))
    expect(await qty('A1-1')).toBe(1)
    expect(await db.history.count()).toBe(1)
    expect((await db.wishlist.get('A1-3'))?.priority).toBe(1)
    expect(await db.cards.count()).toBe(4)
    expect((await db.meta.get('pz.home'))?.value).toEqual({ x: 1 })
  })

  it('l’import remplace les données utilisateur et pose des marques de suppression pour les lignes disparues', async () => {
    await setOwned('A1-1', 2)
    await setOwned('A1-2', 1)
    const b = await exportBackup()
    b.owned = b.owned.filter((r) => r.cardId === 'A1-1')
    await importBackup(b)
    expect(await db.owned.count()).toBe(1)
    expect(await db.tombstones.get('owned:A1-2')).toBeTruthy()
    expect(await db.tombstones.get('owned:A1-1')).toBeUndefined()
  })

  it('l’import horodate les lignes avec l’appareil courant (pour se propager)', async () => {
    await setOwned('A1-1', 1)
    const b = await exportBackup()
    useDevice('dC')
    await importBackup(b)
    expect((await db.owned.get('A1-1'))?.by).toBe('dC')
  })

  it('l’import conserve les clés meta absentes du fichier', async () => {
    const b = await exportBackup()
    await db.meta.put({ key: 'pm.tierlist', value: 'garder' })
    await importBackup(b)
    expect((await db.meta.get('pm.tierlist'))?.value).toBe('garder')
  })

  it('un fichier invalide est refusé sans rien effacer', async () => {
    await setOwned('A1-1', 2)
    const b = await exportBackup()
    const bad = { ...b, owned: [{ cardId: 'A1-1', quantity: -3 }] }
    await expect(importBackup(bad)).rejects.toThrow(/invalide/i)
    await expect(importBackup({ foo: 1 })).rejects.toThrow()
    expect(await qty('A1-1')).toBe(2)
    expect(await db.cards.count()).toBe(4)
  })

  it('un fichier de synchro est fusionné au lieu de tout remplacer', async () => {
    await setOwned('A1-1', 2)
    const remote = {
      app: 'ptcgp-sync', version: 1, deviceId: 'dZ', updatedAt: '2099-01-01T00:00:00.000Z',
      tables: {
        owned: [{ cardId: 'A1-2', quantity: 4, updatedAt: '2099-01-01T00:00:00.000Z', by: 'dZ' }],
        wishlist: [], history: [], sets: [], boosters: [], cards: [], rates: [], importedEvents: [],
      },
    }
    await importBackup(remote)
    expect(await qty('A1-1')).toBe(2)
    expect(await qty('A1-2')).toBe(4)
  })

  it('l’export inclut les évènements importés', async () => {
    await saveImportedEvents([ev('e1', '2030-01-01T00:00:00Z')])
    expect((await exportBackup()).importedEvents).toHaveLength(1)
  })
})

describe('resetUserData', () => {
  it('vide les données utilisateur (marques de suppression incluses), garde la référence', async () => {
    await addPack('A1-X', ['A1-1'])
    await setWish('A1-2', 1)
    await resetUserData()
    expect(await db.owned.count()).toBe(0)
    expect(await db.wishlist.count()).toBe(0)
    expect(await db.history.count()).toBe(0)
    expect(await db.tombstones.get('owned:A1-1')).toBeTruthy()
    expect(await db.cards.count()).toBe(4)
  })
})

describe('taux saisis', () => {
  it('saveRates remplace les taux d’un booster, garde un type retiré à 0 %, retire l’annonce de nouvelle extension', async () => {
    await db.meta.put({ key: 'newSetNotices', value: ['A1', 'B1'] })
    const row = (packType: string, rate: number) => ({ boosterId: 'A1-X', packType, packTypeRate: rate, slots: [{ slot: 1, rates: { D1: 100 } }] }) as never
    await saveRates(['A1-X'], [row('normal', 90), row('rare', 10)])
    await saveRates(['A1-X'], [row('normal', 100)])
    const rows = await db.rates.toArray()
    expect(rows.find((r) => r.packType === 'normal')?.packTypeRate).toBe(100)
    const removed = rows.find((r) => r.packType === 'rare')
    expect(removed).toMatchObject({ packTypeRate: 0, slots: [] })
    expect(removed?.updatedAt).toBeTruthy()
    expect((await db.meta.get('newSetNotices'))?.value).toEqual(['B1'])
  })
})

function ev(id: string, start: string, over: Partial<ImportedEvent> = {}): ImportedEvent {
  return { id, source: 'pokemon-zone', name: id, nameFr: id, group: 'picks', start, end: '2031-01-01T00:00:00Z', type: 'event', ...over } as unknown as ImportedEvent
}

describe('évènements importés', () => {
  it('syncImportedEvents n’écrit que le nouveau ou le modifié', async () => {
    const now = Date.parse('2025-06-01T00:00:00Z')
    const a = ev('a', '2025-07-01T00:00:00Z'), b = ev('b', '2025-08-01T00:00:00Z')
    expect(await syncImportedEvents([a, b], now)).toEqual({ written: 2, removed: 0, fresh: 2 })
    expect(await syncImportedEvents([a, b], now)).toEqual({ written: 0, removed: 0, fresh: 0 })
    const r = await syncImportedEvents([a, { ...b, nameFr: 'autre' }], now)
    expect(r).toEqual({ written: 1, removed: 0, fresh: 0 })
  })

  it('retire un évènement futur qui n’est plus annoncé (avec marque de suppression), pas un évènement déjà commencé', async () => {
    const now = Date.parse('2025-06-01T00:00:00Z')
    const past = ev('past', '2025-05-01T00:00:00Z'), future = ev('future', '2025-07-01T00:00:00Z')
    await syncImportedEvents([past, future], now)
    const r = await syncImportedEvents([], now)
    expect(r.removed).toBe(1)
    expect(await db.importedEvents.get('future')).toBeUndefined()
    expect(await db.importedEvents.get('past')).toBeTruthy()
    expect(await db.tombstones.get('importedEvents:future')).toBeTruthy()
  })

  it('un évènement qui revient efface sa marque de suppression', async () => {
    const now = Date.parse('2025-06-01T00:00:00Z')
    const f = ev('f', '2025-07-01T00:00:00Z')
    await syncImportedEvents([f], now)
    await syncImportedEvents([], now)
    await syncImportedEvents([f], now)
    expect(await db.tombstones.get('importedEvents:f')).toBeUndefined()
    expect(await db.importedEvents.get('f')).toBeTruthy()
  })
})
