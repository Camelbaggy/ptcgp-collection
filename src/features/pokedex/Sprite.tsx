import { memo, useState } from 'react'
import { spriteUrl } from './usePokedex'

/** Sprite PokeAPI (téléchargé au déploiement) ; repli sobre quand le fichier est absent. */
export const Sprite = memo(function Sprite({ formId, dex, size }: { formId: number; dex: number; size: number }) {
  const [broken, setBroken] = useState(false)
  return broken ? (
    <span className="dx-sprite dx-sprite-fb" style={{ width: size, height: size }} aria-hidden>{dex}</span>
  ) : (
    <img className="dx-sprite" src={spriteUrl(formId)} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  )
})
