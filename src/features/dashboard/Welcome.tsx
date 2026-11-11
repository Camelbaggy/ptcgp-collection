import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { InstallButton } from '../../components/InstallButton'
import { isNative } from '../../lib/native/holoNative'
import { usePersisted } from '../../lib/useData'

/** Alternatives : une extension à la fois (ordre de l'onglet Ajout › 1 extension, sans Pokémon-Zone). */
const PER_SET: { to: string; icon: IconName; label: string; native?: boolean }[] = [
  { to: '/ajout?onglet=lecture', icon: 'video', label: 'Lecture d\'écran', native: true },
  { to: '/ajout?onglet=video', icon: 'video', label: 'Vidéo du jeu' },
  { to: '/ajout?onglet=maj', icon: 'search', label: 'Saisie manuelle' },
]

/**
 * Accueil du premier lancement (collection vide, masquable) : la synchro complète depuis
 * Pokémon-Zone en premier, puis l'ajout extension par extension.
 */
export function Welcome({ owned }: { owned: number }) {
  const [dismissed, setDismissed] = usePersisted('welcome.dismissed', false)
  if (owned > 0 || dismissed) return null
  const perSet = PER_SET.filter((m) => !m.native || isNative)
  return (
    <section className="welcome" aria-labelledby="welcome-t">
      <h2 id="welcome-t"><span className="tile-ic"><Icon name="sparkle" /></span>Bienvenue</h2>
      <p>Suivez votre collection Pokémon TCG Pocket, hors connexion, gratuitement. Vos données restent sur votre appareil. Pour commencer, importez votre collection :</p>

      <Link to={isNative ? '/ajout?onglet=massive' : '/guide-pokemon-zone'} className="welcome-hero" style={{ '--c': 'var(--green)' } as CSSProperties}>
        <span className="rec-tag">Recommandé</span>
        <span className="tile-ic"><Icon name="sync" /></span>
        <span>
          <b>Tout synchroniser depuis Pokémon-Zone</b>
          <small>Toutes vos extensions, votre profil et vos souhaits en quelques minutes, sans rien saisir. Il faut un compte Pokémon-Zone relié au jeu.</small>
        </span>
        <Icon name="chev" className="chev" />
      </Link>
      <p className="welcome-sub small">
        {isNative
          ? <>Pas encore de compte Pokémon-Zone ? <Link to="/guide-pokemon-zone">Le guide pas à pas</Link> explique comment le créer.</>
          : <>Le guide explique comment créer le compte et installer le favori qui envoie tout vers Holothèque.</>}
      </p>

      <div className="welcome-alt">
        <h3>Ou extension par extension</h3>
        <div className="welcome-chips">
          {perSet.map((m) => (
            <Link key={m.to} to={m.to} className="chip big"><Icon name={m.icon} />{m.label}</Link>
          ))}
        </div>
        <p className="welcome-sub small">{isNative ? 'La lecture d\'écran filme' : 'Filmez'} l'écran « Échange de points Booster » d'une extension pendant que vous faites défiler la liste, ou tapez vos quantités.</p>
      </div>

      <div className="welcome-act">
        <Link to="/aide" className="btn"><Icon name="help" />Aide</Link>
        <Link to="/reglages" className="btn"><Icon name="upload" />Restaurer une sauvegarde</Link>
        <InstallButton />
        <button type="button" className="btn ghost" onClick={() => setDismissed(true)}>Masquer</button>
      </div>
    </section>
  )
}
