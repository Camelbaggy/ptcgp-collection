import { useMemo, useRef, useState } from 'react'
import { cardImageUrl } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, splitSets, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import NativeRecording from './NativeRecording'
import { SetLine } from './SetChoice'
import { importVideo, toDataUrl, type ImportPhase, type VideoImportResult } from '../../lib/videoScan/browser'
import { CorrectionList, ReviewActionBar, ScanProgress, ShowAllToggle } from './CorrectionReview'
import { saveCorrections, useCorrectionEdits } from './correctionEdits'

/** Au-delà, l'illustration ne ressemble pas assez à la carte retenue : à vérifier. */
const DOUBT_DIST = 0.25
const DOUBT_CONF = 0.6

interface Row {
  key: string
  cardId: string
  name: string
  number: number
  rarity: string
  thumb: string
  cur: number
  read: number | null
  doubt: boolean
}

/**
 * Import d'une vidéo de l'écran « Échange de points Booster » du jeu : on lit le nombre
 * d'exemplaires de chaque carte, on montre les différences, puis on enregistre une correction.
 * Les consignes sont dans l'aide « ? » de l'écran Ajout (`addHelp.tsx`).
 */
export default function VideoImport({ source = 'file' }: { source?: 'screen' | 'file' }) {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('video.setId', '')
  const [busy, setBusy] = useState<{ phase: ImportPhase; done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VideoImportResult | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const review = useCorrectionEdits()
  const [showAll, setShowAll] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const lastPaint = useRef(0)

  const grouped = splitSets(sets)
  const curSet = sets.find((s) => s.id === setId) ?? grouped.regular[grouped.regular.length - 1] ?? sets[sets.length - 1]
  const curSetId = curSet?.id
  // oxlint-disable-next-line react/preserve-manual-memoization -- dépend de l'id seul, volontairement
  const setCards = useMemo(() => cards.filter((c) => c.setId === curSetId), [cards, curSetId])

  const run = async (file: Blob) => {
    setError(''); setResult(null); review.reset(); setShowAll(false)
    setBusy({ phase: 'scroll', done: 0, total: 1 })
    try {
      const res = await importVideo(file, setCards, (phase, done, total) => {
        const now = performance.now()
        if (now - lastPaint.current > 100 || done === total) { lastPaint.current = now; setBusy({ phase, done, total }) }
      })
      if (!res.matches.length) throw new Error('Aucune carte trouvée. Filme bien l\'écran « Échange de points Booster » en faisant défiler la liste.')
      setThumbs(res.matches.map((m) => toDataUrl(m.tile.thumb)))
      setResult(res)
    } catch (e) {
      setError((e as Error).message || String(e))
    } finally { setBusy(null) }
  }

  const rows: Row[] = useMemo(() => {
    if (!result) return []
    return result.matches.flatMap((m, i) => {
      if (!m.card) return []
      return [{
        key: `${i}`, cardId: m.card.id, name: m.card.name, number: m.card.number, rarity: RARITY_LABEL[m.card.rarity],
        thumb: thumbs[i] ?? '', cur: owned.get(m.card.id) ?? 0, read: m.tile.count,
        doubt: m.tile.count === null || m.tile.conf < DOUBT_CONF || (m.dist !== null && m.dist > DOUBT_DIST),
      }]
    })
  }, [result, thumbs, owned])

  const valueOf = review.valueOf
  const changed = review.changed(rows)
  const doubts = rows.filter((r) => r.doubt)
  const shown = (showAll ? rows : rows.filter((r) => r.doubt || valueOf(r) !== r.cur))
    .sort((a, b) => Number(b.doubt) - Number(a.doubt) || a.number - b.number)
  const wrongSet = result && result.medianDist !== null && result.medianDist > 0.3
  const noImages = result && result.withImages < setCards.length / 2

  const save = async () => {
    await saveCorrections(review.corrections(changed), toast)
    setResult(null); review.reset()
  }

  return (
    <>
      <SetLine sets={sets} value={curSet} disabled={!!busy} onPick={(id) => { setSetId(id); setResult(null) }}
        detail={`${setCards.filter((c) => (owned.get(c.id) ?? 0) > 0).length} / ${setCards.length}`} />

      {!result && !busy && (
        <div className="add-start">
          {source === 'file' && <button className="btn primary" onClick={() => input.current?.click()}><Icon name="upload" />Choisir la vidéo</button>}
          <input ref={input} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f) }} />
          {source === 'screen' && <NativeRecording onBlob={run} primary />}
          {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
        </div>
      )}

      {busy && <ScanProgress {...busy} />}

      {result && (
        <>
          <div className="card vimp-sum">
            <p><b>{rows.length}</b> cartes lues · <b>{changed.length}</b> changement{changed.length > 1 ? 's' : ''} · <b>{doubts.length}</b> à vérifier</p>
            {wrongSet && <p className="vimp-error"><Icon name="warn" />Les cartes de la vidéo ressemblent peu à celles de {curSet?.name}. Vérifie l'extension choisie.</p>}
            {noImages && <p className="muted small">Images des cartes indisponibles : les cartes sont reconnues par leur ordre seulement. Vérifie les noms.</p>}
            {result.missing.length > 0 && (
              <p className="muted small">Pas dans la vidéo, donc inchangées : {result.missing.map((c) => `${c.name} ${RARITY_LABEL[c.rarity]}`).join(', ')}.</p>
            )}
            <ShowAllToggle checked={showAll} onChange={setShowAll} />
          </div>
          <CorrectionList review={review} empty="Aucun changement : ta collection est à jour pour cette extension."
            items={shown.map((r) => ({
              ...r,
              sub: `n° ${r.number} · ${r.rarity}`,
              thumbs: [
                { src: r.thumb, title: 'Carte vue dans la vidéo' },
                { src: cardImageUrl({ id: r.cardId, setId: curSet!.id, image: setCards.find((c) => c.id === r.cardId)?.image }), title: 'Carte reconnue', lazy: true },
              ],
            }))} />
          <ReviewActionBar count={changed.length} onCancel={() => { setResult(null); review.reset() }} onSave={save} />
        </>
      )}
    </>
  )
}
