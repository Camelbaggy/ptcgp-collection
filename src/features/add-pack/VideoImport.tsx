import { useMemo, useRef, useState } from 'react'
import { applyCorrections, cardImageUrl, undoLast } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, setLabel, splitSets, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import NativeRecording from './NativeRecording'
import { importVideo, toDataUrl, type ImportPhase, type VideoImportResult } from '../../lib/videoScan/browser'

/** Au-delà, l'illustration ne ressemble pas assez à la carte retenue : à vérifier. */
const DOUBT_DIST = 0.25
const DOUBT_CONF = 0.6
const PHASE_LABEL: Record<ImportPhase, string> = {
  scroll: 'Lecture du défilement',
  cards: 'Lecture des cartes',
  refs: 'Identification des cartes',
}

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
 */
export default function VideoImport() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('video.setId', '')
  const [busy, setBusy] = useState<{ phase: ImportPhase; done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VideoImportResult | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showAll, setShowAll] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const lastPaint = useRef(0)

  const grouped = splitSets(sets)
  const curSet = sets.find((s) => s.id === setId) ?? grouped.regular[grouped.regular.length - 1] ?? sets[sets.length - 1]
  const setCards = useMemo(() => cards.filter((c) => c.setId === curSet?.id), [cards, curSet])

  const run = async (file: Blob) => {
    setError(''); setResult(null); setEdits({}); setShowAll(false)
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

  const valueOf = (r: Row) => {
    const e = edits[r.cardId]
    if (e !== undefined && e !== '') return Number(e)
    return r.read ?? r.cur
  }
  const changed = rows.filter((r) => valueOf(r) !== r.cur)
  const doubts = rows.filter((r) => r.doubt)
  const shown = (showAll ? rows : rows.filter((r) => r.doubt || valueOf(r) !== r.cur))
    .sort((a, b) => Number(b.doubt) - Number(a.doubt) || a.number - b.number)
  const wrongSet = result && result.medianDist !== null && result.medianDist > 0.3
  const noImages = result && result.withImages < setCards.length / 2

  const save = async () => {
    const ev = await applyCorrections(changed.map((r) => ({ cardId: r.cardId, to: valueOf(r) })))
    const n = changed.length
    setResult(null); setEdits({})
    toast(ev ? `${n} carte(s) mise(s) à jour` : 'Rien à changer', ev ? { label: 'Annuler', run: () => void undoLast() } : undefined)
  }

  return (
    <>
      <div className="row">
        {curSet && <SetLogo setId={curSet.id} name={curSet.name} />}
        <select className="input" aria-label="Extension" value={curSet?.id ?? ''} disabled={!!busy}
          onChange={(e) => { setSetId(e.target.value); setResult(null) }}>
          {grouped.regular.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
          {grouped.special.length > 0 && <optgroup label="Promos et spéciaux">{grouped.special.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}</optgroup>}
        </select>
      </div>

      {!result && !busy && (
        <div className="card vimp-help">
          <h3><Icon name="video" />Mettre à jour depuis une vidéo du jeu</h3>
          <ol>
            <li>Dans le jeu, ouvre l'extension puis l'écran <b>« Échange de points Booster »</b>.</li>
            <li>Lance l'enregistrement de l'écran et fais défiler la liste <b>jusqu'en bas</b>, sans te presser.</li>
            <li>Importe la vidéo ici : l'appli lit le nombre d'exemplaires de chaque carte, sans rien envoyer en ligne.</li>
          </ol>
          <button className="btn primary" onClick={() => input.current?.click()}><Icon name="upload" />Choisir la vidéo</button>
          <input ref={input} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f) }} />
          <NativeRecording onBlob={run} />
          {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
        </div>
      )}

      {busy && (
        <div className="card vimp-busy" role="status" aria-live="polite">
          <h3><Icon name="sync" />{PHASE_LABEL[busy.phase]}…</h3>
          <div className="bar"><i style={{ width: `${Math.round((100 * busy.done) / Math.max(1, busy.total))}%` }} /></div>
          <p className="muted">Garde l'appli ouverte pendant l'analyse.</p>
        </div>
      )}

      {result && (
        <>
          <div className="card vimp-sum">
            <p><b>{rows.length}</b> cartes lues · <b>{changed.length}</b> changement{changed.length > 1 ? 's' : ''} · <b>{doubts.length}</b> à vérifier</p>
            {wrongSet && <p className="vimp-error"><Icon name="warn" />Les cartes de la vidéo ressemblent peu à celles de {curSet?.name}. Vérifie l'extension choisie.</p>}
            {noImages && <p className="muted small">Images des cartes indisponibles : les cartes sont reconnues par leur ordre seulement. Vérifie les noms.</p>}
            {result.missing.length > 0 && (
              <p className="muted small">Pas dans la vidéo, donc inchangées : {result.missing.map((c) => `${c.name} ${RARITY_LABEL[c.rarity]}`).join(', ')}.</p>
            )}
            <label className="vimp-all"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Afficher toutes les cartes</label>
          </div>
          <div className="bulklist">
            {shown.map((r) => {
              const v = valueOf(r)
              return (
                <div key={r.key} className={'vimp-line' + (r.doubt ? ' doubt' : '') + (v !== r.cur ? ' changed' : '')}>
                  <img className="vimp-thumb" src={r.thumb} alt="" title="Carte vue dans la vidéo" />
                  <img className="vimp-thumb" src={cardImageUrl({ id: r.cardId, setId: curSet!.id, image: setCards.find((c) => c.id === r.cardId)?.image })} alt="" loading="lazy" title="Carte reconnue" />
                  <span className="grow vimp-name">
                    <span className="nm">{r.name}</span>
                    <span className="muted small">n° {r.number} · {r.rarity}{r.doubt && <b className="vimp-flag"> · à vérifier</b>}</span>
                  </span>
                  <span className="vimp-from mono">{r.cur} →</span>
                  <input className="bulk-input" inputMode="numeric" autoComplete="off" aria-label={`Quantité ${r.name}`}
                    value={edits[r.cardId] ?? String(v)} onFocus={(e) => e.target.select()}
                    onChange={(e) => setEdits((p) => ({ ...p, [r.cardId]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                </div>
              )
            })}
            {!shown.length && <p className="muted vimp-none">Aucun changement : ta collection est à jour pour cette extension.</p>}
          </div>
          <div className="actionbar">
            <span>{changed.length} modifiée{changed.length > 1 ? 's' : ''}</span>
            <button className="btn ghost" onClick={() => { setResult(null); setEdits({}) }}>Annuler</button>
            <button className="btn primary" disabled={!changed.length} onClick={save}>Enregistrer</button>
          </div>
        </>
      )}
    </>
  )
}
