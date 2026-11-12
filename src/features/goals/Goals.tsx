import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { BoosterBadge, SetBadge } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { db } from '../../lib/db'
import { RARITIES, RARITY_LABEL, setLabel, splitSets, useBoosters, useCards, useOwned, useRates, useSets } from '../../lib/useData'
import { estimateGoal, goalProgress, packsPerDay, type Goal } from '../../lib/goals'
import { addGoal, promoteGoal, removeGoal, restoreGoal, useGoals } from '../../lib/goalsStore'
import { isFullPack, onlyPacks } from '../../lib/stats/packs'
import { dayKey } from '../../lib/stats/dates'
import { num } from '../dashboard/format'
import './goals.css'

const NO_DAYS: string[] = []
const today = () => dayKey(new Date().toISOString())

function GoalTitle({ g }: { g: Goal }) {
  const r = g.rarities.length ? g.rarities.map((x) => RARITY_LABEL[x]).join(' ') : 'Toutes les raretés'
  return (
    <span className="goal-title">
      {g.boosterId ? <BoosterBadge boosterId={g.boosterId} /> : g.setId ? <SetBadge setId={g.setId} /> : <b>Toutes les extensions</b>}
      <b>{r}</b>
    </span>
  )
}

function GoalCard({ g, pace, main }: { g: Goal; pace: number; main: boolean }) {
  const [open, setOpen] = useState(false)
  const cards = useCards(), owned = useOwned(), rates = useRates()
  const toast = useToast()
  const prog = useMemo(() => goalProgress(g, cards, owned), [g, cards, owned])
  const est = useMemo(() => (prog.missing.length ? estimateGoal(prog.missing, cards, rates, g.boosterId) : null), [prog, cards, rates, g.boosterId])
  const packsText = (n: number) => (n > 10000 ? 'plus de 10 000' : num(Math.round(n)))
  const pct = Math.floor(prog.pct * 100)
  const weeks = est && pace > 0 ? Math.max(1, Math.round(est.mean / (pace * 7))) : 0
  const remove = () => { removeGoal(g.id); toast('Objectif retiré', { label: 'Annuler', run: () => restoreGoal(g) }) }
  return (
    <section className={'card goal' + (main ? ' goal-main' : ' goal-compact')}>
      {main && <span className="goal-flag">Objectif principal</span>}
      <div className="goal-head">
        <div className="grow">
          <GoalTitle g={g} />
          <small className="muted">{g.copies === 1 ? '1ère copie de chaque carte' : '2 exemplaires de chaque carte'}</small>
        </div>
        {!main && est && est.byBooster.length > 0 && <span className="goal-side"><b>{packsText(est.mean)}</b><small className="muted">packs</small></span>}
        <span className="goal-pct">{pct} %</span>
        <button className="btn ghost" onClick={remove} aria-label="Retirer cet objectif"><Icon name="close" /></button>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
      <p className="muted goal-count">{num(prog.done)} / {num(prog.total)} cartes{prog.missing.length ? `, il en manque ${num(prog.missing.length)}` : ''}</p>
      {!main && prog.missing.length > 0 && (
        <div className="row goal-actions">
          <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Masquer le détail' : 'Voir le détail'}</button>
          <button className="btn" onClick={() => promoteGoal(g.id)}>Mettre en principal</button>
        </div>
      )}
      {!prog.total && <p className="muted">Aucune carte ne correspond à cet objectif.</p>}
      {prog.total > 0 && !prog.missing.length && <p className="ok">Objectif atteint.</p>}
      {est && est.byBooster.length > 0 && (main || open) && (
        <div className="goal-est">
          <span className="goal-big">{est.mean > 10000 ? '' : '≈ '}{packsText(est.mean)} pack{est.mean >= 1.5 ? 's' : ''}</span>
          <small className="muted">
            Dans 9 cas sur 10, {packsText(est.p90)} ou moins{weeks ? `. À ton rythme des 30 derniers jours : environ ${weeks} semaine${weeks > 1 ? 's' : ''}` : ''}.
          </small>
          <ul className="goal-boosters">
            {est.byBooster.slice(0, 4).map((b) => (
              <li key={b.boosterId}><BoosterBadge boosterId={b.boosterId} /><small className="muted">{b.cards} c.</small><b>≈ {num(Math.round(b.mean))} packs</b></li>
            ))}
            {est.byBooster.length > 4 && <li className="muted">et {est.byBooster.length - 4} autres boosters</li>}
          </ul>
          <small className="muted">Estimation : chaque carte est visée dans son meilleur booster, un booster après l'autre. Pour un grand objectif, c'est un ordre de grandeur.</small>
        </div>
      )}
      {est && est.unreachable.length > 0 && (main || open) && (
        <p className="muted goal-warn"><Icon name="warn" /> {est.unreachable.length} carte{est.unreachable.length > 1 ? 's' : ''} hors estimation (pas de booster à taux connus : promos, missions…).</p>
      )}
    </section>
  )
}

function NewGoal({ onClose }: { onClose: () => void }) {
  const sets = useSets(), boosters = useBoosters(), cards = useCards(), owned = useOwned()
  const [setId, setSetId] = useState('')
  const [boosterId, setBoosterId] = useState('')
  const [rarities, setRarities] = useState<Goal['rarities']>([])
  const [copies, setCopies] = useState<1 | 2>(1)
  const present = useMemo(() => new Set(cards.filter((c) => !setId || c.setId === setId).map((c) => c.rarity)), [cards, setId])
  const draft = useMemo<Goal>(() => ({ id: '', setId: setId || undefined, boosterId: boosterId || undefined, rarities: rarities.filter((r) => present.has(r)), copies, createdAt: '' }), [setId, boosterId, rarities, present, copies])
  const prog = useMemo(() => goalProgress(draft, cards, owned), [draft, cards, owned])
  const { regular, special } = splitSets(sets)
  const setBoosters = boosters.filter((b) => b.setId === setId && !b.entryOnly)
  const toggle = (r: Goal['rarities'][number]) => setRarities((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))
  const total = prog.total
  const save = () => { addGoal({ setId: draft.setId, boosterId: draft.boosterId, rarities: draft.rarities, copies }); onClose() }
  return (
    <Sheet title="Nouvel objectif" onClose={onClose}>
      <div className="goal-form" data-section="teal">
        <label>Extension
          <select className="input" value={setId} onChange={(e) => { setSetId(e.target.value); setBoosterId('') }}>
            <option value="">Toutes les extensions</option>
            {[...regular, ...special].map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
          </select>
        </label>
        {setBoosters.length > 1 && (
          <label>Booster
            <select className="input" value={boosterId} onChange={(e) => setBoosterId(e.target.value)}>
              <option value="">Tous les boosters de l'extension</option>
              {setBoosters.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <fieldset>
          <legend>Raretés <small className="muted">(aucune cochée = toutes)</small></legend>
          <div className="row">
            {RARITIES.filter((r) => present.has(r)).map((r) => (
              <button key={r} type="button" className={'chip' + (rarities.includes(r) ? ' on' : '')} aria-pressed={rarities.includes(r)} onClick={() => toggle(r)}>{RARITY_LABEL[r]}</button>
            ))}
          </div>
        </fieldset>
        <div className="seg" role="group" aria-label="Exemplaires visés">
          <button type="button" className={copies === 1 ? 'on' : ''} onClick={() => setCopies(1)}>1ère copie</button>
          <button type="button" className={copies === 2 ? 'on' : ''} onClick={() => setCopies(2)}>2 exemplaires</button>
        </div>
        <p className="muted">{total} carte{total > 1 ? 's' : ''} concernée{total > 1 ? 's' : ''}, {num(prog.done)} déjà atteinte{prog.done > 1 ? 's' : ''}.</p>
        <button className="btn primary" disabled={!total} onClick={save}><Icon name="plus" />Créer l'objectif</button>
      </div>
    </Sheet>
  )
}

export default function Goals() {
  const goals = useGoals()
  const [adding, setAdding] = useState(false)
  const days = useLiveQuery(async () => onlyPacks(await db.history.where('date').aboveOrEqual(new Date(Date.now() - 31 * 864e5).toISOString()).toArray()).filter(isFullPack).map((e) => dayKey(e.date)), []) ?? NO_DAYS
  const pace = useMemo(() => packsPerDay(days, today()), [days])
  return (
    <div className="page" data-section="teal">
      <PageHeader icon="target" title="Objectifs" sub={goals.length ? `${goals.length} objectif${goals.length > 1 ? 's' : ''} en cours` : 'Finir une rareté, une extension, un booster'}>
        {goals.length > 0 && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Nouvel objectif</button>}
      </PageHeader>
      {!goals.length && <EmptyState icon="target" title="Aucun objectif" text="Par exemple « finir C1 en ◆ » : tu vois ta progression et combien de packs il te faut en moyenne." action={<button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Créer un objectif</button>} />}
      <div className="goal-grid">{goals.map((g, i) => <GoalCard key={g.id} g={g} pace={pace} main={i === 0} />)}</div>
      {adding && <NewGoal onClose={() => setAdding(false)} />}
    </div>
  )
}
