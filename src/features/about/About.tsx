import { PageHeader } from '../../components/PageHeader'

const SOURCES: [string, string, string][] = [
  ['Pokekalos', 'https://www.pokekalos.fr/', 'images des cartes et des boosters'],
  ['Poképédia', 'https://www.pokepedia.fr/', 'logos d\'extension'],
  ['Serebii', 'https://www.serebii.net/', 'emblèmes, icônes d\'objets'],
  ['TCGdex', 'https://tcgdex.dev/', 'noms français, images'],
  ['flibustier/pokemon-tcg-pocket-database', 'https://github.com/flibustier/pokemon-tcg-pocket-database', 'cartes et taux'],
  ['PocketMads', 'https://app.pocketmads.com/tier-list', 'tier list méta, lue par l\'utilisateur'],
  ['Limitless TCG', 'https://limitlesstcg.com/', 'listes types et matchups des decks'],
  ['PokeAPI', 'https://pokeapi.co/', 'Pokédex et sprites'],
  ['Pokémon-Zone', 'https://www.pokemon-zone.com/', 'pages d\'évènements importées par l\'utilisateur'],
]

export default function About() {
  const version = __APP_VERSION__
  const build = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : ''
  return (
    <div className="page doc" data-section="grey">
      <PageHeader icon="bulb" title="À propos" sub={['Holothèque', version && `version ${version}`, build && `build ${build}`].filter(Boolean).join(' · ')} />

      <section className="card">
        <h2>Projet de fan</h2>
        <p>Holothèque est un projet de fan gratuit et non officiel. Il n'est ni affilié, ni soutenu, ni sponsorisé par Nintendo, The Pokémon Company, Creatures Inc., GAME FREAK ou DeNA. Pokémon et les noms, illustrations et logos associés sont des marques et © de leurs propriétaires respectifs.</p>
      </section>

      <section className="card">
        <h2>Appli Android</h2>
        <p>L'appli Android ne peut lire l'écran du téléphone que lorsque tu lances toi-même une capture et qu'Android te demande l'autorisation. Elle n'a aucun accès au jeu ni à ton compte. Utiliser cette fonction est ta décision, au regard des conditions d'utilisation du jeu.</p>
      </section>

      <section className="card">
        <h2>Sources et remerciements</h2>
        <ul>
          {SOURCES.map(([n, u, d]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer">{n}</a> : {d}</li>)}
        </ul>
      </section>

      <section className="card">
        <h2>Confidentialité</h2>
        <ul>
          <li>Pas de compte, pas de publicité, aucun outil de mesure d'audience ni de suivi, et aucun serveur de notre part.</li>
          <li>Tes données sont stockées uniquement dans ton navigateur (IndexedDB).</li>
          <li>Si tu actives la synchronisation, elles sont copiées dans un dossier caché de l'appli, dans ton propre Google Drive (accès « drive.appdata » : l'appli ne voit que son dossier, jamais tes autres fichiers).</li>
          <li>Le jeton de connexion Google reste en mémoire uniquement.</li>
        </ul>
        <p>Pour tout effacer : Réglages → Zone dangereuse, puis retire l'accès de l'appli sur <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</p>
      </section>

      <section className="card">
        <h2>Code source</h2>
        <p><a href="https://github.com/Camelbaggy/ptcgp-collection" target="_blank" rel="noopener noreferrer">github.com/Camelbaggy/ptcgp-collection</a></p>
        <h2>Signaler un problème</h2>
        <p><a href="https://github.com/Camelbaggy/ptcgp-collection/issues" target="_blank" rel="noopener noreferrer">github.com/Camelbaggy/ptcgp-collection/issues</a></p>
      </section>
    </div>
  )
}
