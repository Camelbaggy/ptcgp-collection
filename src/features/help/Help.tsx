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
        <p>Ouvrez le menu ⋮ puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>
        <p>Vous préférez une vraie appli Android ? Téléchargez le fichier .apk sur la <a href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer">page des versions</a>, ouvrez-le et autorisez l'installation depuis votre navigateur. C'est la même appli, mise à jour en même temps que le site.</p>
        <h3>iPhone (Safari)</h3>
        <p>Touchez Partager, puis « Sur l'écran d'accueil ».</p>
        <p className="warnbox">Attention : Safari peut effacer les données d'un site resté plusieurs semaines sans visite, sauf s'il est installé sur l'écran d'accueil. Installez l'appli et activez la synchronisation Google Drive, ou exportez régulièrement une sauvegarde.</p>
        <h3>Ordinateur (Chrome, Edge, Brave)</h3>
        <p>Cliquez sur l'icône d'installation à droite de la barre d'adresse.</p>
        <div><InstallButton className="btn primary" /></div>
      </Part>

      <Part icon="plus" title="Ajouter des cartes">
        <p>L'onglet <Link to="/ajout">Ajout</Link> a quatre catégories, selon ce que vous avez ouvert ; dans chacune, la méthode recommandée est en premier (étoile) :</p>
        <ul>
          <li><b>1 booster</b> : capture d'écran de fin d'ouverture (ou Ctrl+V sur ordinateur), ou saisie manuelle (recherche par nom ou numéro, ou grille).</li>
          <li><b>10 boosters</b> : lecture du « Résumé ouverture » du jeu (appli Android), captures, vidéo, ou saisie manuelle booster par booster.</li>
          <li><b>1 extension</b> : synchro Pokémon-Zone de cette extension, lecture de l'écran « Échange de points Booster » (appli Android), vidéo, ou saisie des quantités réelles.</li>
          <li><b>MAJ massive</b> : synchro Pokémon-Zone de plusieurs extensions, à cocher.</li>
        </ul>
        <p>Un bouton « Annuler » reste affiché quelques secondes après chaque ajout.</p>
      </Part>

      <Part icon="video" title="Importer sa collection">
        <p><b>Par vidéo</b> : pour chaque extension, ouvrez dans le jeu l'écran « Échange de points Booster », filmez l'écran en faisant défiler toute la liste, puis importez la vidéo dans <Link to="/ajout?onglet=video">Ajout › 1 extension › Vidéo</Link>.</p>
        <p>Dans l'appli Android, touchez « Enregistrer depuis le jeu » (choisissez « Tout l'écran »), puis « Démarrer dans 5 s » et retournez dans le jeu pour faire défiler la liste.</p>
        <p>Arrêtez l'enregistrement depuis la notification d'Holothèque : la vidéo est importée automatiquement à votre retour dans l'appli.</p>
        <p><Link to="/guide-pokemon-zone" className="btn primary"><Icon name="sync" />Guide pas à pas : importer depuis Pokémon-Zone</Link></p>
        <p><b>Depuis Pokémon-Zone</b> : après avoir synchronisé votre compte sur pokemon-zone.com, ouvrez votre profil, onglet « Sets », choisissez une extension et enregistrez la page (.html). Importez-la dans Ajout › 1 extension › Pokémon-Zone.</p>
        <p>Les cartes et le nombre d'exemplaires sont lus automatiquement. Vérifiez les changements avant d'enregistrer ; vous pourrez annuler.</p>
      </Part>

      <Part icon="cloud" title="Sauvegarder et synchroniser">
        <p><b>Sauvegarde JSON</b> : dans <Link to="/reglages">Réglages</Link>, exportez un fichier à conserver, et réimportez-le pour restaurer vos données.</p>
        <p><b>Synchronisation Google Drive</b> : vos données sont stockées dans un dossier caché de l'appli, dans VOTRE propre Drive. Elles servent à retrouver votre collection sur un autre appareil.</p>
        <p className="warnbox">Pendant la phase de test, le propriétaire de l'appli doit d'abord ajouter votre adresse Gmail comme testeur. Google affiche alors « Google n'a pas validé cette application » : c'est normal, cliquez sur « Continuer ».</p>
      </Part>

      <Part icon="download" title="Passer de Brave à l'appli Android" id="android">
        <p>Les données de l'appli Android sont séparées de celles de Brave : il faut les transférer une fois.</p>
        <ol>
          <li>Dans Brave, ouvrez <Link to="/reglages">Réglages</Link> puis « Synchro Google Drive » et connectez-vous. Sans Drive, utilisez plutôt « Exporter (JSON) » et gardez le fichier.</li>
          <li>Installez l'appli Android (fichier .apk de la <a href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer">page des versions</a>).</li>
          <li>Dans l'appli, ouvrez Réglages et connectez le même compte Google Drive, ou importez le fichier JSON.</li>
        </ol>
        <p className="warnbox">Les données du profil Pokémon-Zone (Profil, Collections à thème) ne passent pas par la synchro Drive. Elles sont dans l'export JSON : si vous voulez les garder, utilisez l'export / import, ou relancez simplement le favori Pokémon-Zone depuis l'appli.</p>
      </Part>

      <Part icon="cal" title="Évènements">
        <p>Enregistrez les pages « schedule » et « upcoming » de Pokemon-Zone avec Ctrl+S, puis importez-les depuis <Link to="/evenements">Évènements</Link> avec le bouton « Import .html Pokemon-Zone ».</p>
      </Part>

      <Part icon="sync" title="Mises à jour">
        <p>Quand une nouvelle version est disponible, un bandeau « Nouvelle version disponible » apparaît : touchez « Recharger ». Si vous ne voyez rien de nouveau, fermez puis rouvrez l'appli.</p>
      </Part>

      <p className="muted"><Link to="/a-propos">À propos, sources et confidentialité</Link></p>
    </div>
  )
}
