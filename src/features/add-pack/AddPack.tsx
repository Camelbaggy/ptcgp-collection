import { useMemo, useState } from 'react'
import { addPack, undoLast } from '../../lib/db'
import { CardTile } from '../../components/CardTile'
import { Filters } from '../../components/Filters'
import { useToast } from '../../components/Toast'
import { matchCard, useBoosters, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Rarity } from '../../lib/types'

const TYPICAL = 5

export default function AddPack() {
  const sets = useSets()
  const boosters = useBoosters()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('add.setId', '')
  const [boosterId, setBoosterId] = usePersisted('add.boosterId', '')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [busy, setBusy] = useState(false)

  const curSet = sets.find((s) => s.id === setId) ?? sets[sets.length - 1]
  const setBoosters = boosters.filter((b) => b.setId === curSet?.id)
  const curBooster = setBoosters.find((b) => b.id === boosterId) ?? setBoosters[0]

  const boosterCards = useMemo(
    () => cards.filter((c) => curBooster && c.boosterIds.includes(curBooster.id)),
    [cards, curBooster],
  )
  const shown = useMemo(() => boosterCards.filter((c) => matchCard(c, q, rarities)), [boosterCards, q, rarities])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const inc = (id: string, d: number) =>
    setCounts((c) => {
      const n = (c[id] ?? 0) + d
      const { [id]: _drop, ...rest } = c
      void _drop
      return n > 0 ? { ...rest, [id]: n } : rest
    })

  const validate = async () => {
    if (!curBooster || !total) return
    setBusy(true)
    try {
      const ids = Object.entries(counts).flatMap(([id, n]) => Array(n).fill(id) as string[])
      await addPack(curBooster.id, ids)
      setCounts({})
      toast(`Booster ajouté (${ids.length} cartes)`, { label: 'Annuler', run: () => void undoLast() })
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setBusy(false) }
  }

  if (!sets.length) return <div className="page"><p className="muted">Aucune extension. Ajoutez-en une depuis « Nouvelle extension ».</p></div>

  return (
    <div className="page with-bar">
      <div className="row">
        <select className="input" aria-label="Extension" value={curSet?.id ?? ''} onChange={(e) => { setSetId(e.target.value); setBoosterId(''); setCounts({}) }}>
          {sets.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
        </select>
      </div>
      <div className="chips scroll" role="tablist" aria-label="Booster">
        {setBoosters.map((b) => (
          <button key={b.id} role="tab" className={'chip big' + (b.id === curBooster?.id ? ' on' : '')}
            onClick={() => { setBoosterId(b.id); setCounts({}) }}>{b.name}</button>
        ))}
      </div>
      <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
      <div className="grid">
        {shown.map((c) => (
          <CardTile key={c.id} card={c} count={counts[c.id]} dim={!owned.get(c.id)}
            showName onClick={() => inc(c.id, 1)} onMinus={() => inc(c.id, -1)} />
        ))}
      </div>
      {!shown.length && <p className="muted">Aucune carte pour ce booster.</p>}
      <div className="actionbar">
        <span className={total === TYPICAL ? 'ok' : ''}>{total} carte{total > 1 ? 's' : ''}{total !== TYPICAL && total > 0 ? ` (usuel : ${TYPICAL})` : ''}</span>
        <button className="btn ghost" disabled={!total} onClick={() => setCounts({})}>Vider</button>
        <button className="btn primary" disabled={!total || busy} onClick={validate}>Valider</button>
      </div>
    </div>
  )
}
