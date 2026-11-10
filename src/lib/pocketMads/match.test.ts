import { describe, expect, it } from 'vitest'
import type { MetaDeck } from '../meta/compute'
import { matchPmDeck, normDeckName, tierKey } from './match'

const deck = (id: string, name: string) => ({ id, name } as MetaDeck)

describe('pocketMads match', () => {
  it('normalise les noms', () => {
    expect(normDeckName('Giratina ex / Darkrai ex')).toBe(normDeckName('Giratina ex Darkrai ex'))
    expect(normDeckName('Greninja ex Mega Greninja ex')).not.toBe(normDeckName('Mega Greninja ex Greninja ex'))
    expect(normDeckName("Farfetch'd")).toBe('farfetchd')
  })
  it('tiers', () => {
    expect(tierKey('Tier 3')).toBe('3')
    expect(tierKey('SLEEPERS')).toBe('S')
    expect(tierKey('Autre')).toBeNull()
  })
  it('relie par id puis par nom', () => {
    const ds = [deck('giratina-darkrai-a2b', 'Giratina ex Darkrai ex'), deck('mewtwo-ex-a1', 'Mewtwo ex Gardevoir')]
    expect(matchPmDeck({ name: 'x', id: 'mewtwo-ex-a1' }, ds)?.id).toBe('mewtwo-ex-a1')
    expect(matchPmDeck({ name: 'Giratina ex Darkrai ex', id: 'giratina-ex-a2b-darkrai-ex-a2' }, ds)?.id).toBe('giratina-darkrai-a2b')
    expect(matchPmDeck({ name: 'Inconnu' }, ds)).toBeNull()
  })
})
