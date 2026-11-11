import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, seedIfNeeded } from './db'

const files: Record<string, unknown> = {
  sets: [{ id: 'A1', name: 'A1', nameEn: 'A1', releaseDate: '2024-10-30', order: 1 }],
  boosters: [{ id: 'A1-X', setId: 'A1', name: 'X' }],
  cards: [{ id: 'A1-1', setId: 'A1', number: 1, name: 'a', nameEn: 'a', type: 'Plante', stage: 'Base', rarity: 'D1', boosterIds: ['A1-X'] }],
  rates: [],
  version: { version: 'v1' },
}
let requested: string[] = []
let failing = new Set<string>()

function stubFetch() {
  vi.stubGlobal('fetch', async (url: string) => {
    const name = /data\/(\w+)\.json/.exec(url)![1]
    requested.push(name)
    if (failing.has(name) || !(name in files)) return new Response('', { status: 404 })
    return new Response(JSON.stringify(files[name]), { status: 200 })
  })
}

describe('seedIfNeeded', () => {
  beforeEach(async () => {
    requested = []; failing = new Set()
    await db.delete(); await db.open()
    stubFetch()
    vi.stubEnv('DEV', false)
    await db.owned.put({ cardId: 'A1-1', quantity: 2 } as never)
    await db.wishlist.put({ cardId: 'A1-1', priority: 1 } as never)
    await db.history.put({ id: 'h', kind: 'pack', date: '', boosterId: 'A1-X', cardIds: ['A1-1'] } as never)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('charge puis ne relit plus les fichiers si la version est identique', async () => {
    await seedIfNeeded()
    expect(await db.cards.count()).toBe(1)
    requested = []
    await seedIfNeeded()
    expect(requested).toEqual(['version'])
  })

  it('un fichier en échec laisse les données en place', async () => {
    await seedIfNeeded()
    files.version = { version: 'v2' }
    failing.add('cards')
    await seedIfNeeded()
    expect(await db.cards.count()).toBe(1)
    expect((await db.meta.get('dataVersion'))?.value).toBe('v1')
    files.version = { version: 'v1' }
  })

  it('première installation sans réseau : erreur, pas de fixtures', async () => {
    failing.add('cards')
    await expect(seedIfNeeded()).rejects.toThrow()
    expect(await db.cards.count()).toBe(0)
  })
})
