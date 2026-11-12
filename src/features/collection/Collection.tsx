import { useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { CardTile } from '../../components/CardTile'
import { CardDetail } from '../../components/CardDetail'
import { Filters } from '../../components/Filters'
import { tradeOffers } from '../../lib/calc/offers'
import { matchCard, setLabel, RARITY_LABEL, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Card, CardSet, Rarity } from '../../lib/types'

type Status = 'all' | 'owned' | 'missing' | 'dups' | 'trade'
const MAX_AUTO = 600
const STATUS_CHIPS: [Status, string][] = [['all', 'Toutes'], ['owned', 'Possédées'], ['missing', 'Manquantes'], ['dups', 'Doublons'], ['trade', 'Échangeables']]

const isPromoSet = (id: string) => /^(P-|SP)/.test(id)
/** Extensions de la plus récente à la plus ancienne ; les séries promo à la fin. */
const recentFirst = (sets: CardSet[]) => [...sets].sort((a, b) => Number(isPromoSet(a.id)) - Number(isPromoSet(b.id)) || b.order - a.order)

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
  const [manual, setManual] = useState<{ key: string; map: Record<string, boolean> }>({ key: '', map: {} })

  // Cartes que les règles d'échange de l'accueil proposent (même calcul que « Échangeables »).
  const tradeIds = useMemo(() => new Set(tradeOffers(cards, owned).map((o) => o.card.id)), [cards, owned])

  const groups = useMemo(() => {
    const out: { id: string; name: string; owned: number; total: number; cards: Card[] }[] = []
    for (const s of recentFirst(sets)) {
      if (setId && s.id !== setId) continue
      const all = cards.filter((c) => c.setId === s.id)
      const have = all.filter((c) => (owned.get(c.id) ?? 0) > 0).length
      const list = all.filter((c) => {
        const n = owned.get(c.id) ?? 0
        if (status === 'owned' && n < 1) return false
        if (status === 'missing' && n > 0) return false
        if (status === 'dups' && n < 2) return false
        if (status === 'trade' && !tradeIds.has(c.id)) return false
        return matchCard(c, q, rarities)
      })
      out.push({ id: s.id, name: s.name, owned: have, total: all.length, cards: list })
    }
    return out
  }, [sets, cards, owned, setId, status, q, rarities, tradeIds])

  // Une extension ouverte à la fois par défaut (la plus récente) ; avec une recherche ou un filtre,
  // les extensions qui ont des résultats s'ouvrent, dans la limite de MAX_AUTO cartes affichées.
  const filtering = status !== 'all' || q.trim() !== '' || rarities.length > 0
  const key = `${setId}|${status}|${q}|${rarities.join(',')}`
  const overrides = manual.key === key ? manual.map : {}
  const openIds = useMemo(() => {
    const ids = new Set<string>()
    if (setId) { ids.add(setId); return ids }
    if (!filtering) {
      if (groups[0]) ids.add(groups[0].id)
      return ids
    }
    let shown = 0
    for (const g of groups) {
      if (g.cards.length && shown + g.cards.length <= MAX_AUTO) { ids.add(g.id); shown += g.cards.length }
    }
    return ids
  }, [groups, setId, filtering])
  const isOpen = (id: string) => overrides[id] ?? openIds.has(id)
  const toggle = (id: string) => setManual({ key, map: { ...overrides, [id]: !isOpen(id) } })

  const total = useMemo(() => groups.reduce((a, g) => ({ owned: a.owned + g.owned, total: a.total + g.total }), { owned: 0, total: 0 }), [groups])
  const live = open ? cards.find((c) => c.id === open.id) ?? open : null

  return (
    <div className="page" data-section="blue">
      <PageHeader icon="grid" title="Collection" sub={`${total.owned} / ${total.total} cartes`}>
        <button className="btn" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}><Icon name={view === 'grid' ? 'book' : 'grid'} />{view === 'grid' ? 'Liste' : 'Grille'}</button>
      </PageHeader>
      <div className="row">
        {setId && <SetLogo setId={setId} name={sets.find((s) => s.id === setId)?.name} />}
        <label className="fl-field"><span className="fl-label">Extension</span>
          <select className="input" value={setId} onChange={(e) => setSetId(e.target.value)}>
            <option value="">Toutes les extensions</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
          </select>
        </label>
      </div>
      <span className="fl-label" aria-hidden="true">Cartes</span>
      <div className="chips" role="group" aria-label="Statut des cartes">
        {STATUS_CHIPS.map(([v, label]) => (
          <button key={v} className={'chip' + (status === v ? ' on' : '')} aria-pressed={status === v} onClick={() => setStatus(v)}>{label}</button>
        ))}
      </div>
      <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} showLabel />
      {groups.map((g) => (
        <section key={g.id} className="group card">
          <h2 className="set-head">
            <button className="set-toggle" aria-expanded={isOpen(g.id)} onClick={() => toggle(g.id)}>
              <SetLogo setId={g.id} name={g.name} small fallback={null} />
              <span>{setLabel(g)} <small>{g.owned}/{g.total}{filtering ? ` · ${g.cards.length} affichée${g.cards.length > 1 ? 's' : ''}` : ''}</small></span>
              <Icon name={isOpen(g.id) ? 'down' : 'chev'} />
            </button>
          </h2>
          <div className="bar"><i style={{ width: `${g.total ? (100 * g.owned) / g.total : 0}%` }} /></div>
          {isOpen(g.id) && (<>
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
          {!g.cards.length && <EmptyState icon="search" title="Rien à afficher" text="Aucune carte ne correspond aux filtres." />}
          </>)}
        </section>
      ))}
      {live && <CardDetail card={live} qty={owned.get(live.id) ?? 0} onClose={() => setOpen(null)} />}
    </div>
  )
}
