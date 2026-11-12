import { Fragment, Suspense, lazy, useEffect, useState, type CSSProperties } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import { seedIfNeeded } from './lib/db'
import { ToastProvider } from './components/Toast'
const NewCardReveal = lazy(() => import('./components/NewCardReveal').then((m) => ({ default: m.NewCardReveal })))
import { UpdateBanner } from './components/UpdateBanner'
const GlobalSearch = lazy(() => import('./components/GlobalSearch'))
import { GlobalSearchContext } from './components/globalSearchContext'
import { PzSyncBar } from './components/PzSyncBar'
import Dashboard from './features/dashboard/Dashboard'
const Stats = lazy(() => import('./features/stats/Stats'))
const AddPack = lazy(() => import('./features/add-pack/AddPack'))
const Exchange = lazy(() => import('./features/exchange/Exchange'))
const Collection = lazy(() => import('./features/collection/Collection'))
const WishlistScreen = lazy(() => import('./features/wishlist/Wishlist'))
const NewSet = lazy(() => import('./features/new-set/NewSet'))
const SetRates = lazy(() => import('./features/new-set/SetRates'))
const Settings = lazy(() => import('./features/settings/Settings'))
const History = lazy(() => import('./features/history/History'))
const Meta = lazy(() => import('./features/meta/Meta'))
const Events = lazy(() => import('./features/events/Events'))
const Pokedex = lazy(() => import('./features/pokedex/Pokedex'))
const Help = lazy(() => import('./features/help/Help'))
const About = lazy(() => import('./features/about/About'))
const Profile = lazy(() => import('./features/profile/Profile'))
const Themed = lazy(() => import('./features/themed/Themed'))
const PzGuide = lazy(() => import('./features/pz-guide/PzGuide'))
import { InstallButton } from './components/InstallButton'
const BackupController = lazy(() => import('./features/settings/BackupController'))
const SyncController = lazy(() => import('./features/sync/SyncController'))
import { Icon, type IconName } from './components/Icon'
import { PageHeader } from './components/PageHeader'
import { ErrorBoundary } from './components/ErrorBoundary'
import SyncStatusIcon from './features/sync/SyncStatusIcon'
import { statusLabel, useSyncState } from './features/sync/useSync'

interface NavDef { to: string; label: string; icon: IconName; color: string }
const HOME: NavDef = { to: '/', label: 'Accueil', icon: 'home', color: 'var(--violet)' }
const ADD: NavDef = { to: '/ajout', label: 'Ajouter un pack', icon: 'plus', color: 'var(--green)' }
const GROUPS: { title: string; items: NavDef[] }[] = [
  { title: 'Ma collection', items: [
    { to: '/collection', label: 'Collection', icon: 'grid', color: 'var(--blue)' },
    { to: '/pokedex', label: 'Pokédex', icon: 'book', color: 'var(--teal)' },
    { to: '/souhaits', label: 'Souhaits', icon: 'heart', color: 'var(--pink)' },
    { to: '/collections-a-theme', label: 'Collections à thème', icon: 'medal', color: 'var(--teal)' },
    { to: '/historique', label: 'Historique', icon: 'history', color: 'var(--green)' },
  ] },
  { title: 'Entre amis', items: [
    { to: '/echange-partage', label: 'Échange et partage', icon: 'swap', color: 'var(--orange)' },
  ] },
  { title: 'Le jeu', items: [
    { to: '/evenements', label: 'Évènements', icon: 'cal', color: 'var(--yellow)' },
    { to: '/meta', label: 'Méta', icon: 'trophy', color: 'var(--red)' },
    { to: '/stats', label: 'Statistiques', icon: 'chart', color: 'var(--violet)' },
    { to: '/profil', label: 'Profil', icon: 'user', color: 'var(--blue)' },
  ] },
  { title: 'Plus', items: [
    { to: '/extension/nouvelle', label: 'Nouvelle extension', icon: 'layers', color: 'var(--grey)' },
    { to: '/reglages', label: 'Réglages', icon: 'gear', color: 'var(--grey)' },
    { to: '/aide', label: 'Aide', icon: 'help', color: 'var(--grey)' },
    { to: '/a-propos', label: 'À propos', icon: 'bulb', color: 'var(--grey)' },
  ] },
]
/** Pages regroupées sous l'onglet « Plus » de la barre du bas. */
const MORE_PATHS = ['/plus', '/pokedex', '/souhaits', '/evenements', '/meta', '/stats', '/historique', '/extension', '/reglages', '/aide', '/a-propos', '/profil', '/collections-a-theme', '/guide-pokemon-zone']

function More() {
  const sync = useSyncState()
  return (
    <div className="page" data-section="pink">
      <PageHeader icon="more" title="Plus" sub="Toutes les autres sections de l'appli" />
      <Link to="/reglages" className="more-item" style={{ '--c': 'var(--grey)' } as CSSProperties}>
        <span className="tile-ic"><Icon name={sync.enabled ? 'cloud' : 'cloudoff'} /></span>
        <span>Synchronisation<small>{statusLabel(sync)}</small></span>
        {sync.enabled && <span className={`sync-dot sync-${sync.phase}`} aria-hidden="true" />}
        <Icon name="chev" className="chev" />
      </Link>
      {GROUPS.map((g) => (
        <div key={g.title} className="list">
          <div className="more-sec">{g.title}</div>
          {g.items.filter((m) => m.to !== '/collection' && m.to !== '/echange-partage').map((m) => (
            <Link key={m.to} to={m.to} className="more-item" style={{ '--c': m.color } as CSSProperties}>
              <span className="tile-ic"><Icon name={m.icon} /></span>{m.label}<Icon name="chev" className="chev" />
            </Link>
          ))}
        </div>
      ))}
      <InstallButton className="btn big" />
    </div>
  )
}

function SideItem({ n, prominent }: { n: NavDef; prominent?: boolean }) {
  return (
    <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => 'ni' + (prominent ? ' prominent' : '') + (isActive ? ' active' : '')} style={{ '--c': n.color } as CSSProperties}>
      <span className="t"><Icon name={n.icon} /></span>{n.label}
    </NavLink>
  )
}

function TabItem({ n, label, plus, forceActive }: { n: NavDef; label?: string; plus?: boolean; forceActive?: boolean }) {
  return (
    <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => 'tb' + (plus ? ' plus' : '') + (isActive || forceActive ? ' active' : '')} style={{ '--c': n.color } as CSSProperties}>
      <span className="t"><Icon name={n.icon} /></span>{label ?? n.label}
    </NavLink>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const moreActive = MORE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    // Ctrl/Cmd+K ouvre la recherche ; « / » aussi hors d'un champ de saisie.
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <GlobalSearchContext.Provider value={() => setSearching(true)}>
    <div className="shell">
      <nav className="side" aria-label="Navigation principale">
        <div className="brand"><img className="logo" src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" />Holothèque</div>
        <button type="button" className="ni" onClick={() => setSearching(true)} aria-label="Rechercher une carte">
          <span className="t"><Icon name="search" /></span>Rechercher
        </button>
        <SideItem n={HOME} />
        <SideItem n={ADD} prominent />
        {GROUPS.map((g) => (
          <Fragment key={g.title}>
            <div className="sec">{g.title}</div>
            {g.items.map((n) => <SideItem key={n.to} n={n} />)}
          </Fragment>
        ))}
      </nav>
      <nav className="tabs" aria-label="Navigation principale">
        <TabItem n={HOME} />
        <TabItem n={{ to: '/collection', label: 'Cartes', icon: 'grid', color: 'var(--blue)' }} />
        <TabItem n={ADD} label="Ajout" plus />
        <TabItem n={{ to: '/echange-partage', label: 'Échanges', icon: 'swap', color: 'var(--orange)' }} />
        <NavLink to="/plus" className={({ isActive }) => 'tb' + (isActive || moreActive ? ' active' : '')} style={{ '--c': 'var(--pink)' } as CSSProperties}>
          <span className="t"><Icon name="more" /></span>Plus
        </NavLink>
      </nav>
      <main className="main">
        <ErrorBoundary>
        <Suspense fallback={<div className="page" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ajout" element={<AddPack />} />
          <Route path="/echange-partage" element={<Exchange />} />
          <Route path="/echange" element={<Navigate to="/echange-partage?onglet=echange" replace />} />
          <Route path="/partage" element={<Navigate to="/echange-partage?onglet=partage" replace />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/evenements" element={<Events />} />
          <Route path="/meta" element={<Meta />} />
          <Route path="/pokedex" element={<Pokedex />} />
          <Route path="/souhaits" element={<WishlistScreen />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/extension/nouvelle" element={<NewSet />} />
          <Route path="/extension/:setId/taux" element={<SetRates />} />
          <Route path="/historique" element={<History />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="/aide" element={<Help />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/collections-a-theme" element={<Themed />} />
          <Route path="/guide-pokemon-zone" element={<PzGuide />} />
          <Route path="/plus" element={<More />} />
          <Route path="*" element={<More />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      {searching && <Suspense fallback={null}><GlobalSearch onClose={() => setSearching(false)} /></Suspense>}
    </div>
    </GlobalSearchContext.Provider>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    seedIfNeeded().then(() => setReady(true), (e) => setError(String(e?.message ?? e)))
  }, [])
  if (error) return <div className="page"><h1>Erreur</h1><p>{error}</p><button className="btn" onClick={() => location.reload()}>Réessayer</button></div>
  if (!ready) return <div className="page"><p className="muted">Chargement des données…</p></div>
  return (
    <ToastProvider>
      <Suspense fallback={null}><SyncController /></Suspense>
      <Suspense fallback={null}><BackupController /></Suspense>
      <HashRouter>
        <SyncStatusIcon />
        <Shell />
        <PzSyncBar />
      </HashRouter>
      <Suspense fallback={null}><NewCardReveal /></Suspense>
      <UpdateBanner />
    </ToastProvider>
  )
}
