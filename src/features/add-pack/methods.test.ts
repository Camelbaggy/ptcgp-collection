import { describe, expect, it } from 'vitest'
import { CATS, fromOnglet, methodsFor, pickMethod } from './methods'

describe('méthodes de l\'onglet Ajout', () => {
  it('recommandée en premier, celles de Nicolas pour Android', () => {
    expect(methodsFor('booster', true)).toEqual(['shot', 'manual'])
    expect(methodsFor('boosters', true)).toEqual(['screen', 'shots', 'video', 'manual'])
    expect(methodsFor('set', true)).toEqual(['pz', 'screen', 'video', 'manual'])
    expect(methodsFor('mass', true)).toEqual(['pz', 'screen'])
  })
  it('pas de lecture d\'écran sur le web', () => {
    for (const c of CATS) expect(methodsFor(c.id, false)).not.toContain('screen')
    expect(methodsFor('boosters', false)[0]).toBe('shots')
  })
  it('garde la dernière méthode si elle existe ici, sinon la recommandée', () => {
    expect(pickMethod('set', true, 'video')).toBe('video')
    expect(pickMethod('set', false, 'screen')).toBe('pz')
    expect(pickMethod('booster', true, undefined)).toBe('shot')
  })
  it('anciennes adresses', () => {
    expect(fromOnglet('maj')).toEqual({ cat: 'set', method: 'manual' })
    expect(fromOnglet('grille')).toMatchObject({ cat: 'booster', method: 'manual', grid: true })
    expect(fromOnglet('pz')).toEqual({ cat: 'mass', method: 'pz' })
    expect(fromOnglet('pz1')).toEqual({ cat: 'set', method: 'pz' })
    expect(fromOnglet('lecture')).toEqual({ cat: 'set', method: 'screen' })
    expect(fromOnglet('x')).toBeNull()
  })
})
