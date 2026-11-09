import { useEffect, useRef, useState } from 'react'
import { cardImageUrl } from '../../lib/db'
import { Icon } from '../../components/Icon'
import CardSearchSelect from '../../components/CardSearchSelect'
import type { Card } from '../../lib/types'
import NativeCapture from './NativeCapture'
import { pendingLabel } from '../../lib/native/captureQueue'
import { isNative } from '../../lib/native/holoNative'
import { recognizeScreenshot, SHOT_DOUBT, type ShotDetection } from '../../lib/videoScan/browser'

/**
 * Ajout d'un booster depuis une capture d'écran de fin d'ouverture : on repère les cartes,
 * on les reconnaît, l'utilisateur vérifie, puis elles rejoignent le pack en cours.
 */
export default function ScreenshotImport({ setCards, allCards, setName, onAdd, nativeOff }: {
  setCards: Card[]
  allCards: Card[]
  setName: string
  onAdd: (cards: Card[]) => void
  /** désactive la lecture des captures natives (le panneau « récap » les lit à la place) */
  nativeOff?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<ShotDetection[] | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const [queue, setQueue] = useState<Blob[]>([])
  const input = useRef<HTMLInputElement>(null)
  const byId = new Map(allCards.map((c) => [c.id, c]))

  const run = async (file: Blob) => {
    setBusy(true); setError(''); setFound(null)
    try {
      const res = await recognizeScreenshot(file, setCards, allCards)
      if (!res.length) throw new Error('Aucune carte repérée sur cette image. Envoie la capture de fin d\'ouverture du booster, cartes bien visibles.')
      setFound(res)
      setPicks(res.map((d) => d.candidates[0]?.card.id ?? ''))
    } catch (e) {
      setError((e as Error).message || String(e))
    } finally { setBusy(false) }
  }
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run })

  // captures natives en file : une à la fois, quand rien n'est en cours de lecture ou de vérification
  useEffect(() => {
    if (busy || found || !queue.length) return
    const [next, ...rest] = queue
    setQueue(rest)
    void runRef.current(next)
  }, [queue, busy, found])

  // coller une capture (Ctrl+V sur PC)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((it) => it.type.startsWith('image/'))
      const f = item?.getAsFile()
      if (f) { e.preventDefault(); void runRef.current(f) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const add = () => {
    const cards = picks.flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []))
    onAdd(cards)
    setFound(null)
  }

  const native = nativeOff ? null : <NativeCapture hidden={!!found} onBlob={(b) => setQueue((q) => [...q, b])} />
  const waitingLabel = isNative ? pendingLabel(queue.length) : ''

  if (!found) {
    return (
      <>
      <div className="shot-bar">
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name={busy ? 'sync' : 'upload'} />{busy ? 'Lecture de la capture…' : 'Depuis une capture d\'écran'}
        </button>
        <span className="muted small shot-hint">ou colle-la ici (Ctrl+V)</span>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f) }} />
        {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
        {waitingLabel && <p className="muted small shot-hint-queue">{waitingLabel}</p>}
      </div>
      {native}
      </>
    )
  }

  const nOk = picks.filter(Boolean).length
  return (
    <>
    {native}
    <div className="card shot-panel">
      <h3><Icon name="cards" />{found.length} carte{found.length > 1 ? 's' : ''} repérée{found.length > 1 ? 's' : ''}</h3>
      {waitingLabel && <p className="muted small">{waitingLabel} après celle-ci.</p>}
      <p className="muted small">Vérifie chaque carte, puis ajoute-les au pack. Les cartes surlignées sont incertaines.</p>
      <div className="bulklist">
        {found.map((d, i) => {
          const best = d.candidates[0], second = d.candidates[1]
          const doubt = !best || best.dist > SHOT_DOUBT || (second && second.card.name !== best.card.name && second.dist - best.dist < 0.04)
          const pick = picks[i] ? byId.get(picks[i]) : undefined
          return (
            <div key={i} className={'vimp-line' + (doubt ? ' doubt' : '')}>
              <img className="vimp-thumb" src={d.thumb} alt="" title="Carte sur la capture" />
              {pick ? <img className="vimp-thumb" src={cardImageUrl(pick)} alt="" title="Carte reconnue" /> : <span className="vimp-thumb" />}
              <span className="grow vimp-name">
                <CardSearchSelect label={`Carte ${i + 1}`} value={picks[i]} suggestions={d.candidates.map((c) => c.card)} cards={allCards} preferred={setCards} noneLabel="Ignorer cette carte"
                  onChange={(id) => setPicks((p) => p.map((v, k) => (k === i ? id : v)))} />
                {doubt && <span className="muted small"><b className="vimp-flag">À vérifier</b>{!best || best.dist > SHOT_DOUBT ? ` · peu ressemblante aux cartes de ${setName}` : ' · deux cartes proches'}</span>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="row shot-actions">
        <button className="btn ghost" onClick={() => setFound(null)}>Annuler</button>
        <button className="btn primary" disabled={!nOk} onClick={add}><Icon name="plus" />Ajouter {nOk} carte{nOk > 1 ? 's' : ''} au pack</button>
      </div>
    </div>
    </>
  )
}
