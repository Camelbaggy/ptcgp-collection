import { useMemo, useRef, useState } from 'react'
import { addPacks, cardImageUrl, onUndoError, undoLastN } from '../../lib/db'
import { Icon } from '../../components/Icon'
import CardSearchSelect from '../../components/CardSearchSelect'
import { useToast } from '../../components/Toast'
import NativeCapture from './NativeCapture'
import NativeRecording from './NativeRecording'
import { videoToBlobs } from './recapMedia'
import { saveCorrections } from './correctionEdits'
import { isNative } from '../../lib/native/holoNative'
import { recognizeRecap, SHOT_DOUBT } from '../../lib/videoScan/browser'
import type { RecapResult } from '../../lib/videoScan/recapTypes'
import { pickBooster } from '../../lib/packBooster'
import { buildPacks, countMismatches, isDoubtful, lastCounts, sortRecapBoosters } from '../../lib/recapPlan'
import { useOwned } from '../../lib/useData'
import type { Booster, Card } from '../../lib/types'

interface Item { id: number; label: string; blobs: Blob[] }
let nextId = 1

/**
 * Ajout de plusieurs boosters d'un coup depuis le « Résumé ouverture » du jeu (captures ou vidéo du défilement).
 * Un pack par booster, un seul « Annuler » pour tous.
 */
export type RecapSource = 'screen' | 'shots' | 'video'
const RECAP_HELP: Record<RecapSource, string> = {
  screen: 'Touche « Enregistrer depuis le jeu » (choisis « Tout l\'écran »), puis dans le jeu fais défiler le « Résumé ouverture » jusqu\'en bas. Arrête l\'enregistrement depuis la notification et reviens ici.',
  shots: 'Dans le jeu, ouvre le « Résumé ouverture » après une ouverture de plusieurs boosters et fais des captures d\'écran en descendant (2 boosters par capture), puis choisis-les ici.',
  video: 'Dans le jeu, filme l\'écran pendant que tu fais défiler le « Résumé ouverture » jusqu\'en bas, puis choisis la vidéo ici.',
}

export default function RecapImport({ setCards, allCards, boosters, boosterId, setName, onBoosterChange, onOpen, source }: {
  setCards: Card[]
  allCards: Card[]
  boosters: Booster[]
  /** booster sélectionné dans la page */
  boosterId: string | undefined
  setName: string
  onBoosterChange: (boosterId: string) => void
  /** informe la page que le panneau est ouvert (pour ne pas lire deux fois les captures natives) */
  onOpen?: (open: boolean) => void
  /** méthode choisie dans l'onglet Ajout : panneau toujours ouvert, sans les autres façons d'importer */
  source?: RecapSource
}) {
  const toast = useToast()
  const owned = useOwned()
  const [openState, setOpenState] = useState(false)
  const open = openState || !!source
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RecapResult | null>(null)
  const [picks, setPicks] = useState<string[][]>([])
  const [included, setIncluded] = useState<boolean[]>([])
  const [game, setGame] = useState<Map<string, number> | null>(null)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const lastPaint = useRef(0)
  const byId = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards])
  const setOpen = (o: boolean) => { setOpenState(o); onOpen?.(o) }

  const mismatches = useMemo(() => (game ? countMismatches(game, owned) : []), [game, owned])

  const addFiles = async (files: File[]) => {
    setError('')
    for (const f of files) {
      try {
        if (f.type.startsWith('video/')) {
          setBusy('Lecture de la vidéo…'); setProgress([0, 1])
          const blobs = await videoToBlobs(f, (d, t) => setProgress([d, t]))
          if (!blobs.length) throw new Error('Aucune image dans la vidéo.')
          setItems((l) => [...l, { id: nextId++, label: `${f.name || 'Vidéo'} (${blobs.length} images)`, blobs }])
        } else {
          setItems((l) => [...l, { id: nextId++, label: f.name || 'Capture', blobs: [f] }])
        }
      } catch (e) {
        setError((e as Error).message || String(e))
      } finally { setBusy(''); setProgress(null) }
    }
  }
  const addRecording = async (b: Blob) => {
    setError(''); setBusy('Lecture de la vidéo…'); setProgress([0, 1])
    try {
      const blobs = await videoToBlobs(b, (d, t) => setProgress([d, t]))
      setItems((l) => [...l, { id: nextId++, label: `Défilement enregistré (${blobs.length} images)`, blobs }])
    } finally { setBusy(''); setProgress(null) }
  }

  const run = async () => {
    const images = items.flatMap((i) => i.blobs)
    if (!images.length) return
    setBusy('Lecture du récap…'); setError(''); setProgress([0, images.length]); setGame(null)
    try {
      const res = await recognizeRecap(images, setCards, allCards, (done, total) => {
        const now = performance.now()
        if (now - lastPaint.current > 100 || done === total) { lastPaint.current = now; setProgress([done, total]) }
      })
      const bs = sortRecapBoosters(res.boosters)
      if (!bs.length) throw new Error('Aucun booster repéré. Envoie des captures du « Résumé ouverture », cartes bien visibles.')
      setResult({ ...res, boosters: bs })
      setPicks(bs.map((b) => b.cards.map((d) => d.candidates[0]?.card.id ?? '')))
      setIncluded(bs.map(() => true))
    } catch (e) {
      setError((e as Error).message || String(e))
    } finally { setBusy(''); setProgress(null) }
  }

  const reset = () => { setResult(null); setItems([]); setError('') }

  const chosenCards = picks.flatMap((ids, i) => (included[i] === false ? [] : ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))))
  const targetId = pickBooster(chosenCards, boosterId) ?? boosterId
  const target = boosters.find((b) => b.id === targetId)
  const packs = buildPacks(picks, included, targetId ?? '')

  const save = async () => {
    if (!packs.length || !targetId) return
    setSaving(true)
    try {
      if (targetId !== boosterId) onBoosterChange(targetId)
      const counts = lastCounts(picks, result?.boosters.map((b) => b.counts) ?? [], included)
      await addPacks(packs)
      const n = packs.length
      toast(`${n} booster${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}`, { label: 'Annuler', run: () => void undoLastN(n).catch(onUndoError(toast)) })
      setGame(counts)
      setResult(null); setItems([])
    } catch (e) {
      toast(String((e as Error).message))
    } finally { setSaving(false) }
  }

  const align = async () => {
    await saveCorrections(mismatches.map((m) => ({ cardId: m.cardId, to: m.game })), toast,
      (n) => `${n} carte${n > 1 ? 's' : ''} alignée${n > 1 ? 's' : ''} sur le jeu`)
    setGame(null)
  }

  if (!open) {
    return (
      <div className="shot-bar">
        <button className="btn" onClick={() => setOpen(true)}><Icon name="layers" />Plusieurs boosters (récap)</button>
      </div>
    )
  }

  return (
    <div className="card shot-panel recap-panel">
      {!source && (
        <div className="row recap-head">
          <h3 className="grow"><Icon name="layers" />Plusieurs boosters (récap)</h3>
          <button className="btn ghost" onClick={() => { reset(); setGame(null); setOpen(false) }}><Icon name="close" />Fermer</button>
        </div>
      )}

      {game && mismatches.length > 0 && !result && (
        <div className="recap-check" role="status">
          <p><Icon name="warn" /><b>Quantités différentes du jeu pour {mismatches.length} carte{mismatches.length > 1 ? 's' : ''}</b></p>
          <p className="muted small">{mismatches.slice(0, 6).map((m) => `${byId.get(m.cardId)?.name ?? m.cardId} : ${m.local} chez toi, ${m.game} dans le jeu`).join(' · ')}{mismatches.length > 6 ? ' …' : ''}</p>
          <div className="row">
            <button className="btn primary" onClick={align}><Icon name="check" />Aligner sur le jeu</button>
            <button className="btn ghost" onClick={() => setGame(null)}>Ignorer</button>
          </div>
        </div>
      )}
      {game && mismatches.length === 0 && !result && (
        <p className="ok small"><Icon name="check" />Les quantités correspondent à celles du jeu.</p>
      )}

      {!result ? (
        <>
          <p className="muted small">{source ? RECAP_HELP[source] : 'Ouvre le récap après une ouverture de plusieurs boosters et fais des captures en descendant (2 boosters par capture), ou enregistre le défilement.'}</p>
          {source !== 'screen' && (
            <div className="row recap-actions">
              <button className={'btn' + (source ? ' primary' : '')} disabled={!!busy} onClick={() => input.current?.click()}>
                <Icon name="upload" />{source === 'shots' ? 'Choisir les captures' : source === 'video' ? 'Choisir la vidéo' : 'Choisir des captures ou une vidéo'}
              </button>
              <input ref={input} type="file" accept={source === 'shots' ? 'image/*' : source === 'video' ? 'video/*' : 'image/*,video/*'} multiple={source !== 'video'} hidden
                onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void addFiles(fs) }} />
            </div>
          )}
          {isNative && (!source || source === 'shots') && <NativeCapture onBlob={(b) => setItems((l) => [...l, { id: nextId++, label: 'Capture du téléphone', blobs: [b] }])} />}
          {isNative && (!source || source === 'screen') && <NativeRecording onBlob={addRecording} />}
          {items.length > 0 && (
            <ol className="recap-files">
              {items.map((it) => (
                <li key={it.id}>
                  <span className="grow">{it.label}</span>
                  <button className="btn ghost" aria-label={`Retirer ${it.label}`} disabled={!!busy} onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}><Icon name="close" /></button>
                </li>
              ))}
            </ol>
          )}
          {busy && (
            <div className="recap-progress" role="status">
              <span className="small">{busy}</span>
              <progress value={progress?.[0] ?? 0} max={progress?.[1] || 1} />
            </div>
          )}
          {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
          <div className="row shot-actions">
            <button className="btn primary" disabled={!items.length || !!busy} onClick={run}><Icon name={busy ? 'sync' : 'search'} />Lire le récap</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Vérifie chaque booster. Les cartes surlignées sont incertaines ; décoche un booster pour ne pas l'ajouter.</p>
          {target && <p className="small">Booster enregistré : <b>{target.name}</b>{targetId !== boosterId ? ' (changé d\'après les cartes lues)' : ''}</p>}
          {result.warnings.length > 0 && (
            <ul className="recap-warn">{result.warnings.map((w, i) => <li key={i}><Icon name="warn" />{w}</li>)}</ul>
          )}
          {result.boosters.map((b, bi) => (
            <section key={bi} className={'recap-booster' + (included[bi] === false ? ' off' : '')}>
              <label className="check recap-booster-head">
                <input type="checkbox" checked={included[bi] !== false} onChange={(e) => setIncluded((v) => v.map((x, k) => (k === bi ? e.target.checked : x)))} />
                <b>Booster n° {b.index}</b>
                {!b.indexRead && <span className="muted small">numéro déduit</span>}
                <span className="muted small">{b.cards.length} carte{b.cards.length > 1 ? 's' : ''}</span>
              </label>
              <div className="bulklist">
                {b.cards.map((d, i) => {
                  const doubt = isDoubtful(d.candidates, SHOT_DOUBT)
                  const pick = picks[bi]?.[i] ? byId.get(picks[bi][i]) : undefined
                  const n = b.counts[i]
                  return (
                    <div key={i} className={'vimp-line' + (doubt ? ' doubt' : '')}>
                      <img className="vimp-thumb" src={d.thumb} alt="" title="Carte sur la capture" />
                      {pick ? <img className="vimp-thumb" src={cardImageUrl(pick)} alt="" title="Carte reconnue" /> : <span className="vimp-thumb" />}
                      <span className="grow vimp-name">
                        <CardSearchSelect label={`Booster ${b.index}, carte ${i + 1}`} value={picks[bi]?.[i] ?? ''} suggestions={d.candidates.map((c) => c.card)} cards={allCards} preferred={setCards} noneLabel="Ignorer cette carte"
                          onChange={(id) => setPicks((p) => p.map((row, r) => (r === bi ? row.map((v, k) => (k === i ? id : v)) : row)))} />
                        <span className="muted small">
                          {doubt && <b className="vimp-flag">À vérifier</b>}
                          {doubt && typeof n === 'number' ? ' · ' : ''}
                          {typeof n === 'number' && `×${n} dans le jeu`}
                          {doubt && !d.candidates[0] ? ` · aucune carte de ${setName} proche` : ''}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          <div className="row shot-actions">
            <button className="btn ghost" onClick={reset}>Annuler</button>
            <button className="btn primary" disabled={!packs.length || saving} onClick={save}>
              <Icon name="plus" />Ajouter {packs.length} booster{packs.length > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
