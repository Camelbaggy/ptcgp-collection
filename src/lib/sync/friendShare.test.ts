import { describe, expect, it } from 'vitest'
import { fetchPublishedCode, FriendShareError, isPublishedCode, publishCode, unpublishCode, type PublishedCode } from './friendShare'

const content: PublishedCode = { app: 'holotheque', v: 1, name: 'Julie', date: '2026-11-12', code: 'abc_DEF-123' }
type Call = { url: string; method: string; body?: string }

function fakeFetch(handler: (c: Call) => Response) {
  const calls: Call[] = []
  const f = (async (url: string, init?: RequestInit) => {
    const c = { url, method: init?.method ?? 'GET', body: init?.body as string | undefined }
    calls.push(c)
    return handler(c)
  }) as unknown as typeof fetch
  return { f, calls }
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

describe('fichier public du code d’échange', () => {
  it('crée le fichier puis le rend lisible par lien', async () => {
    const { f, calls } = fakeFetch((c) => c.url.includes('/permissions') ? json({ id: 'anyone' }) : json({ id: 'FILE_ID_123456' }))
    expect(await publishCode('tok', content, null, f)).toBe('FILE_ID_123456')
    expect(calls.map((c) => c.method)).toEqual(['POST', 'POST'])
    expect(calls[0]!.url).toContain('uploadType=multipart')
    expect(calls[0]!.body).toContain('"code":"abc_DEF-123"')
    expect(JSON.parse(calls[1]!.body!)).toMatchObject({ role: 'reader', type: 'anyone' })
  })

  it('met à jour le fichier existant', async () => {
    const { f, calls } = fakeFetch(() => json({ id: 'FILE_ID_123456', trashed: false }))
    expect(await publishCode('tok', content, 'FILE_ID_123456', f)).toBe('FILE_ID_123456')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('PATCH')
  })

  it('recrée le fichier s’il a été supprimé ou mis à la corbeille', async () => {
    const gone = fakeFetch((c) => c.method === 'PATCH' ? new Response('', { status: 404 }) : json({ id: 'NEW_FILE_ID_99' }))
    expect(await publishCode('tok', content, 'OLD_FILE_ID_1', gone.f)).toBe('NEW_FILE_ID_99')
    const trashed = fakeFetch((c) => c.method === 'PATCH' ? json({ id: 'OLD_FILE_ID_1', trashed: true }) : json({ id: 'NEW_FILE_ID_99' }))
    expect(await publishCode('tok', content, 'OLD_FILE_ID_1', trashed.f)).toBe('NEW_FILE_ID_99')
  })

  it('remonte une autre erreur Drive', async () => {
    const { f } = fakeFetch(() => new Response('quota', { status: 500 }))
    await expect(publishCode('tok', content, 'FILE_ID_123456', f)).rejects.toThrow(FriendShareError)
  })

  it('supprime sans erreur un fichier déjà absent', async () => {
    const { f } = fakeFetch(() => new Response('', { status: 404 }))
    await expect(unpublishCode('tok', 'FILE_ID_123456', f)).resolves.toBeUndefined()
  })

  it('lit le code d’un ami avec la clé API et valide le contenu', async () => {
    const ok = fakeFetch(() => json(content))
    expect(await fetchPublishedCode('FILE_ID_123456', ok.f, 'KEY')).toEqual(content)
    expect(ok.calls[0]!.url).toContain('alt=media&key=KEY')
    await expect(fetchPublishedCode('FILE_ID_123456', fakeFetch(() => json({ ...content, code: 'a b' })).f, 'KEY')).rejects.toThrow('illisible')
    await expect(fetchPublishedCode('FILE_ID_123456', fakeFetch(() => new Response('', { status: 404 })).f, 'KEY')).rejects.toThrow('désactivé')
    await expect(fetchPublishedCode('FILE_ID_123456', ok.f, '')).rejects.toThrow('pas encore configurée')
    await expect(fetchPublishedCode('../x', ok.f, 'KEY')).rejects.toThrow('invalide')
  })

  it('reconnaît un contenu publié', () => {
    expect(isPublishedCode(content)).toBe(true)
    expect(isPublishedCode({ ...content, app: 'autre' })).toBe(false)
    expect(isPublishedCode({ ...content, date: 'hier' })).toBe(false)
  })
})
