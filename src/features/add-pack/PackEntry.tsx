import { useMemo, useState } from 'react'
import { pickBooster } from '../../lib/packBooster'
import { addPack, undoLast } from '../../lib/db'
import { EmptyState } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { BoosterEmblem, SetLogo } from '../../components/Brand'
import { CardTile } from '../../components/CardTile'
import { Filters } from '../../components/Filters'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { matchCard, setLabel, useOwned, usePersisted } from '../../lib/useData'
import type { Card, Rarity } from '../../lib/types'
import ScreenshotImport from './ScreenshotImport'
import { useBoosterChoice, type BoosterChoice } from './boosterChoice'

const TYPICAL = 5


/** Choix de l'extension (avec son logo) puis du booster (emblèmes). */
export function BoosterPicker({ ch, onChange }: { ch: BoosterChoice; onChange?: () => void }) {
  const { grouped, curSet, setBoosters, curBooster } = ch
  return (
    <>
      <div className="row">
        {curSet && <SetLogo setId={curSet.id} name={curSet.name} />}
        <select className="input" aria-label="Extension" value={curSet?.id ?? ''} onChange={(e) => { ch.setSetId(e.target.value); ch.setBoosterId(''); onChange?.() }}>
          {grouped.regular.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
          {grouped.special.length > 0 && <optgroup label="Promos et spéciaux">{grouped.special.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}</optgroup>}
        </select>
      </div>
      {setBoosters.length > 1 && (
        <div className="chips scroll" role="tablist" aria-label="Booster">
          {setBoosters.map((b) => (
            <button key={b.id} role="tab" className={'chip big' + (b.id === curBooster?.id ? ' on' : '')}
              onClick={() => ch.setBoosterId(b.id)}><BoosterEmblem boosterId={b.id} />{b.name}</button>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Saisie d'un booster : depuis une capture d'écran (`shot`) ou à la main (recherche ou grille).
 * `series` : plusieurs boosters à la suite (compteur des boosters validés).
 */
export default function PackEntry({ input, series }: { input: 'shot' | 'manual'; series?: boolean }) {
  const ch = useBoosterChoice()
  const { cards, curSet, setBoosters, curBooster, setCards } = ch
  const owned = useOwned()
  const toast = useToast()
  const [grid, setGrid] = usePersisted('add.grid', false)
  const [wholeSet, setWholeSet] = usePersisted('add.wholeSet', false)
  const [pack, setPack] = useState<string[]>([])
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
    const bId = pickBooster(got, curBooster?.id)
    if (bId) ch.switchBooster(bId)
    setPack((p) => [...p, ...got.map((c) => c.id)])
    toast(`${got.length} carte${got.length > 1 ? 's' : ''} ajoutée${got.length > 1 ? 's' : ''} au pack : vérifie puis valide`)
  }
  const removeOne = (id: string) => setPack((p) => { const i = p.lastIndexOf(id); return i < 0 ? p : p.filter((_, j) => j !== i) })

  const validate = async () => {
    if (!curBooster || !total) return
    setBusy(true)
    try {
      await addPack(curBooster.id, pack)
      toast(`Booster ajouté (${pack.length} cartes)`, { label: 'Annuler', run: () => { void undoLast(); setDone((n) => Math.max(0, n - 1)) } })
      setPack([])
      setDone((n) => n + 1)
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setBusy(false) }
  }

  return (
    <>
      <BoosterPicker ch={ch} onChange={() => setPack([])} />
      {input === 'manual' && setBoosters.length > 1 && (
        <label className="check"><input type="checkbox" checked={wholeSet} onChange={(e) => setWholeSet(e.target.checked)} /> Chercher dans tous les boosters de l'extension</label>
      )}
      {input === 'shot' && (
        <ScreenshotImport setCards={setCards} allCards={cards} setName={curSet?.name ?? ''} onAdd={addFromShot} />
      )}
      {input === 'manual' && (
        <div className="seg seg-sm add-manual" role="tablist" aria-label="Façon de saisir">
          <button role="tab" aria-selected={!grid} className={!grid ? 'on' : ''} onClick={() => setGrid(false)}><Icon name="search" />Recherche</button>
          <button role="tab" aria-selected={grid} className={grid ? 'on' : ''} onClick={() => setGrid(true)}><Icon name="grid" />Grille</button>
        </div>
      )}
      {series && done > 0 && (
        <p className="ok small add-series" role="status"><Icon name="check" />{done} booster{done > 1 ? 's' : ''} ajouté{done > 1 ? 's' : ''} · continue avec le suivant</p>
      )}
      <div className="sticky-top">
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
      {(input === 'manual' || total > 0) && (
        <div className="actionbar">
          <span className={total === TYPICAL ? 'ok' : ''}>{total} carte{total > 1 ? 's' : ''}{total !== TYPICAL && total > 0 ? ` (usuel : ${TYPICAL})` : ''}</span>
          <button className="btn ghost" disabled={!total} onClick={() => setPack([])}>Vider</button>
          <button className="btn primary" disabled={!total || busy} onClick={validate}><Icon name="check" />Valider</button>
        </div>
      )}
    </>
  )
}
