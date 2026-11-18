import { useEffect, useMemo, useRef } from 'react'
import { BASE } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { pzBookmarklet } from '../../lib/importers/pzBookmarklet'

/** Parties « PC » et « téléphone » de l'installation du favori (réutilisées par le guide pas à pas). */
export function PzBookmarkletInstall({ part = 'both' }: { part?: 'pc' | 'phone' | 'both' }) {
  const toast = useToast()
  const code = useMemo(() => pzBookmarklet(new URL(BASE, location.href).href), [])
  const link = useRef<HTMLAnchorElement>(null)
  // React refuse les liens « javascript: » dans le rendu : on pose l'adresse à la main
  useEffect(() => { link.current?.setAttribute('href', code) }, [code, part])

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('Favori copié') }
    catch { toast('Copie impossible : sélectionne le texte du favori à la main') }
  }

  return (
    <>
      {part !== 'phone' && (
        <>
          <h4>Sur PC</h4>
          <p className="small pzg-p">Glisse ce bouton dans ta barre de favoris :{' '}
            <a ref={link} className="btn pzb-link" draggable onClick={(e) => { e.preventDefault(); toast('Glisse-le dans la barre de favoris, ne clique pas ici') }}><Icon name="upload" />Holothèque</a>
          </p>
        </>
      )}
      {part !== 'pc' && (
        <>
          <h4>Sur téléphone (Brave, Chrome)</h4>
          <ol className="small">
            <li><button className="btn" onClick={() => void copy()}><Icon name="layers" />Copier le favori</button></li>
            <li>Ajoute n'importe quelle page à tes favoris, puis modifie ce favori : nom <b>Holothèque</b>, et colle le texte copié à la place de l'adresse.</li>
            <li>Sur ton profil Pokémon-Zone, tape <b>Holothèque</b> dans la barre d'adresse et choisis le favori (icône d'étoile) dans la liste.</li>
          </ol>
        </>
      )}
    </>
  )
}

/** Installation du favori « Envoyer vers Holothèque » (import Pokémon-Zone sans fichier). Ce qu'il fait : aide « ? » de l'écran Ajout. */
export default function PzBookmarklet() {
  return (
    <details className="pzb">
      <summary><Icon name="sync" />Installer le favori « Envoyer vers Holothèque »</summary>
      <PzBookmarkletInstall />
    </details>
  )
}
