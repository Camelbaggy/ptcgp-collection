import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { HashRouter, NavLink, Route, Routes, Link, useLocation } from 'react-router-dom'
import { seedIfNeeded } from './lib/db'
import { ToastProvider } from './components/Toast'
import { NewCardReveal } from './components/NewCardReveal'
import { UpdateBanner } from './components/UpdateBanner'
import Dashboard from './features/dashboard/Dashboard'
import Stats from './features/stats/Stats'
import AddPack from './features/add-pack/AddPack'
import Share from './features/share/Share'
import Trade from './features/trade/Trade'
import Collection from './features/collection/Collection'
import WishlistScreen from './features/wishlist/Wishlist'
import NewSet from './features/new-set/NewSet'
import SetRates from './features/new-set/SetRates'
import Settings from './features/settings/Settings'
import Meta from './features/meta/Meta'
import Events from './features/events/Events'
import Pokedex from './features/pokedex/Pokedex'
import SyncController from './features/sync/SyncController'
import { Icon, type IconName } from './components/Icon'
import SyncStatusIcon from './features/sync/SyncStatusIcon'

interface NavDef { to: string; label: string; icon: IconName; color: string }
const HOME: NavDef = { to: '/', label: 'Accueil', icon: 'home', color: 'var(--violet)' }
const ADD: NavDef = { to: '/ajout', label: 'Ajouter un pack', icon: 'plus', color: 'var(--green)' }
const GROUPS: { title: string; items: NavDef[] }[] = [
  { title: 'Ma collection', items: [
    { to: '/collection', label: 'Collection', icon: 'grid', color: 'var(--blue)' },
    { to: '/pokedex', label: 'Pokédex', icon: 'book', color: 'var(--teal)' },
    { to: '/souhaits', label: 'Souhaits', icon: 'heart', color: 'var(--pink)' },
  ] },
  { title: 'Entre amis', items: [
    { to: '/echange', label: 'Échange', icon: 'swap', color: 'var(--orange)' },
    { to: '/partage', label: 'Partage', icon: 'gift', color: 'var(--pink)' },
  ] },
  { title: 'Le jeu', items: [
    { to: '/evenements', label: 'Évènements', icon: 'cal', color: 'var(--yellow)' },
    { to: '/meta', label: 'Méta', icon: 'trophy', color: 'var(--red)' },
    { to: '/stats', label: 'Statistiques', icon: 'chart', color: 'var(--violet)' },
  ] },
  { title: 'Plus', items: [
    { to: '/extension/nouvelle', label: 'Nouvelle extension', icon: 'layers', color: 'var(--grey)' },
    { to: '/reglages', label: 'Réglages', icon: 'gear', color: 'var(--grey)' },
  ] },
]
/** Pages regroupées sous l'onglet « Plus » de la barre du bas. */
const MORE_PATHS = ['/plus', '/pokedex', '/souhaits', '/partage', '/evenements', '/meta', '/stats', '/extension', '/reglages']

function More() {
  return (
    <div className="page">
      <h1>Plus</h1>
      {GROUPS.map((g) => (
        <div key={g.title} className="list">
          <div className="more-sec">{g.title}</div>
          {g.items.filter((m) => m.to !== '/collection' && m.to !== '/echange').map((m) => (
            <Link key={m.to} to={m.to} className="more-item" style={{ '--c': m.color } as CSSProperties}>
              <span className="tile-ic"><Icon name={m.icon} /></span>{m.label}<Icon name="chev" className="chev" />
            </Link>
          ))}
        </div>
      ))}
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
  return (
    <div className="shell">
      <nav className="side" aria-label="Navigation principale">
        <div className="brand"><span className="logo"><Icon name="layers" /></span>PTCGP</div>
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
        <TabItem n={{ to: '/echange', label: 'Échange', icon: 'swap', color: 'var(--orange)' }} />
        <NavLink to="/plus" className={({ isActive }) => 'tb' + (isActive || moreActive ? ' active' : '')} style={{ '--c': 'var(--pink)' } as CSSProperties}>
          <span className="t"><Icon name="more" /></span>Plus
        </NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ajout" element={<AddPack />} />
          <Route path="/partage" element={<Share />} />
          <Route path="/echange" element={<Trade />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/evenements" element={<Events />} />
          <Route path="/meta" element={<Meta />} />
          <Route path="/pokedex" element={<Pokedex />} />
          <Route path="/souhaits" element={<WishlistScreen />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/extension/nouvelle" element={<NewSet />} />
          <Route path="/extension/:setId/taux" element={<SetRates />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="/plus" element={<More />} />
          <Route path="*" element={<More />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    seedIfNeeded().then(() => setReady(true), (e) => setError(String(e?.message ?? e)))
  }, [])
  if (error) return <div className="page"><h1>Erreur</h1><p>{error}</p></div>
  if (!ready) return <div className="page"><p className="muted">Chargement des données…</p></div>
  return (
    <ToastProvider>
      <SyncController />
      <HashRouter>
        <SyncStatusIcon />
        <Shell />
      </HashRouter>
      <NewCardReveal />
      <UpdateBanner />
    </ToastProvider>
  )
}
