import { pickBooster } from '../../lib/packBooster'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addPack, undoLast } from '../../lib/db'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { BoosterEmblem, SetLogo } from '../../components/Brand'
import { CardTile } from '../../components/CardTile'
import { Filters } from '../../components/Filters'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { matchCard, setLabel, splitSets, useBoosters, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Card, Rarity } from '../../lib/types'
import BulkUpdate from './BulkUpdate'
import VideoImport from './VideoImport'
import ScreenshotImport from './ScreenshotImport'

const TYPICAL = 5
type Mode = 'type' | 'grid' | 'bulk' | 'video'

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
  const grouped = useMemo(() => splitSets(withBoosters), [withBoosters])
  const curSet = withBoosters.find((s) => s.id === setId) ?? grouped.regular[grouped.regular.length - 1] ?? withBoosters[withBoosters.length - 1]
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
  // cartes de l'extension, plus les rééditions d'autres extensions vendues dans ses boosters (packs Deluxe)
  const setCards = useMemo(() => {
    const ids = new Set(boosters.filter((b) => b.setId === curSet?.id).map((b) => b.id))
    return cards.filter((c) => c.setId === curSet?.id || c.boosterIds.some((b) => ids.has(b)))
  }, [cards, boosters, curSet])
  const addFromShot = (got: Card[]) => {
    if (!got.length) return
    // booster contenant le plus de cartes reconnues (les rééditions des boosters de luxe gardent l'id d'origine)
    const bId = pickBooster(got, curBooster?.id)
    const b = boosters.find((x) => x.id === bId)
    if (b) {
      if (b.setId !== curSet?.id && withBoosters.some((s) => s.id === b.setId)) setSetId(b.setId)
      setBoosterId(b.id)
    }
    setPack((p) => [...p, ...got.map((c) => c.id)])
    toast(`${got.length} carte${got.length > 1 ? 's' : ''} ajoutée${got.length > 1 ? 's' : ''} au pack : vérifie puis valide`)
  }
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

  if (!sets.length) return <div className="page" data-section="green"><EmptyState icon="layers" title="Aucune extension" text="Ajoutez-en une depuis « Nouvelle extension »." action={<Link className="btn primary" to="/extension/nouvelle">Nouvelle extension</Link>} /></div>

  return (
    <div className={'page with-bar'} data-section="green">
      <PageHeader icon="plus" title="Ajouter un pack" sub="Note les cartes de ton dernier booster" />
      <div className="seg" role="tablist">
        <button className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}><Icon name="search" />Saisie</button>
        <button className={mode === 'grid' ? 'on' : ''} onClick={() => setMode('grid')}><Icon name="grid" />Grille</button>
        <button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}><Icon name="layers" />Mise à jour</button>
        <button className={mode === 'video' ? 'on' : ''} onClick={() => setMode('video')}><Icon name="video" />Vidéo</button>
      </div>
      {mode === 'bulk' ? <BulkUpdate /> : mode === 'video' ? <VideoImport /> : (
        <>
          <div className="row">
            {curSet && <SetLogo setId={curSet.id} name={curSet.name} />}
            <select className="input" aria-label="Extension" value={curSet?.id ?? ''} onChange={(e) => { setSetId(e.target.value); setBoosterId(''); setPack([]) }}>
              {grouped.regular.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
              {grouped.special.length > 0 && <optgroup label="Promos et spéciaux">{grouped.special.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}</optgroup>}
            </select>
          </div>
          {setBoosters.length > 1 && (
            <div className="chips scroll" role="tablist" aria-label="Booster">
              {setBoosters.map((b) => (
                <button key={b.id} role="tab" className={'chip big' + (b.id === curBooster?.id ? ' on' : '')}
                  onClick={() => setBoosterId(b.id)}><BoosterEmblem boosterId={b.id} />{b.name}</button>
              ))}
            </div>
          )}
          {setBoosters.length > 1 && (
            <label className="check"><input type="checkbox" checked={wholeSet} onChange={(e) => setWholeSet(e.target.checked)} /> Chercher dans tous les boosters de l'extension</label>
          )}
          <ScreenshotImport setCards={setCards} allCards={cards} setName={curSet?.name ?? ''} onAdd={addFromShot} />
          <div className="sticky-top">
            {mode === 'type' && <TypeAhead cards={candidates} owned={owned} onPick={(c) => add(c.id)} />}
            {pack.length > 0 && (
              <div className="packlist" aria-label="Cartes du pack">
                {Object.entries(counts).map(([id, n]) => (
                  <span key={id} className="packitem">{byId.get(id)?.name ?? id}{n > 1 ? ` ×${n}` : ''}
                    <button onClick={() => removeOne(id)} aria-label={`Retirer ${byId.get(id)?.name ?? id}`}><Icon name="close" /></button></span>
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
              {!shown.length && <EmptyState icon="search" title="Aucune carte" text="Aucune carte ne correspond à ce booster ou à ces filtres." />}
            </>
          )}
          <div className="actionbar">
            <span className={total === TYPICAL ? 'ok' : ''}>{total} carte{total > 1 ? 's' : ''}{total !== TYPICAL && total > 0 ? ` (usuel : ${TYPICAL})` : ''}</span>
            <button className="btn ghost" disabled={!total} onClick={() => setPack([])}>Vider</button>
            <button className="btn primary" disabled={!total || busy} onClick={validate}><Icon name="check" />Valider</button>
          </div>
        </>
      )}
    </div>
  )
}
