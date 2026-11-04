import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, Link } from 'react-router-dom'
import { seedIfNeeded } from './lib/db'
import { ToastProvider } from './components/Toast'
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
import SyncStatusIcon from './features/sync/SyncStatusIcon'

const MAIN = [
  { to: '/', label: 'Accueil', icon: '⌂' },
  { to: '/ajout', label: 'Ajout', icon: '＋' },
  { to: '/partage', label: 'Partage', icon: '🎁' },
  { to: '/echange', label: 'Échange', icon: '⇄' },
  { to: '/collection', label: 'Collection', icon: '▦' },
]
const MORE = [
  { to: '/evenements', label: 'Évènements', icon: '📅' },
  { to: '/meta', label: 'Méta', icon: '🏆' },
  { to: '/pokedex', label: 'Pokédex', icon: '📖' },
  { to: '/souhaits', label: 'Souhaits', icon: '♥' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/extension/nouvelle', label: 'Nouvelle extension', icon: '✚' },
  { to: '/reglages', label: 'Réglages', icon: '⚙' },
]

function More() {
  return (
    <div className="page">
      <h1>Plus</h1>
      <div className="list">
        {MORE.map((m) => <Link key={m.to} to={m.to} className="list-item">{m.icon} {m.label}</Link>)}
      </div>
    </div>
  )
}

function Shell() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Navigation principale">
        <div className="brand">PTCGP</div>
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-item">
            <span className="nav-ico" aria-hidden>{n.icon}</span><span>{n.label}</span>
          </NavLink>
        ))}
        <span className="nav-desktop-only">
          {MORE.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-item">
              <span className="nav-ico" aria-hidden>{n.icon}</span><span>{n.label}</span>
            </NavLink>
          ))}
        </span>
        <NavLink to="/plus" className="nav-item nav-mobile-only">
          <span className="nav-ico" aria-hidden>…</span><span>Plus</span>
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
      <UpdateBanner />
    </ToastProvider>
  )
}
