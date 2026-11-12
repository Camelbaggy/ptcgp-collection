import { useMemo, useState } from 'react'
import { pickBooster } from '../../lib/packBooster'
import { addPack, addPacks, onUndoError, undoLast, undoLastN } from '../../lib/db'
import { EmptyState } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { BoosterEmblem } from '../../components/Brand'
import { CardTile } from '../../components/CardTile'
import { Filters } from '../../components/Filters'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { matchCard, useOwned, usePersisted } from '../../lib/useData'
import type { Card, Rarity } from '../../lib/types'
import ScreenshotImport from './ScreenshotImport'
import { useBoosterChoice } from './boosterChoice'
import { BoosterLine } from './SetChoice'

const TYPICAL = 5

/** Un booster lu sur une capture, en attente de validation (une capture = un booster). */
type ShotPack = { key: number; boosterId: string; cardIds: string[] }
let shotKey = 0


/**
 * Saisie d'un booster : depuis une capture d'écran (`shot`), à la main par recherche (`manual`) ou dans la grille (`grid`).
 * `series` : plusieurs boosters à la suite (compteur des boosters validés ; Recherche/Grille s'y choisit dans la page).
 */
export default function PackEntry({ input: method, series }: { input: 'shot' | 'manual' | 'grid'; series?: boolean }) {
  const ch = useBoosterChoice()
  const { cards, boosters, curSet, curBooster, setCards } = ch
  const owned = useOwned()
  const toast = useToast()
  const [gridPref, setGrid] = usePersisted('add.grid', false)
  const input = method === 'shot' ? 'shot' : 'manual'
  const grid = method === 'grid' || (!!series && gridPref)
  const [wholeSet, setWholeSet] = usePersisted('add.wholeSet', false)
  const [pack, setPack] = useState<string[]>([])
  const [shots, setShots] = useState<ShotPack[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
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
  const addFromShot = (got: Card[]) => {
    if (!got.length) return
    // booster contenant le plus de cartes reconnues (les rééditions des boosters de luxe gardent l'id d'origine)
    const bId = pickBooster(got, curBooster?.id) ?? curBooster?.id
    if (!bId) return
    ch.switchBooster(bId)
    const n = shots.length + 1
    setShots((s) => [...s, { key: ++shotKey, boosterId: bId, cardIds: got.map((c) => c.id) }])
    toast(n > 1 ? `${n}e booster prêt : vérifie puis valide les ${n}` : 'Booster prêt : vérifie puis valide')
  }
  const editShot = (key: number, f: (p: ShotPack) => ShotPack | null) =>
    setShots((s) => s.flatMap((p) => { if (p.key !== key) return [p]; const q = f(p); return q && q.cardIds.length ? [q] : [] }))
  const removeOne = (id: string) => setPack((p) => { const i = p.lastIndexOf(id); return i < 0 ? p : p.filter((_, j) => j !== i) })

  const validate = async () => {
    if (!curBooster || !total) return
    setBusy(true)
    try {
      await addPack(curBooster.id, pack)
      toast(`Booster ajouté (${pack.length} cartes)`, { label: 'Annuler', run: () => { void undoLast().then((e) => { if (e) setDone((n) => Math.max(0, n - 1)) }).catch(onUndoError(toast)) } })
      setPack([])
      setDone((n) => n + 1)
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setBusy(false) }
  }

  // captures : chaque booster devient son propre évènement `pack` (historique, stats, nombre de packs)
  const shotCards = shots.reduce((n, p) => n + p.cardIds.length, 0)
  const validateShots = async () => {
    if (!shots.length) return
    setBusy(true)
    try {
      const evs = await addPacks(shots.map((p) => ({ boosterId: p.boosterId, cardIds: p.cardIds })))
      const n = evs.length
      toast(n > 1 ? `${n} boosters ajoutés (${shotCards} cartes)` : `Booster ajouté (${shotCards} cartes)`, {
        label: 'Annuler', run: () => { void undoLastN(n).then(() => setDone((d) => Math.max(0, d - n))).catch(onUndoError(toast)) },
      })
      setShots([])
      setDone((d) => d + n)
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setBusy(false) }
  }
  const boosterOf = (id: string) => boosters.find((b) => b.id === id)

  return (
    <>
      <BoosterLine ch={ch} onChange={() => setPack([])} {...(input === 'manual' ? { wholeSet, setWholeSet } : {})} />
      {input === 'shot' && (
        <ScreenshotImport setCards={setCards} allCards={cards} setName={curSet?.name ?? ''} onAdd={addFromShot} pending={shots.length} onReview={setReviewing} />
      )}
      {series && (
        <div className="seg seg-sm add-manual" role="tablist" aria-label="Façon de saisir">
          <button role="tab" aria-selected={!grid} className={!grid ? 'on' : ''} onClick={() => setGrid(false)}><Icon name="search" />Recherche</button>
          <button role="tab" aria-selected={grid} className={grid ? 'on' : ''} onClick={() => setGrid(true)}><Icon name="grid" />Grille</button>
        </div>
      )}
      {(series || input === 'shot') && done > 0 && (
        <p className="ok small add-series" role="status"><Icon name="check" />{done} booster{done > 1 ? 's' : ''} ajouté{done > 1 ? 's' : ''}</p>
      )}
      <div className="sticky-top add-entry">
        {input === 'manual' && !grid && <TypeAhead cards={candidates} owned={owned} onPick={(c) => add(c.id)} />}
        {pack.length > 0 && (
          <div className="packlist" aria-label="Cartes du pack">
            {Object.entries(counts).map(([id, n]) => (
              <span key={id} className="packitem">{byId.get(id)?.name ?? id}{n > 1 ? ` ×${n}` : ''}
                <button onClick={() => removeOne(id)} aria-label={`Retirer ${byId.get(id)?.name ?? id}`}><Icon name="close" /></button></span>
            ))}
          </div>
        )}
      </div>
      {input === 'shot' && shots.length > 0 && (
        <div className="shot-packs" aria-label="Boosters à valider">
          {shots.map((p, i) => {
            const b = boosterOf(p.boosterId)
            const siblings = boosters.filter((x) => x.setId === b?.setId)
            const n: Record<string, number> = {}
            for (const id of p.cardIds) n[id] = (n[id] ?? 0) + 1
            return (
              <div key={p.key} className="card shot-pack">
                <div className="row shot-pack-head">
                  <b>Booster {i + 1}</b>
                  <BoosterEmblem boosterId={p.boosterId} />
                  {siblings.length > 1
                    ? <select className="input" aria-label={`Booster ${i + 1}`} value={p.boosterId} onChange={(e) => editShot(p.key, (q) => ({ ...q, boosterId: e.target.value }))}>
                        {siblings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    : <span className="grow">{b?.name ?? p.boosterId}</span>}
                  <span className="muted small">{p.cardIds.length} carte{p.cardIds.length > 1 ? 's' : ''}</span>
                  <button className="btn ghost shot-pack-del" onClick={() => editShot(p.key, () => null)} aria-label={`Retirer le booster ${i + 1}`}><Icon name="close" /></button>
                </div>
                <div className="packlist">
                  {Object.entries(n).map(([id, k]) => (
                    <span key={id} className="packitem">{byId.get(id)?.name ?? id}{k > 1 ? ` ×${k}` : ''}
                      <button onClick={() => editShot(p.key, (q) => { const j = q.cardIds.lastIndexOf(id); return { ...q, cardIds: q.cardIds.filter((_, x) => x !== j) } })} aria-label={`Retirer ${byId.get(id)?.name ?? id}`}><Icon name="close" /></button></span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {input === 'shot' && shots.length > 0 && !reviewing && (
        <div className="actionbar">
          <span>{shots.length} booster{shots.length > 1 ? 's' : ''} · {shotCards} carte{shotCards > 1 ? 's' : ''}</span>
          <button className="btn ghost" onClick={() => setShots([])}>Vider</button>
          <button className="btn primary" disabled={busy} onClick={validateShots}><Icon name="check" />{shots.length > 1 ? `Valider les ${shots.length}` : 'Valider'}</button>
        </div>
      )}
      {input === 'manual' && grid && (
        <>
          <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
          <div className="grid">
            {shown.map((c) => (
              <CardTile key={c.id} card={c} count={counts[c.id]} dim={!owned.get(c.id)}
                showName onClick={() => add(c.id)} onMinus={() => removeOne(c.id)} />
            ))}
          </div>
          {!shown.length && <EmptyState icon="search" title="Aucune carte" text="Aucune carte ne correspond à ce booster ou à ces filtres." />}
        </>
      )}
      {input === 'manual' && (
        <div className="actionbar">
          <span className={total === TYPICAL ? 'ok' : ''}>{total} carte{total > 1 ? 's' : ''}{total !== TYPICAL && total > 0 ? ` (usuel : ${TYPICAL})` : ''}</span>
          <button className="btn ghost" disabled={!total} onClick={() => setPack([])}>Vider</button>
          <button className="btn primary" disabled={!total || busy} onClick={validate}><Icon name="check" />Valider</button>
        </div>
      )}
    </>
  )
}
