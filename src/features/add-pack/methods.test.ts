import { describe, expect, it } from 'vitest'
import { CATS, METHOD_LABEL, fromOnglet, methodsFor, pickMethod } from './methods'

describe('méthodes de l\'onglet Ajout', () => {
  it('recommandée en premier, celles de Nicolas pour Android', () => {
    expect(methodsFor('booster', true)).toEqual(['shot', 'manual', 'grid'])
    expect(methodsFor('boosters', true)).toEqual(['screen', 'shots', 'video', 'manual'])
    expect(methodsFor('set', true)).toEqual(['pz', 'screen', 'video', 'manual'])
    expect(methodsFor('mass', true)).toEqual(['pz', 'screen'])
    expect(methodsFor('wonder', true)).toEqual(['manual'])
  })
  it('pas de lecture d\'écran sur le web, le reste identique', () => {
    for (const c of CATS) {
      expect(methodsFor(c.id, false)).not.toContain('screen')
      expect(methodsFor(c.id, false)).toEqual(methodsFor(c.id, true).filter((m) => m !== 'screen'))
    }
    expect(methodsFor('boosters', false)[0]).toBe('shots')
  })
  it('libellés courts : cinq catégories, un ou deux mots', () => {
    expect(CATS.map((c) => c.short)).toEqual(['1 booster', 'Pioche', '10 boosters', 'Extension', 'Tout'])
    for (const m of Object.values(METHOD_LABEL)) expect(m.short.split(' ').length).toBeLessThanOrEqual(2)
  })
  it('garde la dernière méthode si elle existe ici, sinon la recommandée', () => {
    expect(pickMethod('set', true, 'video')).toBe('video')
    expect(pickMethod('set', false, 'screen')).toBe('pz')
    expect(pickMethod('booster', true, undefined)).toBe('shot')
    expect(pickMethod('booster', false, 'grid')).toBe('grid')
  })
  it('ancienne préférence « Grille » de la saisie manuelle', () => {
    expect(pickMethod('booster', false, 'manual', true)).toBe('grid')
    expect(pickMethod('booster', false, 'manual', false)).toBe('manual')
    expect(pickMethod('boosters', false, 'manual', true)).toBe('manual')
  })
  it('anciennes et nouvelles adresses (?onglet=)', () => {
    const cases: [string, ReturnType<typeof fromOnglet>][] = [
      ['saisie', { cat: 'booster', method: 'manual', grid: false }],
      ['grille', { cat: 'booster', method: 'grid', grid: true }],
      ['booster', { cat: 'booster' }],
      ['boosters', { cat: 'boosters' }],
      ['recap', { cat: 'boosters' }],
      ['maj', { cat: 'set', method: 'manual' }],
      ['video', { cat: 'set', method: 'video' }],
      ['lecture', { cat: 'set', method: 'screen' }],
      ['import', { cat: 'set', method: 'pz' }],
      ['pz1', { cat: 'set', method: 'pz' }],
      ['pioche', { cat: 'wonder' }],
      ['extension', { cat: 'set' }],
      ['pz', { cat: 'mass', method: 'pz' }],
      ['massive', { cat: 'mass', method: 'pz' }],
    ]
    for (const [o, want] of cases) expect(fromOnglet(o), o).toEqual(want)
    expect(fromOnglet('x')).toBeNull()
    expect(fromOnglet(null)).toBeNull()
  })
  it('chaque adresse mène à une méthode qui existe sur le web et sur Android (sauf lecture d\'écran sur le web)', () => {
    for (const o of ['saisie', 'grille', 'maj', 'video', 'import', 'pz1', 'pz', 'massive']) {
      const to = fromOnglet(o)!
      expect(methodsFor(to.cat, false)).toContain(to.method)
      expect(methodsFor(to.cat, true)).toContain(to.method)
    }
    expect(pickMethod('set', false, fromOnglet('lecture')!.method)).toBe('pz')
  })
})
