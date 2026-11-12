import { describe, expect, it } from 'vitest'
import { buildCatalog, filterIcons, findIcon, iconFrench, parsePzIcons, sourceFrench, splitIconName, type Names } from './catalog'

// Fragment écrit à la main, de la même forme que la page « Icon Accessories » (tuile : nom, image, provenance).
const tile = (num: string, file: string, alt: string, from: string) => `<a class="accessory-tile"><div>${alt}</div>
<div><img src="https://assets.pokemon-zone.com/game-assets/UI/Textures/System/ItemIcons/ProfileDecoration/Icon/PROFILE_ICON_${num}_${file}.webp?width=300" alt="${alt}" loading="lazy"></div>
<div class="accessory-tile__source"><span class="accessory-tile__source-label">From</span><span class="accessory-tile__source-name ">${from}</span></div></a>`
const PZ = '<main>' + [
  tile('100030', 'EIEVUI', 'Eevee (icon)', 'Available by default'),
  tile('100160', 'PIKACHU', 'Genetic Apex: Pikachu (icon)', 'Dex Missions: Collect 226 cards from Genetic Apex'),
  tile('100990', 'TEAM', 'Team Rocket Grunt ver. 3 (icon)', 'Team Rocket&#039;s Ambition release'),
  tile('100950', 'TEAM', 'Team Rocket’s Ambition: Team Rocket’s Boss (icon)', 'Dex Missions: Collect 72 cards from Team Rocket’s Ambition'),
  tile('101030', 'MEGALIZARDONX', 'Deluxe Pack: Mega: Mega Charizard X (icon)', 'Dex Missions: Collect 402 cards from Deluxe Pack: Mega'),
  tile('101120', 'MIMIROL', 'Buneary (icon)', 'Heliolisk and Buneary Wonderpick'),
  tile('101120', 'MIMIROL', 'Buneary (icon)', 'doublon'),
].join('\n') + '</main>'

const CARDS: Record<string, { name: string; trainer: boolean }> = {
  eevee: { name: 'Évoli', trainer: false }, pikachu: { name: 'Pikachu', trainer: false }, buneary: { name: 'Laporeille', trainer: false },
  heliolisk: { name: 'Iguolta', trainer: false }, 'mega charizard x': { name: 'Méga-Dracaufeu X', trainer: false },
  'team rocket grunt': { name: 'Sbire de la Team Rocket', trainer: true }, "team rocket's boss": { name: 'Boss de la Team Rocket', trainer: true },
}
const SETS: Record<string, string> = { A1: 'Puissance Génétique', B4a: "L'Ambition de la Team Rocket", B4b: 'Booster de Luxe Méga' }
const N: Names = { card: (en) => CARDS[en.toLowerCase()], setName: (id) => SETS[id] }

describe('icônes de profil : Pokémon-Zone', () => {
  it('lit les tuiles (sans doublon)', () => {
    const l = parsePzIcons(PZ)
    expect(l).toHaveLength(6)
    expect(l[0]).toEqual({ num: 100030, nameEn: 'Eevee', source: 'Available by default', asset: 'UI/Textures/System/ItemIcons/ProfileDecoration/Icon/PROFILE_ICON_100030_EIEVUI.webp' })
    expect(l[3].nameEn).toBe("Team Rocket's Ambition: Team Rocket's Boss")
    expect(l[2].source).toBe("Team Rocket's Ambition release")
  })

  it('découpe les noms', () => {
    expect(splitIconName('Genetic Apex: Pikachu')).toEqual({ base: 'Pikachu', prefix: 'Genetic Apex', ver: '' })
    expect(splitIconName("Team Rocket's Boss (Team Rocket's Ambition)")).toEqual({ base: "Team Rocket's Boss", prefix: "Team Rocket's Ambition", ver: '' })
    expect(splitIconName('Team Rocket Grunt 3')).toEqual({ base: 'Team Rocket Grunt', prefix: '', ver: '3' })
    expect(splitIconName('Pikachu ver. 14')).toEqual({ base: 'Pikachu', prefix: '', ver: '14' })
    expect(splitIconName('Deluxe Pack: Mega: Mega Charizard X')).toEqual({ base: 'Mega Charizard X', prefix: 'Deluxe Pack: Mega', ver: '' })
  })

  it('traduit en français', () => {
    expect(iconFrench('Genetic Apex: Pikachu', N)).toEqual({ name: 'Pikachu (Puissance Génétique)', kind: 'pokemon' })
    expect(iconFrench('Team Rocket Grunt ver. 3', N)).toEqual({ name: 'Sbire de la Team Rocket (version 3)', kind: 'trainer' })
    expect(iconFrench('Rika', N)).toEqual({ name: 'Rika', kind: 'pokemon' })
    expect(sourceFrench('Dex Missions: Collect 226 cards from Genetic Apex', N)).toBe('Missions : 226 cartes de Puissance Génétique')
    expect(sourceFrench('Heliolisk and Buneary Wonderpick', N)).toBe('Pioche miracle Iguolta et Laporeille')
    expect(sourceFrench('Available by default', N)).toBe('Dès le départ')
    expect(sourceFrench("Team Rocket's Ambition release", N)).toBe("Sortie de L'Ambition de la Team Rocket")
  })

  it('fusionne Serebii et Pokémon-Zone, plus récentes d’abord', () => {
    const serebii = [
      { id: 's-brandnew', nameEn: 'Brand New', path: 'profile-icons/s-brandnew.webp' },
      { id: 's-teamrocketgrunt3', nameEn: 'Team Rocket Grunt 3', path: 'profile-icons/s-teamrocketgrunt3.webp' },
      { id: 's-teamrocketsbossteamrocketsambition', nameEn: "Team Rocket's Boss (Team Rocket's Ambition)", path: 'profile-icons/b.webp' },
      { id: 's-megacharizardx', nameEn: 'Mega Charizard X', path: 'profile-icons/x.webp' },
    ]
    const cat = buildCatalog(serebii, parsePzIcons(PZ), N)
    expect(cat.map((i) => i.id)).toEqual(['s-brandnew', 'pz-101120', 'pz-101030', 'pz-100990', 'pz-100950', 'pz-100160', 'pz-100030'])
    expect(findIcon(cat, 's-teamrocketgrunt3')).toMatchObject({ id: 'pz-100990', local: true, src: 'profile-icons/s-teamrocketgrunt3.webp' })
    expect(findIcon(cat, 's-megacharizardx')?.id).toBe('pz-101030')
    expect(findIcon(cat, 'pz-100030')).toMatchObject({ name: 'Évoli', local: false, src: expect.stringContaining('assets.pokemon-zone.com') })
    expect(findIcon(cat, 'nope')).toBeUndefined()
    // sans lecture Pokémon-Zone : les icônes Serebii seules
    expect(buildCatalog(serebii, [], N).map((i) => i.id)).toEqual(serebii.map((s) => s.id))
  })

  it('filtre par genre et recherche sans accents', () => {
    const cat = buildCatalog([], parsePzIcons(PZ), N)
    expect(filterIcons(cat, 'trainer', '').map((i) => i.id)).toEqual(['pz-100990', 'pz-100950'])
    expect(filterIcons(cat, 'all', 'evoli').map((i) => i.id)).toEqual(['pz-100030'])
    expect(filterIcons(cat, 'all', 'genetique').map((i) => i.id)).toEqual(['pz-100160'])
  })
})

describe('icônes de profil : noms particuliers', () => {
  it('Pokémon par le jeton japonais, élision, apparitions', () => {
    const n: Names = { ...N, jp: (t) => ({ TRIMMIEN: 'Couafarel' } as Record<string, string>)[t], setName: (id) => ({ B3: 'Aura Palpitante', A4b: 'Booster de Luxe EX' } as Record<string, string>)[id] }
    expect(iconFrench('Furfrou Heart Trim', n, 'TRIMMIEN')).toEqual({ name: 'Couafarel (Heart Trim)', kind: 'pokemon' })
    expect(iconFrench('Deluxe Pack: ex Pikachu', n)).toEqual({ name: 'Pikachu (Booster de Luxe)', kind: 'pokemon' })
    expect(iconFrench('Professor Oak', n)).toEqual({ name: 'Professeur Chen', kind: 'trainer' })
    expect(sourceFrench('Pulsing Aura Release', n)).toBe('Sortie d\'Aura Palpitante')
    expect(sourceFrench('Launch', n)).toBe('Lancement du jeu')
    expect(sourceFrench('Pika Pika! Pikachu missions', n)).toBe('Missions Pika Pika! Pikachu')
  })
})
