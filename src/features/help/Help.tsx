import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Icon, type IconName } from '../../components/Icon'
import { InstallButton } from '../../components/InstallButton'

function Part({ icon, title, open, id, children }: { icon: IconName; title: string; open?: boolean; id?: string; children: ReactNode }) {
  return (
    <details open={open} id={id}>
      <summary><span className="tile-ic"><Icon name={icon} /></span>{title}</summary>
      <div className="body">{children}</div>
    </details>
  )
}

export default function Help() {
  const [params] = useSearchParams()
  const root = useRef<HTMLDivElement>(null)
  const target = params.get('s')
  useEffect(() => {
    if (!target) return
    const el = root.current?.querySelector<HTMLDetailsElement>(`details[id="${CSS.escape(target)}"]`)
    if (!el) return
    el.open = true
    el.scrollIntoView({ block: 'start' })
  }, [target])
  return (
    <div className="page doc" data-section="grey" ref={root}>
      <PageHeader icon="help" title="Aide" sub="Bien démarrer avec l'appli" />

      <Part icon="download" title="Installer l'appli" open>
        <p>Installée, l'appli s'ouvre comme une vraie application, plein écran et même hors connexion.</p>
        <h3>Android (Chrome, Brave)</h3>
        <p>Ouvre le menu ⋮ puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>
        <p>Tu préfères une vraie appli Android ? Télécharge le fichier .apk sur la <a href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer">page des versions</a>, ouvre-le et autorise l'installation depuis ton navigateur. C'est la même appli, mise à jour en même temps que le site.</p>
        <h3>iPhone (Safari)</h3>
        <p>Touche Partager, puis « Sur l'écran d'accueil ».</p>
        <p className="warnbox">Attention : Safari peut effacer les données d'un site resté plusieurs semaines sans visite, sauf s'il est installé sur l'écran d'accueil. Installe l'appli et active la synchronisation Google Drive, ou exporte régulièrement une sauvegarde.</p>
        <h3>Ordinateur (Chrome, Edge, Brave)</h3>
        <p>Clique sur l'icône d'installation à droite de la barre d'adresse.</p>
        <div><InstallButton className="btn primary" /></div>
      </Part>

      <Part icon="plus" title="Ajouter des cartes">
        <p>L'onglet <Link to="/ajout">Ajout</Link> a quatre catégories, selon ce que tu as ouvert ; dans chacune, la méthode recommandée est en premier (étoile) :</p>
        <ul>
          <li><b>1 booster</b> : capture d'écran de fin d'ouverture (ou Ctrl+V sur ordinateur), ou saisie manuelle (recherche par nom ou numéro, ou grille).</li>
          <li><b>10 boosters</b> : lecture du « Résumé ouverture » du jeu (appli Android), captures, vidéo, ou saisie manuelle booster par booster.</li>
          <li><b>1 extension</b> : synchro Pokémon-Zone de cette extension, lecture de l'écran « Échange de points Booster » (appli Android), vidéo, ou saisie des quantités réelles.</li>
          <li><b>MAJ massive</b> : synchro Pokémon-Zone de plusieurs extensions, à cocher.</li>
        </ul>
        <p>Un bouton « Annuler » reste affiché quelques secondes après chaque ajout.</p>
      </Part>

      <Part icon="video" title="Importer sa collection">
        <p><b>Par vidéo</b> : pour chaque extension, ouvre dans le jeu l'écran « Échange de points Booster », filme l'écran en faisant défiler toute la liste, puis importe la vidéo dans <Link to="/ajout?onglet=video">Ajout › 1 extension › Vidéo</Link>.</p>
        <p>Dans l'appli Android, touche « Enregistrer depuis le jeu » (choisis « Tout l'écran »), puis « Démarrer dans 5 s » et retourne dans le jeu pour faire défiler la liste.</p>
        <p>Arrête l'enregistrement depuis la notification d'Holothèque : la vidéo est importée automatiquement à ton retour dans l'appli.</p>
        <p><Link to="/guide-pokemon-zone" className="btn primary"><Icon name="sync" />Guide pas à pas : importer depuis Pokémon-Zone</Link></p>
        <p><b>Depuis Pokémon-Zone</b> : après avoir synchronisé ton compte sur pokemon-zone.com, ouvre ton profil, onglet « Sets », choisis une extension et enregistre la page (.html). Importe-la dans Ajout › 1 extension › Pokémon-Zone.</p>
        <p>Les cartes et le nombre d'exemplaires sont lus automatiquement. Vérifie les changements avant d'enregistrer ; tu pourras annuler.</p>
      </Part>

      <Part icon="cloud" title="Sauvegarder et synchroniser">
        <p><b>Sauvegarde JSON</b> : dans <Link to="/reglages">Réglages</Link>, exporte un fichier à conserver, et réimporte-le pour restaurer tes données.</p>
        <p><b>Synchronisation Google Drive</b> : tes données sont stockées dans un dossier caché de l'appli, dans TON propre Drive. Elles servent à retrouver ta collection sur un autre appareil.</p>
        <p className="warnbox">Pendant la phase de test, le propriétaire de l'appli doit d'abord ajouter ton adresse Gmail comme testeur. Google affiche alors « Google n'a pas validé cette application » : c'est normal, clique sur « Continuer ».</p>
      </Part>

      <Part icon="download" title="Passer de Brave à l'appli Android" id="android">
        <p>Les données de l'appli Android sont séparées de celles de Brave : il faut les transférer une fois.</p>
        <ol>
          <li>Dans Brave, ouvre <Link to="/reglages">Réglages</Link> puis « Synchro Google Drive » et connecte-toi. Sans Drive, utilise plutôt « Exporter (JSON) » et garde le fichier.</li>
          <li>Installe l'appli Android (fichier .apk de la <a href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer">page des versions</a>).</li>
          <li>Dans l'appli, ouvre Réglages et connecte le même compte Google Drive, ou importe le fichier JSON.</li>
        </ol>
        <p className="warnbox">Les données du profil Pokémon-Zone (Profil, Collections à thème) ne passent pas par la synchro Drive. Elles sont dans l'export JSON : si tu veux les garder, utilise l'export / import, ou relance simplement le favori Pokémon-Zone depuis l'appli.</p>
      </Part>

      <Part icon="cal" title="Évènements">
        <p>Enregistre les pages « schedule » et « upcoming » de Pokemon-Zone avec Ctrl+S, puis importe-les depuis <Link to="/evenements">Évènements</Link> avec le bouton « Import .html Pokemon-Zone ».</p>
      </Part>

      <Part icon="sync" title="Mises à jour">
        <p>Quand une nouvelle version est disponible, un bandeau « Nouvelle version disponible » apparaît : touche « Recharger ». Si tu ne vois rien de nouveau, ferme puis rouvre l'appli.</p>
      </Part>

      <p className="muted"><Link to="/a-propos">À propos, sources et confidentialité</Link></p>
    </div>
  )
}
