import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CardDetail } from '../../components/CardDetail'
import { normName } from '../../lib/pokedex/match'
import { DEX_RARITIES, type DexRow } from '../../lib/pokedex/aggregate'
import { RARITY_LABEL, usePersisted } from '../../lib/useData'
import type { Card } from '../../lib/types'
import { DexDetail, TypeChips } from './DexDetail'
import { RarityChips } from './RarityChips'
import { Sprite } from './Sprite'
import { TYPES } from './dexTypes'
import { usePokedex } from './usePokedex'
import './pokedex.css'

type Forms = 'all' | 'base' | 'mega' | 'regional'
const PAGE = 120

const Row = memo(function Row({ row, onOpen }: { row: DexRow; onOpen: (r: DexRow) => void }) {
  const e = row.entry
  return (
    <li>
      <button className={'dx-row' + (row.total === 0 ? ' none' : '')} onClick={() => onOpen(row)}>
        <Sprite formId={e.formId} dex={e.dex} size={56} />
        <span className="dx-main">
          <span className="dx-name"><span className="dx-num">#{String(e.dex).padStart(4, '0')}</span> <b>{e.nameFr}</b>{e.formLabelFr && <em> {e.formLabelFr}</em>}</span>
          <small className="dx-en">{e.nameEn}{e.formLabelEn ? ` · ${e.formLabelEn}` : ''}</small>
          <span className="dx-line"><TypeChips ids={e.types} /></span>
          {row.total > 0 ? <RarityChips by={row.byRarity} /> : <small className="muted">Pas de carte TCG Pocket</small>}
        </span>
        <span className={'dx-own' + (row.total > 0 && row.owned === row.total ? ' full' : '')}>{row.total > 0 ? <><b>{row.owned}</b>/{row.total}</> : '—'}</span>
      </button>
    </li>
  )
})

export default function Pokedex() {
  const { data, error, owned } = usePokedex()
  const [gen, setGen] = usePersisted<number>('dex.gen', 0)
  const [forms, setForms] = usePersisted<Forms>('dex.forms', 'all')
  const [type, setType] = usePersisted<number>('dex.type', 0)
  const [onlyTcg, setOnlyTcg] = usePersisted('dex.tcg', false)
  const [missing, setMissing] = usePersisted('dex.missing', false)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<DexRow | null>(null)
  const [card, setCard] = useState<Card | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!data) return []
    const nq = normName(q)
    const num = /^#?\d+$/.test(q.trim()) ? Number(q.trim().replace('#', '')) : null
    return data.rows.filter((r) => {
      const e = r.entry
      if (gen && e.gen !== gen) return false
      if (forms !== 'all' && e.formKind !== forms) return false
      if (type && !e.types.includes(type)) return false
      if (onlyTcg && r.total === 0) return false
      if (missing && (r.total === 0 || r.owned > 0)) return false
      if (num !== null) return e.dex === num
      if (nq) return normName(e.nameFr + (e.formLabelFr ?? '')).includes(nq) || normName(e.nameEn + (e.formLabelEn ?? '')).includes(nq)
      return true
    })
  }, [data, gen, forms, type, onlyTcg, missing, q])

  useEffect(() => { setLimit(PAGE) }, [gen, forms, type, onlyTcg, missing, q])
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setLimit((l) => l + PAGE) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length, limit])

  // Les lignes ouvertes restent à jour quand la collection change.
  const live = open && data ? data.rows.find((r) => r.entry.formId === open.entry.formId) ?? open : null
  const siblings = live && data ? data.rows.filter((r) => r.entry.dex === live.entry.dex) : []

  if (error) return <div className="page"><h1>Pokédex</h1><p className="warn">Impossible de charger le Pokédex ({error}).</p></div>
  if (!data) return <div className="page"><h1>Pokédex</h1><p className="muted">Chargement…</p></div>

  const s = data.summary
  const species = new Set(data.rows.map((r) => r.entry.dex)).size
  const speciesWithCards = new Set(data.rows.filter((r) => r.total).map((r) => r.entry.dex)).size
  const pct = s.totalCards ? Math.round((s.ownedCards / s.totalCards) * 100) : 0

  return (
    <div className="page dx">
      <h1>Pokédex</h1>
      <section className="ptc-tiles" aria-label="Résumé">
        <div className="ptc-tile"><b>{speciesWithCards} / {species}</b><span>Espèces avec carte</span></div>
        <div className="ptc-tile"><b>{s.withOwned} / {s.withCards}</b><span>Entrées avec une carte possédée</span></div>
        <div className="ptc-tile"><b>{s.ownedCards} / {s.totalCards}</b><span>Cartes Pokémon ({pct} %)</span></div>
      </section>
      <div className="dx-sum" aria-label="Totaux par rareté">
        {DEX_RARITIES.filter((r) => s.byRarity[r]).map((r) => (
          <span key={r} className={`dx-r r-${r}` + (s.byRarity[r]!.owned === s.byRarity[r]!.total ? ' done' : '')}>
            <i aria-hidden>{RARITY_LABEL[r]}</i>{s.byRarity[r]!.owned}/{s.byRarity[r]!.total}
          </span>
        ))}
      </div>

      <div className="chips scroll" role="group" aria-label="Génération">
        <button className={'chip' + (gen === 0 ? ' on' : '')} aria-pressed={gen === 0} onClick={() => setGen(0)}>Toutes</button>
        {data.gens.map((g) => (
          <button key={g} className={'chip' + (gen === g ? ' on' : '')} aria-pressed={gen === g} onClick={() => setGen(g)}>Gén. {g}</button>
        ))}
      </div>
      <input type="search" className="input" placeholder="Rechercher (nom FR/EN, numéro)…" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row">
        <select className="input" value={forms} onChange={(e) => setForms(e.target.value as Forms)} aria-label="Formes">
          <option value="all">Toutes les formes</option>
          <option value="base">De base</option>
          <option value="mega">Méga</option>
          <option value="regional">Régionales</option>
        </select>
        <select className="input" value={type} onChange={(e) => setType(Number(e.target.value))} aria-label="Type">
          <option value={0}>Tous les types</option>
          {Object.entries(TYPES).map(([id, t]) => <option key={id} value={id}>{t.fr}</option>)}
        </select>
      </div>
      <div className="chips">
        <button className={'chip' + (onlyTcg ? ' on' : '')} aria-pressed={onlyTcg} onClick={() => setOnlyTcg(!onlyTcg)}>Dans TCG Pocket</button>
        <button className={'chip' + (missing ? ' on' : '')} aria-pressed={missing} onClick={() => setMissing(!missing)}>Manquants</button>
      </div>
      <p className="muted dx-count">{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</p>

      <ul className="dx-list">
        {filtered.slice(0, limit).map((r) => <Row key={r.entry.formId} row={r} onOpen={setOpen} />)}
      </ul>
      {limit < filtered.length && (
        <div ref={sentinel}><button className="btn" onClick={() => setLimit(limit + PAGE)}>Afficher plus ({filtered.length - limit})</button></div>
      )}

      {live && <DexDetail row={live} siblings={siblings} owned={owned} onSelect={setOpen} onCard={setCard} onClose={() => setOpen(null)} />}
      {card && <CardDetail card={card} qty={owned.get(card.id) ?? 0} onClose={() => setCard(null)} />}
    </div>
  )
}
