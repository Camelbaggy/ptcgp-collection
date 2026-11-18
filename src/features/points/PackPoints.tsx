import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardThumb } from '../../components/CardTile'
import { CardDetail } from '../../components/CardDetail'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import type { HelpBlock } from '../../components/HelpSheet'
import { SetLogo } from '../../components/Brand'
import { BUYABLE_RARITIES, DEFAULT_POINT_COSTS, packsForPoints, planSet, type PlanItem, type PointCosts } from '../../lib/calc'
import { computeBaseline } from '../../lib/pzProfile/baseline'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import { setIdOf } from '../../lib/setId'
import type { Card, Rarity } from '../../lib/types'
import { RARITY_LABEL, isSpecialSetId, useBoosters, useCards, useHistory, useOwned, usePersisted, useRates, useSets } from '../../lib/useData'
import './points.css'

const nf = new Intl.NumberFormat('fr-FR')
const packs = (n: number) => (Number.isFinite(n) ? `≈ ${nf.format(Math.max(1, Math.round(n)))} pack${Math.round(n) > 1 ? 's' : ''}` : 'jamais tirée')
const PAGE = 30

const HELP: HelpBlock[] = [
  { title: 'À quoi ça sert', text: "Ce que tu peux acheter avec tes points, ce qu'il te manque, et quand il vaut mieux ouvrir des packs." },
  { title: 'Acheter ou ouvrir', text: "« Acheter » quand les points d'une carte (prix ÷ 5 packs) coûtent moins de packs que d'en ouvrir jusqu'à la tirer ; « Ouvrir » sinon, tu l'auras en chemin." },
  { title: 'Conseillé avec ton solde', text: 'Les cartes les plus longues à obtenir en ouvrant des packs, par rapport à leur prix.' },
  { title: 'Solde', text: "Saisis ton solde (écran « Échange de points Booster » du jeu) ou importe ton profil Pokémon-Zone. Chaque pack ouvert rapporte 5 points." },
  { title: 'Prix en points', text: "Valeurs de départ à vérifier dans l'écran « Échange de points Booster » du jeu ; change-les dans « Prix en points par rareté » si elles diffèrent. Les promos ne s'achètent pas." },
]

function Group({ rarity, items, onOpen }: { rarity: Rarity; items: PlanItem[]; onOpen: (c: Card) => void }) {
  const cost = items[0].cost
  const opens = items.map((i) => i.packsToOpen).filter(Number.isFinite)
  const lo = opens.length ? Math.max(1, Math.round(Math.min(...opens))) : 0
  const hi = opens.length ? Math.max(1, Math.round(Math.max(...opens))) : 0
  return (
    <div className="pp-group">
      <p className="pp-group-h"><b>{RARITY_LABEL[rarity]}</b> <span>{nf.format(cost)} pts = {nf.format(Math.ceil(items[0].packsToBuy))} packs · à ouvrir ≈ {opens.length ? (lo === hi ? nf.format(lo) : `${nf.format(lo)}–${nf.format(hi)}`) : 'jamais'}</span></p>
      <ul className="pp-thumbs">
        {items.map((i) => (
          <li key={i.card.id}>
            <button type="button" className="pp-tb" onClick={() => onOpen(i.card)} aria-label={`${i.card.name} : ${i.verdict === 'buy' ? 'acheter' : 'ouvrir'}`}>
              <CardThumb card={i.card} />
              <span className={'pp-pill ' + i.verdict}>{i.verdict === 'buy' ? 'Acheter' : 'Ouvrir'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ item, onOpen }: { item: PlanItem; onOpen: (c: Card) => void }) {
  const { card } = item
  return (
    <li className="pp-row">
      <button type="button" className="pp-open" onClick={() => onOpen(card)} aria-label={`Ouvrir la fiche de ${card.name}`}>
        <CardThumb card={card} />
        <span className="pp-main">
          <b>{card.name} <span className="pp-r">{RARITY_LABEL[card.rarity]}</span></b>
          <small>{nf.format(item.cost)} pts = {nf.format(Math.ceil(item.packsToBuy))} packs de points · à ouvrir : {packs(item.packsToOpen)}</small>
        </span>
        <span className={'pp-pill ' + item.verdict}>{item.verdict === 'buy' ? 'Acheter' : 'Ouvrir'}</span>
      </button>
    </li>
  )
}

export default function PackPoints() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const rates = useRates()
  const boosters = useBoosters()
  const history = useHistory(1_000_000)
  const home = usePzSnapshot('home')
  const stats = usePzSnapshot('stats')
  const [pick, setPick] = usePersisted<string>('points.set', '')
  const [manual, setManual] = usePersisted<Record<string, number>>('points.manual', {})
  const [custom, setCustom] = usePersisted<PointCosts>('points.costs', {})
  const [shown, setShown] = useState(PAGE)
  const [detail, setDetail] = useState<Card | null>(null)

  const costs = useMemo<PointCosts>(() => ({ ...DEFAULT_POINT_COSTS, ...custom }), [custom])
  const list = useMemo(() => sets.filter((s) => !isSpecialSetId(s.id) && cards.some((c) => c.setId === s.id)).sort((a, b) => b.order - a.order), [sets, cards])
  const setId = list.some((s) => s.id === pick) ? pick : list[0]?.id ?? ''

  const fetchedAt = (home ?? stats)?.fetchedAt
  const pz = useMemo(() => {
    if (!fetchedAt) return new Map<string, number>()
    const bs = new Map(boosters.map((b) => [b.id, b.setId]))
    const base = computeBaseline({ fetchedAt, home: home?.data, stats: stats?.data, history, boosterSet: (id) => bs.get(id) ?? setIdOf(id), setIds: sets.map((s) => s.id) })
    const out = new Map<string, number>()
    for (const p of base.packPoints) {
      const sid = sets.find((s) => s.id.toLowerCase() === p.setCode.toLowerCase())?.id
      if (sid) out.set(sid, p.points)
    }
    return out
  }, [fetchedAt, home, stats, history, boosters, sets])

  const manualValue = manual[setId]
  const balance = manualValue ?? pz.get(setId) ?? 0
  const plan = useMemo(
    () => (setId ? planSet(setId, cards, boosters.filter((b) => b.setId === setId).map((b) => b.id), rates, owned, balance, costs) : null),
    [setId, cards, boosters, rates, owned, balance, costs],
  )
  const recIds = useMemo(() => new Set(plan?.recommended.map((i) => i.card.id)), [plan])
  const rest = useMemo(() => plan?.items.filter((i) => !recIds.has(i.card.id)) ?? [], [plan, recIds])

  if (!plan) return <main className="page" data-section="pink"><PageHeader icon="layers" title="Points Booster" /></main>

  const setBalance = (v: string) => {
    const n = Math.round(Number(v.replace(/\s/g, '').replace(',', '.')))
    const next = { ...manual }
    if (v.trim() === '' || !Number.isFinite(n) || n < 0) delete next[setId]
    else next[setId] = n
    setManual(next)
  }
  const setCost = (r: keyof PointCosts, v: string) => {
    const n = Math.round(Number(v))
    const next = { ...custom }
    if (!Number.isFinite(n) || n <= 0 || n === DEFAULT_POINT_COSTS[r]) delete next[r]
    else next[r] = n
    setCustom(next)
  }
  const noBalance = manualValue === undefined && !pz.has(setId)
  const balanceField = (
    <label className="pp-field">
      <span>Solde{manualValue === undefined && pz.has(setId) ? ' (Pokémon-Zone + packs saisis)' : manualValue === undefined ? ' : saisis tes points' : ' (saisi à la main)'}</span>
      <input inputMode="numeric" value={manualValue ?? ''} placeholder={String(pz.get(setId) ?? 0)} onChange={(e) => setBalance(e.target.value)} />
      {!fetchedAt && <small><Link to="/guide-pokemon-zone">Importer mon profil</Link></small>}
    </label>
  )
  const restGroups = (() => {
    const m = new Map<Rarity, PlanItem[]>()
    for (const i of rest.slice(0, shown)) { const a = m.get(i.card.rarity); if (a) a.push(i); else m.set(i.card.rarity, [i]) }
    return [...m.entries()]
  })()
  const pct = plan.totalCost > 0 ? Math.min(100, (plan.balance / plan.totalCost) * 100) : 100

  return (
    <main className="page pp" data-section="pink">
      <PageHeader icon="layers" title="Points Booster" help={HELP} />

      <div className="pp-chips" role="tablist" aria-label="Extension">
        {list.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === setId} className={'pp-chip' + (s.id === setId ? ' on' : '')} onClick={() => { setPick(s.id); setShown(PAGE) }}>
            <SetLogo setId={s.id} name={s.name} small fallback={<b>{s.id}</b>} />
            <span>{nf.format(manual[s.id] ?? pz.get(s.id) ?? 0)}</span>
          </button>
        ))}
      </div>

      <section className="card pp-card" data-content-start="">
        {noBalance && balanceField}
        <div className="pp-tiles">
          <div><b>{nf.format(plan.balance)}</b><span>points en poche</span></div>
          <div><b>{nf.format(plan.totalCost)}</b><span>pour tout acheter ({plan.items.length} carte{plan.items.length > 1 ? 's' : ''})</span></div>
          <div><b>{plan.shortfall > 0 ? nf.format(plan.packsToEarnShortfall) : '0'}</b><span>packs à ouvrir pour y arriver</span></div>
        </div>
        <div className="pp-bar" role="img" aria-label={`${Math.round(pct)} % des points nécessaires`}><i style={{ width: `${pct}%` }} /></div>
        <p className="pp-muted">
          {plan.items.length === 0
            ? 'Rien à acheter : toutes les cartes achetables de cette extension sont déjà dans ta collection.'
            : plan.shortfall > 0
              ? `Il te manque ${nf.format(plan.shortfall)} points. Chaque pack ouvert en rapporte 5.`
              : 'Ton solde suffit pour acheter toutes les cartes manquantes.'}
        </p>
        {!noBalance && balanceField}
      </section>

      {plan.recommended.length > 0 && (
        <section className="card pp-card">
          <h2 className="pp-h"><Icon name="check" />Conseillé avec ton solde <small>{nf.format(plan.spent)} pts</small></h2>
          <p className="pp-muted">Il resterait {nf.format(plan.leftover)} points.</p>
          <ul className="pp-list">{plan.recommended.map((i) => <Row key={i.card.id} item={i} onOpen={setDetail} />)}</ul>
        </section>
      )}

      {plan.byRarity.length > 0 && (
        <section className="card pp-card">
          <h2 className="pp-h"><Icon name="chart" />Par rareté</h2>
          <table className="pp-table">
            <thead><tr><th>Rareté</th><th>Manque</th><th>Prix</th><th>Total</th><th>Packs de points</th></tr></thead>
            <tbody>
              {plan.byRarity.map((r) => (
                <tr key={r.rarity}><td>{RARITY_LABEL[r.rarity]}</td><td>{r.missing}</td><td>{nf.format(r.unitCost)}</td><td>{nf.format(r.total)}</td><td>{nf.format(packsForPoints(r.total))}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rest.length > 0 && (
        <section className="card pp-card">
          <h2 className="pp-h"><Icon name="grid" />Autres cartes manquantes <small>{rest.length}</small></h2>
          {restGroups.map(([r, items]) => <Group key={r} rarity={r} items={items} onOpen={setDetail} />)}
          {rest.length > shown && <button type="button" className="btn pp-more" onClick={() => setShown(shown + PAGE)}>Voir plus ({rest.length - shown})</button>}
        </section>
      )}

      <details className="card pp-card pp-costs">
        <summary>Prix en points par rareté</summary>
        <div className="pp-cost-grid">
          {BUYABLE_RARITIES.map((r) => (
            <label key={r}><span>{RARITY_LABEL[r]}</span><input inputMode="numeric" value={costs[r] ?? ''} onChange={(e) => setCost(r, e.target.value)} /></label>
          ))}
        </div>
        {Object.keys(custom).length > 0 && <button type="button" className="btn" onClick={() => setCustom({})}>Remettre les prix d'origine</button>}
      </details>

      {detail && <CardDetail card={detail} qty={owned.get(detail.id) ?? 0} onClose={() => setDetail(null)} />}
    </main>
  )
}
