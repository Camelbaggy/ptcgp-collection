import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../lib/testUtils'

vi.stubGlobal('localStorage', fakeLocalStorage)
const { loadFriends, rememberFriend, updateFriend, forgetFriend } = await import('./friendStore')

describe('amis enregistrés', () => {
  beforeEach(() => fakeLocalStorage.clear())

  it('garde le fichier Drive quand on rouvre un ancien code du même ami', () => {
    rememberFriend({ name: 'Julie', date: '2026-11-10', code: 'AAA', fileId: 'FILE_ID_123456', checkedAt: 5 })
    const list = rememberFriend({ name: 'Julie', date: '2026-11-12', code: 'BBB' })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ code: 'BBB', fileId: 'FILE_ID_123456', checkedAt: 5 })
  })

  it('met à jour un ami suivi sans changer l’ordre, puis l’oublie', () => {
    rememberFriend({ name: 'Max', date: '2026-11-01', code: 'MMM', fileId: 'FILE_ID_MAX_01' })
    rememberFriend({ name: 'Julie', date: '2026-11-10', code: 'JJJ' })
    updateFriend('FILE_ID_MAX_01', { code: 'MM2', date: '2026-11-12', checkedAt: 9 })
    expect(loadFriends().map((f) => [f.name, f.code])).toEqual([['Julie', 'JJJ'], ['Max', 'MM2']])
    forgetFriend('MM2')
    expect(loadFriends().map((f) => f.name)).toEqual(['Julie'])
  })
})
