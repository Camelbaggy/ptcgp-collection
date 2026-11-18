import { describe, expect, it } from 'vitest'
import { deletionNote, originsOf } from './gallery'

describe('deletionNote', () => {
  it('tout supprimé', () => {
    expect(deletionNote({ deleted: 3, failed: 0, cancelled: false }, 3)).toBe('3 captures supprimées du téléphone')
    expect(deletionNote({ deleted: 1, failed: 0, cancelled: false }, 1)).toBe('capture supprimée du téléphone')
  })
  it('refus de la fenêtre Android', () => {
    expect(deletionNote({ deleted: 0, failed: 0, cancelled: true }, 2)).toBe('captures gardées')
    expect(deletionNote({ deleted: 0, failed: 0, cancelled: true }, 1)).toBe('capture gardée')
  })
  it('en partie', () => {
    expect(deletionNote({ deleted: 2, failed: 1, cancelled: false }, 3)).toBe('2 captures supprimées du téléphone, 1 non supprimée')
    expect(deletionNote({ deleted: 0, failed: 2, cancelled: false }, 2)).toBe('2 non supprimées')
  })
})

describe('originsOf', () => {
  it('ignore les fichiers du champ fichier du navigateur', () => {
    expect(originsOf([new Blob(['x'])])).toEqual([])
  })
})
