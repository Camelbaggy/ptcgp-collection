import { describe, expect, it } from 'vitest'
import { cosmeticSubject, describeReward, packBooster, pzAssetUrl, type RewardCtx } from './rewardInfo'

const ctx: RewardCtx = {
  cards: [{ id: 'P-B-103', name: 'Pikachu-ex', setId: 'P-B' }, { id: 'A1-225', name: 'Morgane', setId: 'A1' }],
  sets: [
    { id: 'A1', name: 'Puissance Génétique', order: 1 }, { id: 'A2b', name: 'Lumière Triomphale', order: 5 },
    { id: 'B3', name: 'Aura Palpitante', order: 20 }, { id: 'C1', name: 'Fusion Double', order: 30 }, { id: 'P-C', name: 'Promo-C', order: 99 },
  ],
  boosters: [
    { id: 'A1-Dracaufeu', setId: 'A1', name: 'Dracaufeu' }, { id: 'A1-Mewtwo', setId: 'A1', name: 'Mewtwo' }, { id: 'A1-Pikachu', setId: 'A1', name: 'Pikachu' },
    { id: 'B3-Unique', setId: 'B3', name: 'Aura Palpitante' }, { id: 'C1-Mewtwo', setId: 'C1', name: 'Méga-Mewtwo X' }, { id: 'C1-Pikachu', setId: 'C1', name: 'Pikachu' },
    { id: 'P-C-Promo', setId: 'P-C', name: 'Promo', entryOnly: true },
  ],
  jp: { PIKACHU: 'Pikachu', KODUCK: 'Psykokwak', METAMON: 'Métamorph', BIPPA: 'Keunotor', GEKKOUGA: 'Amphinobi', MEGAMEWTWOX: 'Méga-Mewtwo X', CHILI: 'Cayenn', PALDEADOOH: 'Terraiste de Paldea' },
}

describe('describeReward', () => {
  it('carte : notre carte quand le lien est connu', () => {
    expect(describeReward({ item: 'cPK_90_005410_00_PIKACHUex_IM', link: '/cards/promo-b/103/pikachu-ex/', cardId: 'P-B-103', src: 'CardRenders3D/x.webp' }, ctx))
      .toEqual({ kind: 'card', label: 'Pikachu-ex', cardId: 'P-B-103', setId: 'P-B' })
    expect(describeReward({ link: '/cards/a1/225/sabrina/', item: 'cTR_10_000170_00_NATSUME_U' }, ctx)).toMatchObject({ kind: 'card', cardId: 'A1-225' })
    // carte inconnue (nouvelle extension) : image Pokémon-Zone, nom depuis le fichier
    expect(describeReward({ item: 'cPK_90_099990_00_GEKKOUGA_C', src: 'CardRenders3D/g.webp', link: '/cards/zz/1/x/' }, ctx))
      .toMatchObject({ kind: 'card', label: 'Amphinobi', pzImage: pzAssetUrl('CardRenders3D/g.webp') })
  })
  it('booster : extension, booster, 1 carte garantie, promo', () => {
    expect(describeReward({ item: 'PACK_ICON_BN006_0010_00_000', link: '/sets/b3/packs/pulsing-aura/' }, ctx)).toMatchObject({ kind: 'pack', boosterId: 'B3-Unique', setId: 'B3', label: 'Aura Palpitante' })
    expect(describeReward({ item: 'PACK_ICON_AN001_0020_00_000', link: '/sets/a1/packs/genetic-apex-charizard-1-card-guaranteed/' }, ctx))
      .toMatchObject({ boosterId: 'A1-Dracaufeu', label: 'Puissance Génétique · Dracaufeu (1 carte ★★ garantie)' })
    expect(describeReward({ item: 'PACK_ICON_CN001_0010_00_000', link: '/sets/c1/packs/dual-fusion-mega-mewtwo-x/' }, ctx)).toMatchObject({ boosterId: 'C1-Mewtwo' })
    expect(describeReward({ item: 'PACK_ICON_CP001_0010_00_000', link: '/sets/promo-c/packs/promo-pack-c-series-vol-1/', src: 'UI/p.webp' }, ctx))
      .toMatchObject({ kind: 'pack', setId: 'P-C', label: 'Booster promo série C vol. 1', pzImage: pzAssetUrl('UI/p.webp') })
    expect(describeReward({ item: 'PACK_ICON_EVP001_0010_00_000', link: '/sets/unk/packs/pika-pika-pikachu-pack/' }, ctx)).toMatchObject({ kind: 'pack', label: 'Pika Pika Pikachu Pack' })
  })
  it('booster sans lien : retrouvé par le code de l\'icône', () => {
    expect(packBooster(null, '', 'PACK_ICON_BN006_0010_00_000', { ...ctx, sets: [...ctx.sets, ...['B1', 'B1a', 'B2', 'B2a', 'B2b'].map((id, i) => ({ id, name: id, order: 10 + i }))] })).toBe('B3-Unique')
  })
  it('cosmétiques : nom du Pokémon en français, image du jeu', () => {
    expect(describeReward({ item: 'PLAYMAT_100790_PIKACHU_KODUCK_METAMON_BIPPA_PlayMat', src: 'Asset3d/p.webp' }, ctx))
      .toEqual({ kind: 'cosmetic', label: 'Tapis de jeu Pikachu, Psykokwak, Métamorph et Keunotor', sub: 'Tapis de jeu', pzImage: pzAssetUrl('Asset3d/p.webp') })
    expect(describeReward({ item: 'DECKSHIELD_100950_MEGAGEKKOUGA_DeckShield' }, ctx).label).toBe('Protège-cartes Méga-Amphinobi')
    expect(describeReward({ item: 'COIN_101140_CHILI_DOOH_BattleCoin' }, ctx).label).toBe('Pièce Cayenn et Terraiste')
    expect(describeReward({ item: 'COIN_101090_PIKACHU_4_BattleCoin' }, ctx).label).toBe('Pièce Pikachu')
    expect(describeReward({ item: 'EMBLEM_101440_EVENT16_BRZ' }, ctx).label).toBe('Emblème bronze')
    expect(describeReward({ item: 'PROFILE_ICON_101140_PIKACHU_Ver2' }, ctx).label).toBe('Icône de profil Pikachu')
    // nom de l'article de boutique quand le fichier ne dit rien
    expect(describeReward({ item: 'ICON_FILE_101390', name: 'Méga-Amphinobi (cover)' }, ctx).label).toBe('Couverture de classeur Méga-Amphinobi')
    expect(describeReward({ item: 'ICON_BOARD_101740' }, ctx).label).toBe('Fond de présentoir')
    expect(cosmeticSubject('PLAYMAT_1_UNKNOWNMON_PlayMat', ctx.jp)).toBeUndefined()
  })
  it('objets courants', () => {
    expect(describeReward({ item: 'PACK_CHARGER_100030' }, ctx)).toMatchObject({ kind: 'item', label: 'Sablier de booster' })
  })
})
