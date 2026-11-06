import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Icon, type IconName } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { pzPlayerFromUrl } from '../../lib/importers/pzCollection'
import { usePersisted } from '../../lib/useData'
import { useState } from 'react'
import { PzBookmarkletInstall } from '../add-pack/PzBookmarklet'

interface Step { icon: IconName; title: string; short: string }
const STEPS: Step[] = [
  { icon: 'user', title: 'Créer un compte Pokémon-Zone', short: 'Compte' },
  { icon: 'sync', title: 'Synchroniser son compte de jeu', short: 'Synchro' },
  { icon: 'ext', title: 'Donner son profil à Holothèque', short: 'Profil' },
  { icon: 'star', title: 'Installer le favori', short: 'Favori' },
  { icon: 'bolt', title: 'Lancer le favori', short: 'Lancer' },
  { icon: 'check', title: 'Vérifier et enregistrer', short: 'Enregistrer' },
]

function Menu() {
  return (
    <div className="pzg-mock" aria-label="Aperçu du menu du favori">
      <div className="pzg-mock-h">Holothèque : que veux-tu importer ?</div>
      <div className="pzg-mock-b main">Tout : extensions, accueil, stats, collections à thème, souhaits (quelques minutes)</div>
      <div className="pzg-mock-b">Mise à jour rapide : accueil et souhaits + extension A1</div>
      <div className="pzg-mock-b">Seulement l'extension A1</div>
      <div className="pzg-mock-b">Annuler</div>
    </div>
  )
}

function BookmarksBar() {
  return (
    <div className="pzg-bar" aria-hidden="true">
      <span className="pzg-bar-dot" /><span className="pzg-bar-dot" /><span className="pzg-bar-dot" />
      <span className="pzg-bar-url">pokemon-zone.com/players/…</span>
      <span className="pzg-bar-fav"><Icon name="star" />Holothèque</span>
    </div>
  )
}

function Pick({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return <div className="pzg-pick"><b>{title}</b><span className="pzg-tag">{tag}</span><p>{children}</p></div>
}

export default function PzGuide() {
  const [player, setPlayer] = usePersisted('pz.player', '')
  const [step, setStep] = usePersisted('pzguide.step', 0)
  const [url, setUrl] = useState('')
  const toast = useToast()
  const cur = Math.min(Math.max(0, step), STEPS.length - 1)
  const done = [false, false, !!player, false, false, false]
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0 }) }
  const profile = player ? `https://www.pokemon-zone.com/players/${encodeURIComponent(player)}/` : ''

  const body: ReactNode[] = [
    <>
      <p>Pokémon-Zone (pokemon-zone.com) est un site de la communauté qui affiche ta collection Pokémon TCG Pocket. Holothèque s'appuie sur ses pages pour récupérer tes cartes, ton profil et tes souhaits, sans que tu aies à tout retaper.</p>
      <ol className="pzg-list">
        <li>Ouvre pokemon-zone.com et crée un compte (gratuit).</li>
        <li>Relie ton compte de jeu en suivant les instructions du site.</li>
      </ol>
      <p className="pzg-note"><Icon name="check" />Cette étape se fait sur le site de Pokémon-Zone, selon ses règles. Holothèque ne touche jamais à ton compte Nintendo : elle lit seulement les pages que Pokémon-Zone t'affiche, dans ton propre navigateur.</p>
      <a className="btn" href="https://www.pokemon-zone.com/" target="_blank" rel="noopener noreferrer"><Icon name="ext" />Ouvrir Pokémon-Zone</a>
    </>,
    <>
      <p>Sur Pokémon-Zone, lance la synchronisation de ton compte de jeu : le site met alors à jour ta collection, ton profil et tes souhaits.</p>
      <p className="pzg-note"><Icon name="warn" />À refaire après chaque ouverture de boosters. Les données que lit Holothèque ne sont jamais plus fraîches que la dernière synchronisation sur le site.</p>
      {profile && <a className="btn" href={profile} target="_blank" rel="noopener noreferrer"><Icon name="ext" />Ouvrir mon profil</a>}
    </>,
    <>
      <p>Ouvre ton profil sur Pokémon-Zone et copie l'adresse de la page. Elle ressemble à <code>pokemon-zone.com/players/…/</code>. Colle-la ici, l'appli la retient.</p>
      {player ? (
        <div className="pzg-done">
          <span><Icon name="check" />Profil enregistré</span>
          <a className="btn" href={profile} target="_blank" rel="noopener noreferrer"><Icon name="ext" />Ouvrir mon profil</a>
          <button className="btn ghost" onClick={() => setPlayer('')}>Changer</button>
        </div>
      ) : (
        <>
          <div className="row">
            <input className="input" inputMode="url" placeholder="Adresse de ton profil Pokémon-Zone" aria-label="Adresse de ton profil Pokémon-Zone" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn primary" disabled={!pzPlayerFromUrl(url)} onClick={() => { setPlayer(pzPlayerFromUrl(url) ?? ''); toast('Profil enregistré') }}>OK</button>
          </div>
          {url && !pzPlayerFromUrl(url) && <p className="muted small">Adresse non reconnue : elle doit contenir pokemon-zone.com/players/…</p>}
        </>
      )}
    </>,
    <>
      <p>Un favori est un petit programme enregistré comme un marque-page. Lancé sur ton profil Pokémon-Zone, il lit tes pages à ta place puis te ramène dans Holothèque. Il ne fait que lire, rien n'est envoyé à un serveur.</p>
      <BookmarksBar />
      <PzBookmarkletInstall />
    </>,
    <>
      <p>Ouvre ton profil sur Pokémon-Zone (étape 3), puis lance le favori <b>Holothèque</b> : clique dessus sur PC, ou tape son nom dans la barre d'adresse sur téléphone. Un menu apparaît sur la page :</p>
      <Menu />
      <div className="pzg-picks">
        <Pick title="Tout" tag="La première fois">Toutes les extensions, l'accueil, les stats, les collections à thème et les souhaits. Compte quelques minutes ; utile aussi après la sortie d'une nouvelle extension, quand tout le monde ouvre beaucoup de boosters.</Pick>
        <Pick title="Mise à jour rapide" tag="Au quotidien">L'accueil, les souhaits et l'extension affichée à l'écran. Le bon choix après quelques ouvertures de boosters.</Pick>
        <Pick title="Seulement l'extension" tag="Au plus court">Uniquement l'extension dont tu es sur la page.</Pick>
      </div>
      <p className="muted small">Laisse la page ouverte pendant la lecture : une fenêtre de progression s'affiche, puis Holothèque s'ouvre toute seule.</p>
    </>,
    <>
      <p>Holothèque s'ouvre sur un écran de vérification. Elle n'affiche que ce qui change, et signale les baisses de quantité (souvent le signe d'une synchronisation en retard). Corrige si besoin puis touche <b>Enregistrer</b>.</p>
      <ul className="pzg-where">
        <li><Icon name="cards" /><span><b>Collection</b> : les quantités sont enregistrées en une seule correction, que tu peux annuler.</span></li>
        <li><Icon name="user" /><span><b>Profil</b> : ton profil de joueur, <Link to="/profil">à retrouver ici</Link>.</span></li>
        <li><Icon name="medal" /><span><b>Collections à thème</b> : <Link to="/collections-a-theme">à retrouver ici</Link>.</span></li>
        <li><Icon name="heart" /><span><b>Souhaits</b> : les nouveaux sont ajoutés, tes priorités existantes ne changent pas.</span></li>
        <li><Icon name="chart" /><span><b>Statistiques</b> : l'appli continue ensuite de les tenir à jour à chaque ajout.</span></li>
      </ul>
      <Link to="/ajout?onglet=pz" className="btn primary"><Icon name="upload" />Aller à l'import</Link>
    </>,
  ]

  return (
    <main className="page pzg" data-section="green">
      <PageHeader icon="sync" title="Importer depuis Pokémon-Zone" sub="Guide pas à pas" />

      <nav className="pzg-steps" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <button key={s.title} type="button" className={`pzg-dot${i === cur ? ' on' : ''}${done[i] ? ' done' : ''}`} aria-current={i === cur ? 'step' : undefined} aria-label={`Étape ${i + 1} : ${s.title}${done[i] ? ' (faite)' : ''}`} onClick={() => go(i)}>
            <span>{done[i] ? <Icon name="check" /> : i + 1}</span><small>{s.short}</small>
          </button>
        ))}
      </nav>
      <div className="pzg-prog" aria-hidden="true"><i style={{ width: `${((cur + 1) / STEPS.length) * 100}%` }} /></div>

      <section className="card pzg-card" aria-labelledby="pzg-t">
        <p className="pzg-count">Étape {cur + 1} sur {STEPS.length}{done[cur] ? ' · faite' : ''}</p>
        <h2 id="pzg-t"><span className="tile-ic"><Icon name={STEPS[cur].icon} /></span>{STEPS[cur].title}</h2>
        {body[cur]}
        <div className="pzg-nav">
          <button className="btn" disabled={cur === 0} onClick={() => go(cur - 1)}><Icon name="chevl" />Précédent</button>
          {cur < STEPS.length - 1
            ? <button className="btn primary" onClick={() => go(cur + 1)}>Suivant<Icon name="chev" /></button>
            : <button className="btn" onClick={() => go(0)}>Revoir depuis le début</button>}
        </div>
      </section>

      <details className="card pzg-more">
        <summary><Icon name="download" />Sans favori : importer des pages enregistrées</summary>
        <div className="body">
          <p>Si le favori ne fonctionne pas chez toi, tu peux enregistrer les pages toi-même.</p>
          <ol className="pzg-list">
            <li>Sur ton profil Pokémon-Zone, ouvre la page voulue (accueil, stats, collections à thème, souhaits, ou une extension du profil).</li>
            <li>Enregistre-la : Ctrl+S sur PC, ou « Télécharger la page » dans le menu du navigateur sur téléphone.</li>
            <li>Dans <Link to="/ajout?onglet=pz">Ajout › Import › Pokémon-Zone</Link>, choisis les fichiers enregistrés.</li>
          </ol>
          <p className="muted small">Une page d'extension n'affiche que 60 cartes par clic sur « Load More » : clique jusqu'au bout avant d'enregistrer, sinon Holothèque te prévient que la page est incomplète.</p>
        </div>
      </details>

      <details className="card pzg-more">
        <summary><Icon name="help" />Questions fréquentes</summary>
        <div className="body">
          <h4>C'est gratuit ?</h4>
          <p>Oui, Holothèque comme le compte Pokémon-Zone.</p>
          <h4>Mes données partent-elles sur un serveur ?</h4>
          <p>Non. Le favori lit les pages dans ton navigateur et passe les données à Holothèque dans la partie de l'adresse après le « # », qui n'est jamais envoyée sur le réseau. L'appli l'efface de l'adresse dès l'arrivée.</p>
          <h4>Mes données sont-elles à jour ?</h4>
          <p>Elles valent la dernière synchronisation faite sur Pokémon-Zone (étape 2). Après des boosters, resynchronise puis relance le favori.</p>
          <h4>Que veut dire « page incomplète » ?</h4>
          <p>La lecture s'est arrêtée avant la fin d'une extension. Les cartes absentes restent inchangées ; relance simplement le favori.</p>
          <h4>Et sur mon autre appareil ?</h4>
          <p>Les instantanés du profil (accueil, stats, collections à thème) restent pour l'instant sur l'appareil où tu les as importés. La collection, elle, suit avec la synchronisation Google Drive.</p>
        </div>
      </details>
    </main>
  )
}
