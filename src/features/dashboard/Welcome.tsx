import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { InstallButton } from '../../components/InstallButton'
import { usePersisted } from '../../lib/useData'

const TILES: { to: string; icon: IconName; color: string; title: string; text: string }[] = [
  { to: '/ajout', icon: 'plus', color: 'var(--green)', title: 'Commencer de zéro', text: 'Ouvrez un booster dans le jeu, puis touchez Ajout et tapez les cartes obtenues.' },
  { to: '/ajout?onglet=video', icon: 'video', color: 'var(--blue)', title: 'Importer depuis une vidéo', text: 'Pour chaque extension, filmez l\'écran « Échange de points Booster » du jeu et importez la vidéo.' },
  { to: '/reglages', icon: 'upload', color: 'var(--orange)', title: 'Retrouver mes données', text: 'Restaurez une sauvegarde JSON ou connectez Google Drive.' },
]

/** Carte d'accueil pour une collection vide (masquable). */
export function Welcome({ owned }: { owned: number }) {
  const [dismissed, setDismissed] = usePersisted('welcome.dismissed', false)
  if (owned > 0 || dismissed) return null
  return (
    <section className="welcome" aria-labelledby="welcome-t">
      <h2 id="welcome-t"><span className="tile-ic"><Icon name="sparkle" /></span>Bienvenue</h2>
      <p>Suivez votre collection Pokémon TCG Pocket, hors connexion, gratuitement. Vos données restent sur votre appareil.</p>
      <div className="welcome-tiles">
        {TILES.map((t) => (
          <Link key={t.title} to={t.to} className="welcome-tile" style={{ '--c': t.color } as CSSProperties}>
            <span className="tile-ic"><Icon name={t.icon} /></span>
            <span><b>{t.title}</b><small>{t.text}</small></span>
            <Icon name="chev" className="chev" />
          </Link>
        ))}
      </div>
      <div className="welcome-act">
        <Link to="/aide" className="btn"><Icon name="help" />Aide</Link>
        <InstallButton />
        <button type="button" className="btn ghost" onClick={() => setDismissed(true)}>Masquer</button>
      </div>
    </section>
  )
}
