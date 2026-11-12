import { describe, expect, it } from 'vitest'
import { editImpact, replaceDeltas, sameEvent, validateEvent } from './historyEdit'
import type { HistoryEvent } from './types'

const pack = (id: string, date: string, ...cardIds: string[]): HistoryEvent => ({ id, kind: 'pack', date, boosterId: 'A1-X', cardIds })
const corr = (id: string, date: string, changes: Record<string, [number, number]>): HistoryEvent =>
  ({ id, kind: 'correction', date, changes: Object.entries(changes).map(([cardId, [from, to]]) => ({ cardId, from, to })) })
const owned = (o: Record<string, number>) => new Map(Object.entries(o))

describe('replaceDeltas', () => {
  it('nouveau moins ancien, sans les cartes inchangées', () => {
    const d = replaceDeltas(pack('p', '2025-11-01', 'a', 'b', 'b'), pack('q', '2025-11-01', 'a', 'c'))
    expect(Object.fromEntries(d)).toEqual({ b: -2, c: 1 })
  })
  it('suppression = inverse ; ajout = deltas du nouvel évènement', () => {
    expect(Object.fromEntries(replaceDeltas(pack('p', 'd', 'a'), null))).toEqual({ a: -1 })
    expect(Object.fromEntries(replaceDeltas(null, { id: 's', kind: 'share', date: 'd', cardId: 'a', direction: 'given' }))).toEqual({ a: -1 })
  })
})

describe('editImpact', () => {
  it('supprimer un pack retire ses cartes des quantités actuelles', () => {
    const p = pack('p', '2025-11-01', 'a', 'b')
    expect(editImpact(p, null, [p], owned({ a: 3, b: 1 }))).toEqual([
      { cardId: 'a', before: 3, after: 2, delta: -1, absorbed: false, clamped: false },
      { cardId: 'b', before: 1, after: 0, delta: -1, absorbed: false, clamped: false },
    ])
  })
  it('une mise à jour plus récente qui fixe la carte absorbe la modification', () => {
    const p = pack('p', '2025-11-01', 'a', 'b')
    const c = corr('c', '2025-11-05', { a: [1, 4] })
    const lines = editImpact(p, null, [p, c], owned({ a: 4, b: 2 }))
    expect(lines.find((l) => l.cardId === 'a')).toMatchObject({ before: 4, after: 4, absorbed: true })
    expect(lines.find((l) => l.cardId === 'b')).toMatchObject({ before: 2, after: 1, absorbed: false })
  })
  it('une mise à jour plus ancienne n’absorbe rien', () => {
    const c = corr('c', '2025-10-30', { a: [1, 4] })
    const p = pack('p', '2025-11-01', 'a')
    expect(editImpact(p, null, [c, p], owned({ a: 5 }))[0]).toMatchObject({ after: 4, absorbed: false })
  })
  it('modifier une mise à jour : seule la différence de valeur cible compte', () => {
    const c = corr('c', '2025-11-01', { a: [1, 4], b: [0, 2] })
    const d = corr('c', '2025-11-01', { a: [1, 3], b: [0, 2] })
    expect(editImpact(c, d, [c], owned({ a: 5, b: 2 }))).toEqual([{ cardId: 'a', before: 5, after: 4, delta: -1, absorbed: false, clamped: false }])
  })
  it('la mise à jour modifiée ne s’absorbe pas elle-même', () => {
    const c = corr('c', '2025-11-01', { a: [1, 4] })
    expect(editImpact(c, null, [c], owned({ a: 4 }))[0]).toMatchObject({ after: 1, absorbed: false })
  })
  it('une quantité qui deviendrait négative est ramenée à 0 et signalée', () => {
    const p = pack('p', '2025-11-01', 'a', 'a')
    expect(editImpact(p, null, [p], owned({ a: 1 }))[0]).toMatchObject({ after: 0, clamped: true })
  })
  it('ignore les mises à jour supprimées', () => {
    const p = pack('p', '2025-11-01', 'a')
    const c = { ...corr('c', '2025-11-05', { a: [0, 4] }), deleted: true }
    expect(editImpact(p, null, [p, c], owned({ a: 4 }))[0].absorbed).toBe(false)
  })
})

describe('validateEvent / sameEvent', () => {
  it('refuse les brouillons vides ou incohérents', () => {
    expect(validateEvent(pack('p', 'd'))).toMatch(/au moins une carte/)
    expect(validateEvent({ id: 't', kind: 'trade', date: 'd', given: 'a', received: 'a' })).toMatch(/différentes/)
    expect(validateEvent({ id: 't', kind: 'trade', date: 'd', given: 'a', received: 'b', tokens: -1 })).toMatch(/jetons/)
    expect(validateEvent(corr('c', 'd', {}))).toMatch(/au moins une carte/)
    expect(validateEvent(corr('c', 'd', { a: [0, 1.5] }))).toMatch(/entiers/)
    expect(validateEvent(pack('p', 'd', 'a'))).toBeNull()
  })
  it('compare le contenu sans les tampons de synchro', () => {
    const a = { ...corr('c', 'd', { a: [1, 2] }), updatedAt: 'x', by: 'dA' }
    expect(sameEvent(a, corr('c', 'd', { a: [1, 2] }))).toBe(true)
    expect(sameEvent(a, corr('c', 'd', { a: [1, 3] }))).toBe(false)
    expect(sameEvent({ id: 's', kind: 'share', date: 'd', cardId: 'a', direction: 'given', friend: undefined }, { id: 's', kind: 'share', date: 'd', cardId: 'a', direction: 'given' })).toBe(true)
  })
})
