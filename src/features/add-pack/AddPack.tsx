import { useMemo, useState } from 'react'
import { addPack, undoLast } from '../../lib/db'
import { CardTile } from '../../components/CardTile'
import { Filters } from '../../components/Filters'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { matchCard, setLabel, useBoosters, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Rarity } from '../../lib/types'
import BulkUpdate from './BulkUpdate'

const TYPICAL = 5
type Mode = 'type' | 'grid' | 'bulk'

export default function AddPack() {
  const sets = useSets()
  const boosters = useBoosters()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('add.setId', '')
  const [boosterId, setBoosterId] = usePersisted('add.boosterId', '')
  const [mode, setMode] = usePersisted<Mode>('add.mode', 'type')
  const [wholeSet, setWholeSet] = usePersisted('add.wholeSet', false)
  const [pack, setPack] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [busy, setBusy] = useState(false)

  const withBoosters = useMemo(
    () => sets.filter((s) => boosters.some((b) => b.setId === s.id)),
    [sets, boosters],
  )
  const curSet = withBoosters.find((s) => s.id === setId) ?? withBoosters[withBoosters.length - 1]
  const setBoosters = boosters.filter((b) => b.setId === curSet?.id)
  const curBooster = setBoosters.find((b) => b.id === boosterId) ?? setBoosters[0]
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const candidates = useMemo(
    () => cards.filter((c) => (wholeSet ? c.setId === curSet?.id : curBooster && c.boosterIds.includes(curBooster.id))),
    [cards, curBooster, curSet, wholeSet],
  )
  const shown = useMemo(() => candidates.filter((c) => matchCard(c, q, rarities)), [candidates, q, rarities])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const id of pack) m[id] = (m[id] ?? 0) + 1
    return m
  }, [pack])
  const total = pack.length

  const add = (id: string) => setPack((p) => [...p, id])
  const removeOne = (id: string) => setPack((p) => { const i = p.lastIndexOf(id); return i < 0 ? p : p.filter((_, j) => j !== i) })

  const validate = async () => {
    if (!curBooster || !total) return
    setBusy(true)
    try {
      await addPack(curBooster.id, pack)
      toast(`Booster ajouté (${pack.length} cartes)`, { label: 'Annuler', run: () => void undoLast() })
      setPack([])
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setBusy(false) }
  }

  if (!sets.length) return <div className="page"><p className="muted">Aucune extension. Ajoutez-en une depuis « Nouvelle extension ».</p></div>

  return (
    <div className={'page with-bar'}>
      <div className="seg" role="tablist">
        <button className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>Saisie</button>
        <button className={mode === 'grid' ? 'on' : ''} onClick={() => setMode('grid')}>Grille</button>
        <button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>Mise à jour</button>
      </div>
      {mode === 'bulk' ? <BulkUpdate /> : (
        <>
          <div className="row">
            <select className="input" aria-label="Extension" value={curSet?.id ?? ''} onChange={(e) => { setSetId(e.target.value); setBoosterId(''); setPack([]) }}>
              {withBoosters.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
            </select>
          </div>
          {setBoosters.length > 1 && (
            <div className="chips scroll" role="tablist" aria-label="Booster">
              {setBoosters.map((b) => (
                <button key={b.id} role="tab" className={'chip big' + (b.id === curBooster?.id ? ' on' : '')}
                  onClick={() => setBoosterId(b.id)}>{b.name}</button>
              ))}
            </div>
          )}
          {setBoosters.length > 1 && (
            <label className="check"><input type="checkbox" checked={wholeSet} onChange={(e) => setWholeSet(e.target.checked)} /> Chercher dans tous les boosters de l'extension</label>
          )}
          <div className="sticky-top">
            {mode === 'type' && <TypeAhead cards={candidates} owned={owned} onPick={(c) => add(c.id)} />}
            {pack.length > 0 && (
              <div className="packlist" aria-label="Cartes du pack">
                {Object.entries(counts).map(([id, n]) => (
                  <span key={id} className="packitem">{byId.get(id)?.name ?? id}{n > 1 ? ` ×${n}` : ''}
                    <button onClick={() => removeOne(id)} aria-label={`Retirer ${byId.get(id)?.name ?? id}`}>✕</button></span>
                ))}
              </div>
            )}
          </div>
          {mode === 'grid' && (
            <>
              <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
              <div className="grid">
                {shown.map((c) => (
                  <CardTile key={c.id} card={c} count={counts[c.id]} dim={!owned.get(c.id)}
                    showName onClick={() => add(c.id)} onMinus={() => removeOne(c.id)} />
                ))}
              </div>
              {!shown.length && <p className="muted">Aucune carte pour ce booster.</p>}
            </>
          )}
          <div className="actionbar">
            <span className={total === TYPICAL ? 'ok' : ''}>{total} carte{total > 1 ? 's' : ''}{total !== TYPICAL && total > 0 ? ` (usuel : ${TYPICAL})` : ''}</span>
            <button className="btn ghost" disabled={!total} onClick={() => setPack([])}>Vider</button>
            <button className="btn primary" disabled={!total || busy} onClick={validate}>Valider</button>
          </div>
        </>
      )}
    </div>
  )
}
