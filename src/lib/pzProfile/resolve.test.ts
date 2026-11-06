import { describe, expect, it } from 'vitest'
import type { Card } from '../types'
import { resolvePzImage } from './resolve'

const card = (id: string, rarity: Card['rarity'], entityId: number, entityKind: 'PK' | 'TR' = 'PK'): Card => {
  const i = id.lastIndexOf('-')
  return { id, setId: id.slice(0, i), number: Number(id.slice(i + 1)), name: id, nameEn: id, type: '', stage: '', rarity, boosterIds: [], entityId, entityKind } as unknown as Card
}

describe('resolvePzImage', () => {
  const cards = [card('C1-160', 'E2', 22620), card('C1-178', 'E2', 22620), card('C1-130', 'D4', 22620), card('P-B-9', 'P', 22620), card('A4b-373', 'E2', 40, 'TR')]
  it('distingue SR et SAR (même rareté chez nous)', () => {
    expect(resolvePzImage('cPK_20_022620_01_MEGABANGIRASex_SAR.webp', cards)?.id).toBe('C1-178')
    expect(resolvePzImage('cPK_20_022620_00_MEGABANGIRASex_SR', cards)?.id).toBe('C1-160')
  })
  it('lit les noms avec empreinte, les dresseurs, et refuse l\'inconnu', () => {
    expect(resolvePzImage('https://x/CardRenders3D/cPK_20_022620_00_MEGABANGIRASex_RR.a9798338.webp', cards)?.id).toBe('C1-130')
    expect(resolvePzImage('cTR_20_000040_00_HAKASENOKENKYU_SR.eb2d7d89.webp', cards)?.id).toBe('A4b-373')
    expect(resolvePzImage('cPK_20_099999_00_X_C.webp', cards)).toBeNull()
    expect(resolvePzImage('pas une carte', cards)).toBeNull()
  })
})
