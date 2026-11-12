import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage, resetDb, useDevice } from '../testUtils'
import type { SyncSnapshot } from './merge'

vi.stubGlobal('localStorage', fakeLocalStorage)
fakeLocalStorage.setItem('ptcgp.sync.enabled', '1') // lu une fois, à l'import du moteur

/** Faux Drive en mémoire : un fichier avec numéro de version, et des pannes programmables. */
const drive = {
  file: null as { id: string; version: number; snap: SyncSnapshot } | null,
  creates: 0, updates: 0, downloads: 0,
  failNext: [] as unknown[],
  conflictNext: 0,
  reset() { this.file = null; this.creates = this.updates = this.downloads = 0; this.failNext = []; this.conflictNext = 0 },
}
const gis = { token: 'tok' as string | null, requests: 0, rejectWith: null as unknown }

vi.mock('./drive', () => {
  class DriveError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s } }
  class ConflictError extends Error {}
  const fail = () => { const e = drive.failNext.shift(); if (e) throw e }
  return {
    DriveError, ConflictError,
    findFile: async () => { fail(); return drive.file ? { id: drive.file.id, version: String(drive.file.version), modifiedTime: '' } : null },
    downloadFile: async () => { drive.downloads++; return structuredClone(drive.file!.snap) },
    updateFile: async (_t: string, _id: string, snap: SyncSnapshot, exp: { version: string }) => {
      if (drive.conflictNext > 0) { drive.conflictNext--; throw new ConflictError('conflit') }
      if (String(drive.file!.version) !== exp.version) throw new ConflictError('conflit')
      drive.updates++; drive.file = { ...drive.file!, version: drive.file!.version + 1, snap: structuredClone(snap) }
    },
    createUniqueFile: async (_t: string, snap: SyncSnapshot) => {
      drive.creates++; drive.file = { id: 'f1', version: 1, snap: structuredClone(snap) }; return true
    },
    getUserEmail: async () => 'nicolas@example.test',
  }
})

vi.mock('./gis', () => {
  class AuthError extends Error {}
  return {
    AuthError,
    isConfigured: () => true,
    currentToken: () => gis.token,
    requestToken: async () => { gis.requests++; if (gis.rejectWith) throw gis.rejectWith; gis.token = 'tok2'; return 'tok2' },
    dropToken: () => { gis.token = null },
    revokeToken: () => { gis.token = null },
  }
})

type Engine = typeof import('./engine')
type Db = typeof import('../db')
let engine: Engine, dbm: Db
let DriveError: new (m: string, s: number) => Error, AuthError: new (m: string) => Error

beforeAll(async () => {
  engine = await import('./engine')
  dbm = await import('../db')
  DriveError = (await import('./drive')).DriveError as never
  AuthError = (await import('./gis')).AuthError as never
})

const card = (id: string) =>
  ({ id, setId: 'A1', number: 1, name: id, nameEn: id, type: 'Plante', stage: 'Base', rarity: 'D1', boosterIds: ['A1-X'] }) as never

beforeEach(async () => {
  drive.reset(); gis.token = 'tok'; gis.rejectWith = null; gis.requests = 0
  useDevice('dA')
  await resetDb()
  await dbm.db.cards.bulkPut([card('A1-1'), card('A1-2')])
  await dbm.db.meta.put({ key: 'shippedSetIds', value: ['A1'] })
  fakeLocalStorage.setItem('ptcgp.sync.enabled', '1')
  engine.disconnect() // état propre
  fakeLocalStorage.setItem('ptcgp.sync.enabled', '1')
})

/** Remet le moteur en « activé » (disconnect() le coupe). */
async function enable() {
  gis.token = 'tok'
  await engine.connect() // fait la première synchro
}

describe('summarize', () => {
  it('ne dit rien quand rien n’a changé, accorde au pluriel sinon', () => {
    expect(engine.summarize({ owned: 0, history: 0, other: 0, total: 0, toUpload: false, rebased: 0 })).toBeNull()
    expect(engine.summarize({ owned: 1, history: 1, other: 0, total: 2, toUpload: false, rebased: 0 })).toBe('Synchronisé : 1 carte mise à jour, 1 évènement')
    expect(engine.summarize({ owned: 3, history: 2, other: 4, total: 9, toUpload: false, rebased: 0 })).toBe('Synchronisé : 3 cartes mises à jour, 2 évènements, 4 autres éléments')
    expect(engine.summarize({ owned: 2, history: 1, other: 0, total: 3, toUpload: true, rebased: 2 })).toBe('Synchronisé : 2 cartes mises à jour, 2 quantités recalculées sans perte, 1 évènement')
  })
})

describe('moteur de synchro', () => {
  it('première synchro sans fichier : crée le fichier Drive avec les données locales', async () => {
    await dbm.setOwned('A1-1', 2)
    await enable()
    expect(engine.getSyncState()).toMatchObject({ enabled: true, phase: 'idle', email: 'nicolas@example.test', error: null })
    expect(engine.getSyncState().lastSyncAt).toBeTruthy()
    expect(drive.creates).toBe(1)
    expect(drive.file!.snap.tables.owned[0]).toMatchObject({ cardId: 'A1-1', quantity: 2 })
  })

  it('synchro suivante : télécharge, fusionne en local, renvoie une version fusionnée', async () => {
    await dbm.setOwned('A1-1', 2)
    await enable()
    // Un autre appareil a ajouté une carte dans le fichier.
    drive.file!.snap.tables.owned.push({ cardId: 'A1-2', quantity: 3, updatedAt: new Date().toISOString(), by: 'dB' })
    const summaries: string[] = []
    const off = engine.onSyncSummary((m) => summaries.push(m))
    await engine.syncNow()
    off()
    expect((await dbm.db.owned.get('A1-2'))?.quantity).toBe(3)
    expect(summaries).toEqual(['Synchronisé : 1 carte mise à jour'])
    expect(engine.getSyncState().phase).toBe('idle')
  })

  it('rien à envoyer : pas de mise à jour du fichier', async () => {
    await dbm.setOwned('A1-1', 2)
    await enable()
    const before = drive.updates
    await engine.syncNow()
    expect(drive.updates).toBe(before)
  })

  it('une modification locale est téléversée', async () => {
    await enable()
    await dbm.setOwned('A1-1', 4)
    await engine.syncNow()
    expect(drive.updates).toBe(1)
    expect(drive.file!.snap.tables.owned.find((r) => r.cardId === 'A1-1')).toMatchObject({ quantity: 4 })
  })

  it('un conflit de version relance la fusion jusqu’à réussir', async () => {
    await enable()
    await dbm.setOwned('A1-1', 4)
    drive.conflictNext = 2
    await engine.syncNow()
    expect(engine.getSyncState().phase).toBe('idle')
    expect(drive.updates).toBe(1)
  })

  it('conflits répétés : erreur claire après 4 essais, état « error »', async () => {
    await enable()
    await dbm.setOwned('A1-1', 4)
    drive.conflictNext = 99
    await engine.syncNow()
    expect(engine.getSyncState().phase).toBe('error')
    expect(engine.getSyncState().error).toMatch(/Conflits répétés/)
  })

  it('401 : le jeton est redemandé une fois puis la synchro réussit', async () => {
    await enable()
    gis.requests = 0
    drive.failNext.push(new DriveError('non autorisé', 401))
    await engine.syncNow()
    expect(gis.requests).toBe(1)
    expect(engine.getSyncState().phase).toBe('idle')
  })

  it('jeton refusé : état « reauth »', async () => {
    await enable()
    gis.token = null
    gis.rejectWith = new AuthError('Reconnecte-toi')
    await engine.syncNow()
    expect(engine.getSyncState()).toMatchObject({ phase: 'reauth', error: 'Reconnecte-toi' })
  })

  it('erreur réseau (TypeError) : état « offline » sans message d’erreur', async () => {
    await enable()
    drive.failNext.push(new TypeError('Failed to fetch'))
    await engine.syncNow()
    expect(engine.getSyncState()).toMatchObject({ phase: 'offline', error: null })
  })

  it('autre erreur Drive : état « error » avec le message', async () => {
    await enable()
    drive.failNext.push(new DriveError('Quota dépassé', 403))
    await engine.syncNow()
    expect(engine.getSyncState()).toMatchObject({ phase: 'error', error: 'Quota dépassé' })
  })

  it('des appels simultanés sont regroupés : une seule exécution, puis une de rattrapage', async () => {
    await enable()
    const dl = drive.downloads
    const p1 = engine.syncNow(), p2 = engine.syncNow(), p3 = engine.syncNow()
    expect(p2).toBe(p1); expect(p3).toBe(p1)
    await p1
    await new Promise((r) => setTimeout(r, 20))
    expect(drive.downloads - dl).toBeLessThanOrEqual(2)
    expect(drive.downloads - dl).toBeGreaterThanOrEqual(1)
  })

  it('désactivée : ne fait rien', async () => {
    await enable()
    engine.disconnect()
    const before = drive.downloads
    await engine.syncNow()
    expect(drive.downloads).toBe(before)
    expect(engine.getSyncState()).toMatchObject({ enabled: false, phase: 'disconnected', email: null, lastSyncAt: null })
  })

  it('deux appareils convergent : chacun récupère les cartes de l’autre', async () => {
    useDevice('dA')
    await dbm.setOwned('A1-1', 2)
    await enable()
    // Appareil B : base vide, se connecte au même fichier.
    useDevice('dB')
    await resetDb(); await dbm.db.cards.bulkPut([card('A1-1'), card('A1-2')])
    await dbm.db.meta.put({ key: 'shippedSetIds', value: ['A1'] })
    await dbm.setOwned('A1-2', 1)
    await engine.syncNow()
    expect((await dbm.db.owned.get('A1-1'))?.quantity).toBe(2)
    expect(drive.file!.snap.tables.owned.map((r) => r.cardId).sort()).toEqual(['A1-1', 'A1-2'])
  })
  it('les instantanés Pokémon-Zone passent d’un appareil à l’autre, le plus récent fetchedAt gagne', async () => {
    useDevice('dA')
    await dbm.db.meta.put({ key: 'pz.stats', value: { fetchedAt: '2026-11-10T10:00:00.000Z', data: { v: 'A' } } })
    await dbm.db.meta.put({ key: 'pz.home', value: { fetchedAt: '2026-11-12T10:00:00.000Z', data: { v: 'A-home' } } })
    await enable()
    expect(drive.file!.snap.tables.pz.map((r) => r.id).sort()).toEqual(['home', 'stats'])
    // Appareil B : stats plus récent, pas de home.
    useDevice('dB')
    await resetDb(); await dbm.db.cards.bulkPut([card('A1-1'), card('A1-2')])
    await dbm.db.meta.put({ key: 'shippedSetIds', value: ['A1'] })
    await dbm.db.meta.put({ key: 'pz.stats', value: { fetchedAt: '2026-11-11T10:00:00.000Z', data: { v: 'B' } } })
    await engine.syncNow()
    expect((await dbm.db.meta.get('pz.home'))?.value).toEqual({ fetchedAt: '2026-11-12T10:00:00.000Z', data: { v: 'A-home' } })
    expect((await dbm.db.meta.get('pz.stats'))?.value).toEqual({ fetchedAt: '2026-11-11T10:00:00.000Z', data: { v: 'B' } })
    // Retour sur A : récupère le stats plus récent de B.
    useDevice('dA')
    await engine.syncNow()
    expect((await dbm.db.meta.get('pz.stats'))?.value).toEqual({ fetchedAt: '2026-11-11T10:00:00.000Z', data: { v: 'B' } })
  })
})
