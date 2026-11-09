import { describe, expect, it } from 'vitest'
import { hashFromDeepLink } from './platform'

describe('hashFromDeepLink', () => {
  const base = 'https://camelbaggy.github.io/ptcgp-collection/'
  it('extrait le hash', () => {
    expect(hashFromDeepLink(`${base}#/ajout?onglet=pz&pzz=abc`)).toBe('#/ajout?onglet=pz&pzz=abc')
  })
  it('sans hash : accueil', () => { expect(hashFromDeepLink(base)).toBe('#/') })
  it('ignore les autres sites', () => {
    expect(hashFromDeepLink('https://example.com/#/x')).toBeNull()
    expect(hashFromDeepLink(null)).toBeNull()
  })
})
