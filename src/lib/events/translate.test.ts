import { describe, expect, it } from 'vitest'
import { translateEventName as t, translateThemedTitle as th } from './translate'

const ctx = {
  sets: [{ name: 'Puissance Génétique', nameEn: 'Genetic Apex' }, { name: 'Méga Brillance', nameEn: 'Mega Shine' }],
  cards: [
    { name: 'Méga-Carchacrok ex', nameEn: 'Mega Garchomp ex' },
    { name: 'Lokhlass', nameEn: 'Lapras' },
    { name: 'Évoli', nameEn: 'Eevee' },
  ],
}

describe('translateEventName', () => {
  it('drop events', () => {
    expect(t('Mega Garchomp ex Drop Event', ctx)).toBe('Évènement drop : Méga-Carchacrok ex')
    expect(t("Team Rocket's Lapras Drop Event", ctx)).toBe('Évènement drop : Lokhlass de la Team Rocket')
    expect(t('Lapras ex Drop Event', ctx)).toBe('Évènement drop : Lokhlass ex')
    expect(t('PROMO Reissue Drop Event 2026', ctx)).toBe('Évènement drop : Réédition PROMO 2026')
  })
  it('wonder pick', () => {
    expect(t('Wonder Pick Event October 2026')).toBe('Pioche miracle – octobre 2026')
    expect(t('PROMO Reissue Wonder Pick Event 2026', ctx)).toBe('Pioche miracle : Réédition PROMO 2026')
  })
  it('emblem and outbreak', () => {
    expect(t('Genetic Apex Emblem Event 1', ctx)).toBe('Évènement emblème : Puissance Génétique 1')
    expect(t('Deluxe Pack Mega Emblem Event', ctx)).toBe('Évènement emblème : Deluxe Pack Mega')
    expect(t('Parallel Foil Cards Mass Outbreak Event 2026', ctx)).toBe('Apparitions massives : cartes brillantes parallèles 2026')
    expect(t('Fire-type Mass Outbreak Event', ctx)).toBe('Apparitions massives : type Feu')
    expect(t('Eevee Mass Outbreak Event', ctx)).toBe('Apparitions massives : Évoli')
  })
  it('missions', () => {
    expect(t('Community Week Missions October 2026')).toBe('Missions de la semaine communautaire – octobre 2026')
    expect(t('Bonus Week Missions October 2026')).toBe('Missions de la semaine bonus – octobre 2026')
    expect(t('Bonus Week Missions')).toBe('Missions de la semaine bonus')
    expect(t('Second Anniversary Celebration Campaign Missions')).toBe('Missions : Campagne du 2e anniversaire')
  })
  it('unknown pattern is unchanged', () => {
    expect(t('30 Days of Gifts', ctx)).toBe('30 Days of Gifts')
  })
})

describe('noms sans motif', () => {
  it('expressions connues traduites', () => {
    expect(t('Step-Up Battle', ctx)).toBe('Combat progressif')
    expect(t('Random Battles (C1)', ctx)).toBe('Combats aléatoires (C1)')
    expect(t('Dual Fusion Battle Rally (missions)', { sets: [{ name: 'Fusion Double', nameEn: 'Dual Fusion' }] })).toBe('Missions : Fusion Double Rallye de combats')
  })
})

describe('translateThemedTitle', () => {
  const c = { sets: [{ name: 'Fusion Double', nameEn: 'Dual Fusion' }], cards: [{ name: 'Méga-Dracolosse ex', nameEn: 'Mega Dragonite ex' }] }
  it('motifs', () => {
    expect(th('Collect 2 Mega Dragonite ex cards', c)).toBe('Réunir 2 cartes Méga-Dracolosse ex')
    expect(th('Dual Fusion Museum 4', c)).toBe('Musée Fusion Double 4')
    expect(th('All Team Rocket Cards Complete!', c)).toBe('Toutes les cartes Team Rocket réunies !')
    expect(th('Collect 3 Water cards', c)).toBe('Réunir 3 cartes de type Eau')
  })
  it('types entre parenthèses', () => {
    expect(th('The Bold, Upside-Down Ninja (Water/Darkness)', c)).toBe('Le ninja audacieux à l’envers (Eau/Obscurité)')
  })
  it('inconnu : inchangé', () => {
    expect(th('Zzz Qqq', c)).toBe('Zzz Qqq')
  })
})
