import { describe, expect, it } from 'vitest'
import { mergeIconLists, parseSerebiiIcons, serebiiIconId } from '../../../scripts/lib/profileIcons.mjs'

// Page de test écrite à la main (même forme que la page Serebii : noms, images, puis « Method »).
const PAGE = `<table class="dextable"><tr><td class="fooevo">Alakazam</td><td class="fooevo">Pikachu ver. 14</td></tr>
<tr><td class="cen"><img src="/tcgpocket/icon/alakazam.png" alt="Alakazam" /></td>
<td class="cen"><img src="/tcgpocket/icon/pikachuver.14.png" alt="Pikachu ver. 14" /></td></tr>
<tr><td class="cen"><b>Method</b><br />Complete Dual Fusion Themed Collection</td><td class="cen"><b>Method</b><br />Special Event</td></tr>
<tr><td><img src="/tcgpocket/icon/teamrocket'sboss(teamrocket'sambition).png" alt="Team Rocket's Boss (Team Rocket's Ambition)" /></td></tr>
<tr><td class="cen"><b>Method</b><br />Complete the Team Rocket's Ambition Mission</td></tr></table>
<img src="/Toolbar/icon/tcgpocket.jpg">`

describe('icônes de profil : Serebii', () => {
  it('lit les icônes, leurs noms et méthodes', () => {
    const icons = parseSerebiiIcons(PAGE, 'https://www.serebii.net/tcgpocket/icons.shtml')
    expect(icons.map((i) => i.id)).toEqual(['s-alakazam', 's-pikachuver14', 's-teamrocketsbossteamrocketsambition'])
    expect(icons[0]).toMatchObject({ nameEn: 'Alakazam', method: 'Complete Dual Fusion Themed Collection', src: 'https://www.serebii.net/tcgpocket/icon/alakazam.png' })
    expect(icons[2].nameEn).toBe("Team Rocket's Boss (Team Rocket's Ambition)")
  })

  it('identifiant stable', () => {
    expect(serebiiIconId('Mega%20Greninja.png')).toBe('s-megagreninja')
    expect(serebiiIconId('.png')).toBeNull()
  })

  it('garde les anciennes icônes et date les nouvelles', () => {
    const prev = [{ id: 's-old', nameEn: 'Old', added: '2026-11-01' }, { id: 's-a', nameEn: 'A', added: '2026-11-01' }]
    const { icons, added } = mergeIconLists(prev, [{ id: 's-new', nameEn: 'New' }, { id: 's-a', nameEn: 'A2' }], '2026-11-12')
    expect(added).toEqual(['s-new'])
    expect(icons.map((i) => i.id)).toEqual(['s-new', 's-a', 's-old'])
    expect(icons[1]).toMatchObject({ nameEn: 'A2', added: '2026-11-01' })
  })
})
