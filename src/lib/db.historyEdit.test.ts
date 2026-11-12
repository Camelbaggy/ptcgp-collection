import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPack, applyCorrections, db, rewriteEvent, share, undoLast, UndoError } from './db'
import { mergeIntoLocal } from './sync/snapshot'
import type { SyncSnapshot } from './sync/merge'
import { checkOwnedConsistency } from './sync/rebase'
import type { HistoryEvent } from './types'
import { onReveal } from './reveal'
import { fakeLocalStorage, resetDb, useDevice as switchDevice } from './testUtils'

vi.stubGlobal('localStorage', fakeLocalStorage)

const card = (id: string) => ({ id, setId: 'A1', number: 1, name: id, nameEn: id, type: 'Plante', stage: 'Base', rarity: 'D1', boosterIds: ['A1-X'] }) as never
const qty = async (id: string) => (await db.owned.get(id))?.quantity ?? 0
const withCards = (e: HistoryEvent, cardIds: string[]) => ({ ...e, cardIds }) as HistoryEvent
const live = async () => (await db.history.toArray()).filter((e) => !e.deleted)

async function seedRef() {
  await db.sets.put({ id: 'A1', name: 'A1', nameEn: 'A1', releaseDate: '2024-10-30', order: 1 })
  await db.boosters.put({ id: 'A1-X', setId: 'A1', name: 'X' })
  await db.cards.bulkPut([card('A1-1'), card('A1-2'), card('A1-3')])
  await db.meta.put({ key: 'shippedSetIds', value: ['A1'] })
}
async function asDevice(id: string, body: () => Promise<void>) {
  switchDevice(id); await resetDb(); await seedRef(); await body()
}

beforeEach(async () => {
  fakeLocalStorage.clear(); switchDevice('dA')
  await resetDb(); await seedRef()
})

describe('rewriteEvent', () => {
  it('supprime un ancien pack (pas le dernier) et recalcule les quantités', async () => {
    const p1 = await addPack('A1-X', ['A1-1', 'A1-2'])
    await addPack('A1-X', ['A1-1'])
    await rewriteEvent(p1.id, null)
    expect(await qty('A1-1')).toBe(1)
    expect(await qty('A1-2')).toBe(0)
    expect((await live()).map((e) => e.id)).not.toContain(p1.id)
    expect(await db.tombstones.get(`history:${p1.id}`)).toBeTruthy()
    expect(await db.tombstones.get('owned:A1-2')).toBeTruthy()
  })

  it('modifie les cartes d’un pack : nouvel id, même date, quantités ajustées, ancienne ligne marquée supprimée', async () => {
    const p1 = await addPack('A1-X', ['A1-1', 'A1-2'])
    await addPack('A1-X', ['A1-2'])
    const fresh: string[] = []
    const off = onReveal((ids) => fresh.push(...ids))
    const { added, removed } = await rewriteEvent(p1.id, withCards(p1, ['A1-1', 'A1-3']))
    off()
    expect(removed?.id).toBe(p1.id)
    expect(added?.id).not.toBe(p1.id)
    expect(added?.date).toBe(p1.date)
    expect([await qty('A1-1'), await qty('A1-2'), await qty('A1-3')]).toEqual([1, 1, 1])
    expect(fresh).toEqual(['A1-3'])
    expect(await db.tombstones.get(`history:${p1.id}`)).toBeTruthy()
    // « Annuler » la modification : on revient exactement à l'état d'avant
    await rewriteEvent(added!.id, removed)
    expect([await qty('A1-1'), await qty('A1-2'), await qty('A1-3')]).toEqual([1, 2, 0])
  })

  it('« Annuler » une suppression réinsère l’évènement à sa date', async () => {
    const p1 = await addPack('A1-X', ['A1-1'])
    await addPack('A1-X', ['A1-2'])
    const { removed } = await rewriteEvent(p1.id, null)
    const back = await rewriteEvent(null, removed)
    expect(back.added?.date).toBe(p1.date)
    expect(await qty('A1-1')).toBe(1)
  })

  it('une mise à jour plus récente qui fixe la carte n’est pas défaite', async () => {
    const p1 = await addPack('A1-X', ['A1-1', 'A1-2'])
    await applyCorrections([{ cardId: 'A1-1', to: 5 }])
    await rewriteEvent(p1.id, null)
    expect(await qty('A1-1')).toBe(5)
    expect(await qty('A1-2')).toBe(0)
    expect(checkOwnedConsistency(await db.owned.toArray(), await live() as never)).toEqual([])
  })

  it('modifier une mise à jour change la valeur fixée et reste cohérent avec la vérification des quantités', async () => {
    await addPack('A1-X', ['A1-1'])
    const c = (await applyCorrections([{ cardId: 'A1-1', to: 4 }]))!
    await addPack('A1-X', ['A1-1'])
    expect(await qty('A1-1')).toBe(5)
    if (c.kind !== 'correction') throw new Error()
    await rewriteEvent(c.id, { ...c, changes: [{ ...c.changes[0], to: 2 }] })
    expect(await qty('A1-1')).toBe(3)
    expect(checkOwnedConsistency(await db.owned.toArray(), await live() as never)).toEqual([])
  })

  it('modifie un partage (carte et sens) et un évènement d’un autre appareil', async () => {
    await addPack('A1-X', ['A1-1', 'A1-1', 'A1-2'])
    const s = await share('A1-1', 'given', 'Léa')
    switchDevice('dB')
    await rewriteEvent(s.id, { ...s, cardId: 'A1-2', direction: 'received' } as HistoryEvent)
    expect([await qty('A1-1'), await qty('A1-2')]).toEqual([2, 2])
  })

  it('refuse un brouillon invalide ou un évènement disparu, sans rien écrire', async () => {
    const p = await addPack('A1-X', ['A1-1'])
    await expect(rewriteEvent(p.id, withCards(p, []))).rejects.toBeInstanceOf(UndoError)
    await expect(rewriteEvent('nope', null)).rejects.toBeInstanceOf(UndoError)
    expect(await qty('A1-1')).toBe(1)
    expect(await live()).toHaveLength(1)
  })

  it('« Annuler le dernier » annule le pack modifié (même appareil)', async () => {
    const p1 = await addPack('A1-X', ['A1-1'])
    await rewriteEvent(p1.id, withCards(p1, ['A1-2']))
    await undoLast()
    expect([await qty('A1-1'), await qty('A1-2')]).toEqual([0, 0])
  })
})

describe('rewriteEvent et synchro Drive', () => {
  it('une suppression faite sur A pendant que B ajoute un pack hors ligne : les deux comptent après synchro', async () => {
    const p1 = await addPack('A1-X', ['A1-1', 'A1-1'])
    let drive: SyncSnapshot = (await mergeIntoLocal(null)).result.merged
    let fromB: SyncSnapshot | null = null
    await asDevice('dB', async () => {
      await mergeIntoLocal(drive)
      await addPack('A1-X', ['A1-1'])                     // B : A1-1 = 3
      fromB = (await mergeIntoLocal(drive)).result.merged
    })
    await asDevice('dA', async () => {
      await mergeIntoLocal(drive)
      await rewriteEvent(p1.id, withCards(p1, ['A1-1'])) // A : le pack n'avait qu'un A1-1 → 1
      const { result } = await mergeIntoLocal(fromB)
      expect(await qty('A1-1')).toBe(2)
      drive = result.merged
    })
    await asDevice('dB', async () => {
      await mergeIntoLocal(fromB)
      await mergeIntoLocal(drive)
      expect(await qty('A1-1')).toBe(2)
      expect(await live()).toHaveLength(2)
    })
  })
})
