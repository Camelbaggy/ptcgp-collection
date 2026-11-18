import { describe, expect, it } from 'vitest'
import type { Card, Rarity } from '../types'
import {
  FriendCodeError, decodeFriendCode, encodeFriendCode, extractFriendCode, matchFriend, missingTradable,
  myFriendCode, packIds, parseFriendCodeText, unpackIds,
} from './friendTrades'

const card = (setId: string, number: number, rarity: Rarity, finish?: string): Card =>
  ({ id: `${setId}-${number}`, setId, number, name: `${setId}-${number}`, nameEn: '', type: 'Grass', rarity, boosterIds: [], finish } as Card)

describe('code d’échange', () => {
  it('compacte les ids en plages et les relit', () => {
    const ids = ['A1-1', 'A1-2', 'A1-3', 'A1-4', 'A1-7', 'A1-9', 'A1-10', 'P-A-5', 'SP1--1', 'SP1--2', 'B4b-120', 'A1-2']
    const packed = packIds(ids)
    expect(packed).toBe('A1:1~4.7.9.10;B4b:120;P-A:5;SP1:-2.-1')
    expect(unpackIds(packed).sort()).toEqual([...new Set(ids)].sort())
  })

  it('refuse un texte mal formé', () => {
    expect(() => unpackIds('A1:1~x')).toThrow(FriendCodeError)
    expect(() => unpackIds('A1:5~2')).toThrow(FriendCodeError)
    expect(() => parseFriendCodeText('H9|a|2026-11-12||')).toThrow(FriendCodeError)
  })

  it('aller-retour compressé, depuis un code brut ou un lien', async () => {
    const c = { name: 'Julie | test', date: '2026-11-12', offers: ['A1-1', 'A2-5'], missing: Array.from({ length: 300 }, (_, i) => `B1-${i + 1}`) }
    const code = await encodeFriendCode(c)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(code.length).toBeLessThan(80)
    const link = `https://camelbaggy.github.io/ptcgp-collection/#/echange-partage?onglet=ami&code=${code}`
    expect(extractFriendCode(link)).toBe(code)
    const back = await decodeFriendCode(link)
    expect(back.name).toBe('Julie   test')
    expect(back.offers).toEqual(['A1-1', 'A2-5'])
    expect(back.missing).toHaveLength(300)
  })

  it('refuse un code abîmé', async () => {
    await expect(decodeFriendCode('')).rejects.toThrow(FriendCodeError)
    await expect(decodeFriendCode('abc$')).rejects.toThrow(FriendCodeError)
    await expect(decodeFriendCode('AAAAAAAA')).rejects.toThrow(FriendCodeError)
  })
})

describe('échanges possibles', () => {
  const cards = [
    card('A1', 1, 'D1'), card('A1', 2, 'D1'), card('A1', 3, 'D1'),
    card('A1', 4, 'D4'), card('A1', 5, 'D4'), card('A1', 6, 'D4'),
    card('A1', 7, 'E1'), card('A1', 8, 'E1'),
    card('A1', 9, 'E3'), card('A1', 10, 'C1'),
  ]

  it('mon code : doubles selon mes règles, manquantes échangeables seulement', () => {
    const owned = new Map([['A1-1', 3], ['A1-4', 2], ['A1-7', 2], ['A1-9', 4]])
    const c = myFriendCode(cards, owned, 'Nico', '2026-11-12')
    expect(c.offers.sort()).toEqual(['A1-1', 'A1-7'])
    expect(c.missing).toEqual(['A1-2', 'A1-3', 'A1-5', 'A1-6', 'A1-8'])
    expect(missingTradable(cards, owned).some((x) => x.rarity === 'E3' || x.rarity === 'C1')).toBe(false)
  })

  it('apparie à rareté égale, de la plus rare à la plus commune', () => {
    // Moi : A1-1 ×3 (double D1), A1-4 ×3 (double D4), A1-7 ×2 (double E1) ; il me manque A1-2, A1-5, A1-8.
    const owned = new Map([['A1-1', 3], ['A1-3', 1], ['A1-4', 3], ['A1-6', 1], ['A1-7', 2]])
    const friend = {
      name: 'Julie', date: '2026-11-10',
      offers: ['A1-2', 'A1-5', 'A1-6', 'A1-8', 'A1-9', 'Z9-1'],
      missing: ['A1-1', 'A1-4', 'A1-3'],
    }
    const m = matchFriend(cards, owned, friend)
    expect(m.map((x) => [x.rarity, x.receive.map((c) => c.id), x.give.map((c) => c.id), x.count])).toEqual([
      ['E1', ['A1-8'], [], 0],
      ['D4', ['A1-5'], ['A1-4'], 1],
      ['D1', ['A1-2'], ['A1-1'], 1],
    ])
  })
})
