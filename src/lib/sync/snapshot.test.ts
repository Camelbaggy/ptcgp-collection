import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPack, db, exportBackup, importBackup, saveNewSet, setOwned, setWish, undoLast } from '../db'
import { fakeLocalStorage, resetDb, useDevice } from '../testUtils'
import { buildSnapshot, exportSyncSnapshot, isApplyingSync, mergeIntoLocal } from './snapshot'
import type { SyncSnapshot } from './merge'

vi.stubGlobal('localStorage', fakeLocalStorage)

const card = (id: string, setId = 'A1') =>
  ({ id, setId, number: 1, name: id, nameEn: id, type: 'Plante', stage: 'Base', rarity: 'D1', boosterIds: [`${setId}-X`] }) as never
const qty = async (id: string) => (await db.owned.get(id))?.quantity ?? 0

async function seedRef() {
  await db.sets.put({ id: 'A1', name: 'A1', nameEn: 'A1', releaseDate: '2024-10-30', order: 1 })
  await db.boosters.put({ id: 'A1-X', setId: 'A1', name: 'X' })
  await db.cards.bulkPut([card('A1-1'), card('A1-2'), card('A1-3')])
  await db.meta.put({ key: 'shippedSetIds', value: ['A1'] })
}

/** Simule un second appareil : on garde le fichier « Drive » entre deux bases vides. */
async function asDevice(id: string, body: () => Promise<void>) {
  useDevice(id)
  await resetDb(); await seedRef()
  await body()
}

beforeEach(async () => {
  fakeLocalStorage.clear(); useDevice('dA')
  await resetDb(); await seedRef()
})

describe('buildSnapshot', () => {
  it('contient les lignes utilisateur et les marques de suppression, pas les cartes livrées', async () => {
    await addPack('A1-X', ['A1-1', 'A1-2'])
    await setOwned('A1-2', 0)
    await setWish('A1-3', 1)
    await setWish('A1-3', null)
    const s = await buildSnapshot()
    expect(s.app).toBe('ptcgp-sync')
    expect(s.deviceId).toBe('dA')
    expect(s.tables.owned.find((r) => r.cardId === 'A1-1')).toMatchObject({ quantity: 1 })
    expect(s.tables.owned.find((r) => r.cardId === 'A1-2')).toMatchObject({ deleted: true })
    expect(s.tables.wishlist.find((r) => r.cardId === 'A1-3')).toMatchObject({ deleted: true })
    expect(s.tables.history).toHaveLength(1)
    expect(s.tables.cards).toHaveLength(0)
    expect(s.tables.sets).toHaveLength(0)
    expect(s.updatedAt).toBeTruthy()
  })

  it('inclut les extensions ajoutées à la main avec leurs boosters et cartes, et les taux horodatés', async () => {
    await saveNewSet(
      { id: 'U1', name: 'U', nameEn: 'U', releaseDate: '2030-01-01', order: 9 },
      [{ id: 'U1-X', setId: 'U1', name: 'X' }], [card('U1-1', 'U1')],
      [{ boosterId: 'U1-X', packType: 'n', packTypeRate: 100, slots: [] }],
    )
    const s = await buildSnapshot()
    expect(s.tables.sets.map((r) => r.id)).toEqual(['U1'])
    expect(s.tables.boosters.map((r) => r.id)).toEqual(['U1-X'])
    expect(s.tables.cards.map((r) => r.id)).toEqual(['U1-1'])
    expect(s.tables.rates).toHaveLength(1)
  })
})

describe('mergeIntoLocal', () => {
  it('sans fichier distant : rien à écrire en local, téléversement demandé', async () => {
    await setOwned('A1-1', 1)
    const { stats } = await mergeIntoLocal(null)
    expect(stats.total).toBe(0)
    expect(stats.toUpload).toBe(true)
  })

  it('premier appareil → second : le second reçoit les cartes, l’historique et les souhaits', async () => {
    let drive!: SyncSnapshot
    await asDevice('dA', async () => {
      await addPack('A1-X', ['A1-1', 'A1-1', 'A1-2'])
      await setWish('A1-3', 2)
      drive = await exportSyncSnapshot()
    })
    await asDevice('dB', async () => {
      const { stats } = await mergeIntoLocal(drive)
      expect(stats.owned).toBe(2)
      expect(stats.history).toBe(1)
      expect(stats.toUpload).toBe(false)
      expect(await qty('A1-1')).toBe(2)
      expect((await db.wishlist.get('A1-3'))?.priority).toBe(2)
      expect(await db.history.count()).toBe(1)
    })
  })

  it('modifications sur des cartes différentes : tout est conservé des deux côtés, téléversement demandé', async () => {
    let drive!: SyncSnapshot
    await asDevice('dA', async () => { await setOwned('A1-1', 3); drive = await exportSyncSnapshot() })
    await asDevice('dB', async () => {
      await setOwned('A1-2', 4)
      const { stats, result } = await mergeIntoLocal(drive)
      expect(stats.toUpload).toBe(true)
      expect(await qty('A1-1')).toBe(3)
      expect(await qty('A1-2')).toBe(4)
      expect(result.merged.tables.owned.map((r) => r.cardId).sort()).toEqual(['A1-1', 'A1-2'])
    })
  })

  it('la même carte modifiée des deux côtés : la plus récente l’emporte, dans les deux sens', async () => {
    let a!: SyncSnapshot, b!: SyncSnapshot
    await asDevice('dA', async () => { await setOwned('A1-1', 2); a = await exportSyncSnapshot() })
    await new Promise((r) => setTimeout(r, 5))
    await asDevice('dB', async () => { await setOwned('A1-1', 5); b = await exportSyncSnapshot() })
    // Chaque appareil retrouve son état d'origine (horodatages conservés), puis reçoit le fichier de l'autre.
    await asDevice('dA', async () => { await mergeIntoLocal(a); await mergeIntoLocal(b); expect(await qty('A1-1')).toBe(5) })
    await asDevice('dB', async () => { await mergeIntoLocal(b); await mergeIntoLocal(a); expect(await qty('A1-1')).toBe(5) })
  })

  it('une suppression distante plus récente retire la ligne locale et laisse la marque de suppression', async () => {
    let before!: SyncSnapshot, after!: SyncSnapshot
    await asDevice('dA', async () => { await setOwned('A1-1', 2); before = await exportSyncSnapshot() })
    await new Promise((r) => setTimeout(r, 5))
    await asDevice('dB', async () => {
      await mergeIntoLocal(before)
      await setOwned('A1-1', 0)
      after = await exportSyncSnapshot()
    })
    await asDevice('dA', async () => {
      await mergeIntoLocal(before)
      expect(await qty('A1-1')).toBe(2)
      await mergeIntoLocal(after)
      expect(await db.owned.get('A1-1')).toBeUndefined()
      expect(await db.tombstones.get('owned:A1-1')).toMatchObject({ by: 'dB' })
    })
  })

  it('un évènement annulé sur un appareil disparaît aussi sur l’autre (l’annulation l’emporte)', async () => {
    let first!: SyncSnapshot, second!: SyncSnapshot
    await asDevice('dA', async () => {
      await addPack('A1-X', ['A1-1'])
      first = await exportSyncSnapshot()
      await new Promise((r) => setTimeout(r, 5))
      await undoLast()
      second = await exportSyncSnapshot()
    })
    expect(second.tables.history[0]).toMatchObject({ deleted: true })
    await asDevice('dB', async () => {
      await mergeIntoLocal(first)
      expect(await db.history.count()).toBe(1)
      await mergeIntoLocal(second)
      expect(await db.history.count()).toBe(0)
      expect(await db.tombstones.get(`history:${first.tables.history[0].id}`)).toBeTruthy()
    })
  })

  it('un évènement annulé ne ressuscite pas quand un vieux fichier distant le contient encore', async () => {
    let old!: SyncSnapshot
    await asDevice('dA', async () => {
      await addPack('A1-X', ['A1-1'])
      old = await exportSyncSnapshot()
      await undoLast()
      await mergeIntoLocal(old)
      expect(await db.history.count()).toBe(0)
      expect(await qty('A1-1')).toBe(0)
    })
  })

  it('les extensions livrées ne sont jamais écrasées par la synchro', async () => {
    const remote = await (async () => {
      const s = await exportSyncSnapshot()
      s.tables.sets = [{ id: 'A1', name: 'PIRATE', updatedAt: '2099-01-01T00:00:00.000Z', by: 'dZ' }]
      s.tables.cards = [{ id: 'A1-1', setId: 'A1', name: 'PIRATE', updatedAt: '2099-01-01T00:00:00.000Z', by: 'dZ' }]
      return s
    })()
    await mergeIntoLocal(remote)
    expect((await db.sets.get('A1'))?.name).toBe('A1')
    expect((await db.cards.get('A1-1'))?.name).toBe('A1-1')
  })

  it('une extension ajoutée à la main sur un appareil arrive sur l’autre', async () => {
    let drive!: SyncSnapshot
    await asDevice('dA', async () => {
      await saveNewSet(
        { id: 'U1', name: 'U', nameEn: 'U', releaseDate: '2030-01-01', order: 9 },
        [{ id: 'U1-X', setId: 'U1', name: 'X' }], [card('U1-1', 'U1')], [],
      )
      drive = await exportSyncSnapshot()
    })
    await asDevice('dB', async () => {
      await mergeIntoLocal(drive)
      expect(await db.sets.get('U1')).toBeTruthy()
      expect(await db.cards.get('U1-1')).toBeTruthy()
    })
  })

  it('purge les marques de suppression de plus de 90 jours, garde les récentes', async () => {
    const old = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString()
    const recent = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    await db.tombstones.bulkPut([
      { key: 'owned:old', table: 'owned', id: 'old', updatedAt: old, by: 'dA' },
      { key: 'owned:new', table: 'owned', id: 'new', updatedAt: recent, by: 'dA' },
    ])
    await mergeIntoLocal(null)
    expect(await db.tombstones.get('owned:old')).toBeUndefined()
    expect(await db.tombstones.get('owned:new')).toBeTruthy()
  })

  it('une horloge distante en avance est bornée à maintenant', async () => {
    const remote = await exportSyncSnapshot()
    remote.tables.owned = [{ cardId: 'A1-1', quantity: 9, updatedAt: '2099-01-01T00:00:00.000Z', by: 'dZ' }]
    const { result } = await mergeIntoLocal(remote)
    const row = result.merged.tables.owned.find((r) => r.cardId === 'A1-1')!
    expect(row.quantity).toBe(9)
    expect(Date.parse(row.updatedAt!)).toBeLessThanOrEqual(Date.now() + 1000)
    expect((await db.owned.get('A1-1'))!.updatedAt! < '2090').toBe(true)
  })

  it('isApplyingSync est faux en dehors d’une fusion, même après une erreur', async () => {
    expect(isApplyingSync()).toBe(false)
    await expect(mergeIntoLocal({ tables: null } as never)).rejects.toThrow()
    expect(isApplyingSync()).toBe(false)
  })
})

describe('aller-retour sauvegarde ↔ synchro', () => {
  it('importBackup d’un fichier de synchro fusionne sans rien supprimer', async () => {
    await setOwned('A1-1', 2)
    const remote = await exportSyncSnapshot()
    remote.tables.owned = [{ cardId: 'A1-3', quantity: 1, updatedAt: '2099-01-01T00:00:00.000Z', by: 'dZ' }]
    await importBackup(remote)
    expect(await qty('A1-1')).toBe(2)
    expect(await qty('A1-3')).toBe(1)
    expect((await exportBackup()).owned).toHaveLength(2)
  })
})
