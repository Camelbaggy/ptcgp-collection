import { describe, expect, it } from 'vitest'
import { translateEventName as t } from './translate'

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
