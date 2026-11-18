/** Types PokeAPI (id -> libellé FR ; couleurs : jetons `--dex-*` de styles.css, classes `.dx-t-<id>` de pokedex.css). */
export const TYPES: Record<number, { fr: string }> = {
  1: { fr: 'Normal' }, 2: { fr: 'Combat' }, 3: { fr: 'Vol' },
  4: { fr: 'Poison' }, 5: { fr: 'Sol' }, 6: { fr: 'Roche' },
  7: { fr: 'Insecte' }, 8: { fr: 'Spectre' }, 9: { fr: 'Acier' },
  10: { fr: 'Feu' }, 11: { fr: 'Eau' }, 12: { fr: 'Plante' },
  13: { fr: 'Électrik' }, 14: { fr: 'Psy' }, 15: { fr: 'Glace' },
  16: { fr: 'Dragon' }, 17: { fr: 'Ténèbres' }, 18: { fr: 'Fée' },
}
