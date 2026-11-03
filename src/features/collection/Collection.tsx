import { useMemo, useState } from 'react'
import { CardTile } from '../../components/CardTile'
import { CardDetail } from '../../components/CardDetail'
import { Filters } from '../../components/Filters'
import { matchCard, setLabel, RARITY_LABEL, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Card, Rarity } from '../../lib/types'

type Status = 'all' | 'owned' | 'missing' | 'dups'

export default function Collection() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const [setId, setSetId] = usePersisted('col.setId', '')
  const [status, setStatus] = useState<Status>('all')
  const [view, setView] = usePersisted<'grid' | 'list'>('col.view', 'grid')
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [open, setOpen] = useState<Card | null>(null)

  const groups = useMemo(() => {
    const out: { id: string; name: string; owned: number; total: number; cards: Card[] }[] = []
    for (const s of sets) {
      if (setId && s.id !== setId) continue
      const all = cards.filter((c) => c.setId === s.id)
      const have = all.filter((c) => (owned.get(c.id) ?? 0) > 0).length
      const list = all.filter((c) => {
        const n = owned.get(c.id) ?? 0
        if (status === 'owned' && n < 1) return false
        if (status === 'missing' && n > 0) return false
        if (status === 'dups' && n < 2) return false
        return matchCard(c, q, rarities)
      })
      out.push({ id: s.id, name: s.name, owned: have, total: all.length, cards: list })
    }
    return out
  }, [sets, cards, owned, setId, status, q, rarities])

  const live = open ? cards.find((c) => c.id === open.id) ?? open : null

  return (
    <div className="page">
      <h1>Collection</h1>
      <div className="row">
        <select className="input" value={setId} onChange={(e) => setSetId(e.target.value)} aria-label="Extension">
          <option value="">Toutes les extensions</option>
          {sets.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Statut">
          <option value="all">Toutes</option>
          <option value="owned">Possédées</option>
          <option value="missing">Manquantes</option>
          <option value="dups">Doublons (≥ 2)</option>
        </select>
        <button className="btn" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? 'Liste' : 'Grille'}</button>
      </div>
      <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
      {groups.map((g) => (
        <section key={g.id} className="group">
          <h2>{setLabel(g)} <small>{g.owned}/{g.total}</small></h2>
          <div className="bar"><i style={{ width: `${g.total ? (100 * g.owned) / g.total : 0}%` }} /></div>
          {view === 'grid' ? (
            <div className="grid">
              {g.cards.map((c) => (
                <CardTile key={c.id} card={c} count={owned.get(c.id)} dim={!owned.get(c.id)} showName onClick={() => setOpen(c)} />
              ))}
            </div>
          ) : (
            <ul className="list">
              {g.cards.map((c) => {
                const n = owned.get(c.id) ?? 0
                return (
                  <li key={c.id}>
                    <button className={'list-item' + (n ? '' : ' dim')} onClick={() => setOpen(c)}>
                      <span className="mono">{c.id}</span><span className="grow">{c.name}</span>
                      <span>{RARITY_LABEL[c.rarity]}</span><b>{n}</b>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {!g.cards.length && <p className="muted">Rien à afficher.</p>}
        </section>
      ))}
      {live && <CardDetail card={live} qty={owned.get(live.id) ?? 0} onClose={() => setOpen(null)} />}
    </div>
  )
}
