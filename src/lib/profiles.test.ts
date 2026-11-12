import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = new Map<string, string>()
vi.stubGlobal('localStorage', {
  get length() { return m.size },
  key: (i: number) => [...m.keys()][i] ?? null,
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => { m.set(k, String(v)) },
  removeItem: (k: string) => { m.delete(k) },
})

const P = await import('./profiles')
const { PtcgpDB, db } = await import('./db/schema')
const { createProfile, deleteProfile, profileSummary } = await import('./profileOps')
const { findFile, listProfileFiles } = await import('./sync/drive')

beforeEach(async () => {
  m.clear()
  P._reloadActiveForTests()
  for (const name of await Dexie.getDatabaseNames()) if (name !== 'ptcgp') await Dexie.delete(name)
  await db.delete(); await db.open()
})

describe('profils : existant sans registre (aucune migration)', () => {
  it('un seul profil principal, base et clés d’origine', () => {
    expect(P.listProfiles().map((p) => p.id)).toEqual(['main'])
    expect(P.activeProfileId()).toBe('main')
    expect(P.dbNameFor('main')).toBe('ptcgp')
    expect(db.name).toBe('ptcgp')
    expect(P.syncFileNameFor('main')).toBe('ptcgp-sync.json')
    expect(P.profileDeviceKey('ptcgp.sync.enabled')).toBe('ptcgp.sync.enabled')
    expect(P.profilePrefName('welcome.dismissed')).toBe('welcome.dismissed')
  })

  it('les données écrites avant la fonctionnalité restent lisibles par le profil principal', async () => {
    db.close()
    const legacy = new Dexie('ptcgp')
    legacy.version(3).stores({ owned: 'cardId', history: 'id, date, kind', meta: 'key' })
    await legacy.open()
    await legacy.table('owned').put({ cardId: 'A1-1', quantity: 3 })
    await legacy.table('history').put({ id: 'h1', date: '2026-01-01', kind: 'pack', boosterId: 'A1-X', cardIds: ['A1-1'] })
    legacy.close()
    await db.open()
    expect((await db.owned.get('A1-1'))?.quantity).toBe(3)
    expect(await db.history.count()).toBe(1)
    // créer un autre profil ne touche pas la base principale
    await createProfile('Léa', 'pink')
    expect((await db.owned.get('A1-1'))?.quantity).toBe(3)
    expect(await profileSummary('main')).toEqual({ owned: 1 })
  })
})

describe('profils secondaires', () => {
  it('base, clés et fichier Drive propres', async () => {
    const p = await createProfile('  Léa   B ', 'pink')
    expect(p.name).toBe('Léa B')
    expect(P.listProfiles().map((x) => x.name)).toEqual(['Moi', 'Léa B'])
    expect(P.dbNameFor(p.id)).toBe(`ptcgp-p-${p.id}`)
    expect(P.syncFileNameFor(p.id)).toBe(`ptcgp-sync-${p.id}.json`)
    expect(P.profileIdFromFileName(`ptcgp-sync-${p.id}.json`)).toBe(p.id)
    expect(P.profileIdFromFileName('ptcgp-sync.json')).toBeNull()
    expect(P.profileDeviceKey('ptcgp.sync.email', p.id)).toBe(`ptcgp.p.${p.id}.sync.email`)
    expect(P.profilePrefName('pz.massOff', p.id)).toBe(`p.${p.id}.pz.massOff`)
  })

  it('collections isolées', async () => {
    const p = await createProfile('Tom', 'teal')
    const other = new PtcgpDB(P.dbNameFor(p.id))
    await other.owned.bulkPut([{ cardId: 'A1-1', quantity: 1 }, { cardId: 'A1-2', quantity: 0 }] as never)
    other.close()
    expect(await db.owned.count()).toBe(0)
    expect(await profileSummary(p.id)).toEqual({ owned: 1 })
  })

  it('recopie évènements et tier list, pas la collection', async () => {
    await db.importedEvents.put({ id: 'ev1', title: 'x', type: 'event', start: '2026-01-01', end: '2026-01-02' } as never)
    await db.meta.put({ key: 'pm.tierlist', value: 'tl' })
    await db.meta.put({ key: 'pz.stats', value: 'perso' })
    await db.owned.put({ cardId: 'A1-1', quantity: 2 } as never)
    const p = await createProfile('Léa', 'pink')
    const other = new PtcgpDB(P.dbNameFor(p.id))
    expect(await other.importedEvents.count()).toBe(1)
    expect((await other.meta.get('pm.tierlist'))?.value).toBe('tl')
    expect(await other.meta.get('pz.stats')).toBeUndefined()
    expect(await other.owned.count()).toBe(0)
    other.close()
  })

  it('profil actif enregistré, repli sur le principal si inconnu', async () => {
    const p = await createProfile('Léa', 'pink')
    P.setActiveProfile(p.id)
    expect(P.storedActiveId()).toBe(p.id)
    localStorage.setItem('ptcgp.profile.active', 'zzzzzz')
    expect(P.storedActiveId()).toBe('main')
    P.setActiveProfile('main')
    expect(localStorage.getItem('ptcgp.profile.active')).toBeNull()
  })

  it('suppression : base et clés retirées ; principal et profil actif protégés', async () => {
    const p = await createProfile('Léa', 'pink')
    localStorage.setItem(P.profileDeviceKey('ptcgp.sync.enabled', p.id), '1')
    localStorage.setItem('ptcgp:' + P.profilePrefName('welcome.dismissed', p.id), 'true')
    localStorage.setItem('ptcgp.sync.enabled', '1')
    expect(await Dexie.exists(P.dbNameFor(p.id))).toBe(true)
    await deleteProfile(p.id)
    expect(await Dexie.exists(P.dbNameFor(p.id))).toBe(false)
    expect(P.listProfiles().map((x) => x.id)).toEqual(['main'])
    expect([...m.keys()].filter((k) => k.includes(p.id))).toEqual([])
    expect(localStorage.getItem('ptcgp.sync.enabled')).toBe('1')
    await expect(deleteProfile('main')).rejects.toThrow()
  })

  it('id venu de Drive conservé, pas de doublon, plafond', async () => {
    const a = await createProfile('Léa', 'pink', 'abcd1234')
    expect(a.id).toBe('abcd1234')
    expect((await createProfile('Autre', 'blue', 'abcd1234')).name).toBe('Léa')
    for (let i = P.listProfiles().length; i < P.MAX_PROFILES; i++) P.addProfile('x' + i, 'blue')
    expect(() => P.addProfile('trop', 'blue')).toThrow()
  })

  it('icône du jeu : choisie, gardée, retirée ; identifiant invalide ignoré', async () => {
    const a = await createProfile('Léa', 'pink')
    P.updateProfile(a.id, { icon: 'pz-101160' })
    expect(P.listProfiles().find((p) => p.id === a.id)?.icon).toBe('pz-101160')
    P.updateProfile(a.id, { name: 'Léa B.' })
    expect(P.listProfiles().find((p) => p.id === a.id)).toMatchObject({ name: 'Léa B.', icon: 'pz-101160' })
    P.updateProfile(a.id, { icon: '<script>' })
    expect(P.listProfiles().find((p) => p.id === a.id)?.icon).toBeUndefined()
    P.updateProfile('main', { icon: 's-alakazam' }); P.updateProfile('main', { icon: '' })
    expect(P.listProfiles()[0].icon).toBeUndefined()
  })

  it('registre abîmé ignoré', () => {
    localStorage.setItem('ptcgp.profiles', '{pas du json')
    expect(P.listProfiles().map((p) => p.id)).toEqual(['main'])
    localStorage.setItem('ptcgp.profiles', JSON.stringify([{ id: '../x', name: 'a', color: 'pink' }, { id: 'main', name: 'Nico', color: 'blue' }]))
    expect(P.listProfiles()).toMatchObject([{ id: 'main', name: 'Nico' }])
  })
})

describe('Drive : fichiers des profils', () => {
  it('liste les fichiers ptcgp-sync-<id>.json, sans le principal ni doublon', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ files: [
      { id: 'f0', name: 'ptcgp-sync.json' }, { id: 'f1', name: 'ptcgp-sync-abcd1234.json' },
      { id: 'f2', name: 'ptcgp-sync-abcd1234.json' }, { id: 'f3', name: 'ptcgp-sync-x.json' },
    ] })))
    expect(await listProfileFiles('t', f as never)).toEqual([{ id: 'f1', profileId: 'abcd1234' }])
  })

  it('le profil actif cherche son propre fichier de synchro', async () => {
    const urls: string[] = []
    const f = vi.fn(async (u: string) => { urls.push(decodeURIComponent(u)); return new Response(JSON.stringify({ files: [] })) })
    await findFile('t', f as never)
    const p = await createProfile('Léa', 'pink')
    P.setActiveProfile(p.id); P._reloadActiveForTests()
    await findFile('t', f as never)
    P.setActiveProfile('main'); P._reloadActiveForTests()
    expect(urls[0]).toContain("name='ptcgp-sync.json'")
    expect(urls[1]).toContain(`name='ptcgp-sync-${p.id}.json'`)
  })
})
