import { useEffect, useMemo, useRef } from 'react'
import { BASE } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { pzBookmarklet } from '../../lib/importers/pzBookmarklet'
import { useSets } from '../../lib/useData'

/** Installation du favori « Envoyer vers Holothèque » (import Pokémon-Zone sans fichier). */
export default function PzBookmarklet() {
  const toast = useToast()
  const sets = useSets()
  // codes Pokémon-Zone des extensions connues (P-A → PROMO-A), si la liste du profil est illisible
  const codes = useMemo(() => sets.map((s) => (/^P-[A-Z]$/.test(s.id) ? `PROMO-${s.id.slice(2)}` : s.id)), [sets])
  const code = useMemo(() => pzBookmarklet(new URL(BASE, location.href).href, codes), [codes])
  const link = useRef<HTMLAnchorElement>(null)
  // React refuse les liens « javascript: » dans le rendu : on pose l'adresse à la main
  useEffect(() => { link.current?.setAttribute('href', code) }, [code])

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('Favori copié') }
    catch { toast('Copie impossible : sélectionne le texte du favori à la main') }
  }

  return (
    <details className="pzb">
      <summary><Icon name="sync" />Sans fichier : le favori « Envoyer vers Holothèque »</summary>
      <p className="muted small">Un favori à lancer sur ton profil Pokémon-Zone. Sur la page d'une extension, il te propose de lire celle-ci ou toutes tes extensions ; ailleurs sur le profil, il les lit toutes, l'une après l'autre (quelques minutes). Il clique sur « Load More » à ta place, relève tes cartes puis ouvre Holothèque sur l'écran de vérification. Il ne fait que lire tes pages Pokémon-Zone, rien ne passe par ton compte Nintendo.</p>
      <h4>Sur PC</h4>
      <p className="small">Glisse ce bouton dans ta barre de favoris :{' '}
        <a ref={link} className="btn pzb-link" draggable onClick={(e) => { e.preventDefault(); toast('Glisse-le dans la barre de favoris, ne clique pas ici') }}><Icon name="upload" />Holothèque</a>
      </p>
      <h4>Sur téléphone (Brave, Chrome)</h4>
      <ol className="small">
        <li><button className="btn" onClick={() => void copy()}><Icon name="layers" />Copier le favori</button></li>
        <li>Ajoute n'importe quelle page à tes favoris, puis modifie ce favori : nom <b>Holothèque</b>, et colle le texte copié à la place de l'adresse.</li>
        <li>Sur ton profil Pokémon-Zone, tape <b>Holothèque</b> dans la barre d'adresse et choisis le favori (icône d'étoile) dans la liste.</li>
      </ol>
    </details>
  )
}
