import { describe, expect, it, vi } from 'vitest'
import { ConflictError, DriveError, createFile, createUniqueFile, downloadFile, findFile, getUserEmail, updateFile } from './drive'
import { emptySnapshot } from './merge'

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
const meta = { id: 'f1', version: '3', modifiedTime: 't' }

describe('drive client', () => {
  it('findFile keeps the oldest file when duplicates exist', async () => {
    const files = [{ id: 'b', version: '1', modifiedTime: 't', createdTime: '2025-02' }, { id: 'a', version: '1', modifiedTime: 't', createdTime: '2025-01' }]
    expect((await findFile('t', vi.fn().mockResolvedValue(json({ files }))))?.id).toBe('a')
  })
  it('createUniqueFile deletes our file when an older one exists', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ id: 'mine', version: '1', modifiedTime: 't' }))
      .mockResolvedValueOnce(json({ files: [{ id: 'theirs', version: '1', modifiedTime: 't', createdTime: '2025-01' }, { id: 'mine', version: '1', modifiedTime: 't', createdTime: '2025-02' }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await createUniqueFile('t', emptySnapshot('A'), f)).toBe(false)
    expect(f.mock.calls[2][0]).toContain('/files/mine')
    expect(f.mock.calls[2][1].method).toBe('DELETE')
  })
  it('createUniqueFile keeps ours when it is the oldest', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ id: 'mine', version: '1', modifiedTime: 't' }))
      .mockResolvedValueOnce(json({ files: [{ id: 'mine', version: '1', modifiedTime: 't', createdTime: '2025-01' }] }))
    expect(await createUniqueFile('t', emptySnapshot('A'), f)).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('findFile queries appDataFolder with bearer token', async () => {
    const f = vi.fn().mockResolvedValue(json({ files: [meta] }))
    expect(await findFile('tok', f)).toEqual(meta)
    const [url, init] = f.mock.calls[0]
    expect(url).toContain('spaces=appDataFolder')
    expect(url).toContain(encodeURIComponent("name='ptcgp-sync.json'"))
    expect(init.headers.Authorization).toBe('Bearer tok')
  })
  it('findFile returns null when absent', async () => {
    expect(await findFile('t', vi.fn().mockResolvedValue(json({ files: [] })))).toBeNull()
  })
  it('createFile sends multipart with parent appDataFolder', async () => {
    const f = vi.fn().mockResolvedValue(json(meta))
    await createFile('t', emptySnapshot('A'), f)
    const [url, init] = f.mock.calls[0]
    expect(url).toContain('uploadType=multipart')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/)
    expect(init.body).toContain('"parents":["appDataFolder"]')
    expect(init.body).toContain('"app":"ptcgp-sync"')
  })
  it('updateFile uploads when version unchanged', async () => {
    const f = vi.fn().mockResolvedValueOnce(json(meta)).mockResolvedValueOnce(json({ ...meta, version: '4' }))
    const r = await updateFile('t', 'f1', emptySnapshot('A'), meta, f)
    expect(r.version).toBe('4')
    expect(f.mock.calls[1][1].method).toBe('PATCH')
    expect(f.mock.calls[1][0]).toContain('uploadType=media')
  })
  it('updateFile throws ConflictError and does not upload when version moved', async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ ...meta, version: '9' }))
    await expect(updateFile('t', 'f1', emptySnapshot('A'), meta, f)).rejects.toBeInstanceOf(ConflictError)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('downloadFile validates content and surfaces HTTP errors', async () => {
    expect((await downloadFile('t', 'f1', vi.fn().mockResolvedValue(json(emptySnapshot('A'))))).app).toBe('ptcgp-sync')
    await expect(downloadFile('t', 'f1', vi.fn().mockResolvedValue(json({ x: 1 })))).rejects.toThrow('invalide')
    await expect(findFile('t', vi.fn().mockResolvedValue(json({}, 401)))).rejects.toMatchObject({ status: 401 })
    await expect(findFile('t', vi.fn().mockResolvedValue(json({}, 500)))).rejects.toBeInstanceOf(DriveError)
  })
  it('getUserEmail is best effort', async () => {
    expect(await getUserEmail('t', vi.fn().mockResolvedValue(json({ user: { emailAddress: 'a@b.c' } })))).toBe('a@b.c')
    expect(await getUserEmail('t', vi.fn().mockResolvedValue(json({}, 403)))).toBeNull()
    expect(await getUserEmail('t', vi.fn().mockRejectedValue(new Error('x')))).toBeNull()
  })
})
