import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, splitSets, useCards, useOwned, useSets } from '../../lib/useData'
import { importVideoAuto, toDataUrl, type ImportPhase, type VideoImportResult } from '../../lib/videoScan/browser'
import NativeRecording from './NativeRecording'
import { CorrectionList, ReviewActionBar, ScanProgress } from './CorrectionReview'
import { saveCorrections, useCorrectionEdits } from './correctionEdits'
import { clearScreenReads, dropScreenRead, putScreenRead, useScreenReads } from './screenMassStore'

const DOUBT_DIST = 0.25
const DOUBT_CONF = 0.6
/** En dessous, l'extension devinée est incertaine. */
const GUESS_MIN_SHARE = 0.6

interface Row { cardId: string; name: string; number: number; rarity: string; thumb: string; cur: number; read: number | null; doubt: boolean }

function rowsOf(result: VideoImportResult, thumbs: string[], owned: Map<string, number>): Row[] {
  return result.matches.flatMap((m, i) => (!m.card ? [] : [{
    cardId: m.card.id, name: m.card.name, number: m.card.number, rarity: RARITY_LABEL[m.card.rarity],
    thumb: thumbs[i] ?? '', cur: owned.get(m.card.id) ?? 0, read: m.tile.count,
    doubt: m.tile.count === null || m.tile.conf < DOUBT_CONF || (m.dist !== null && m.dist > DOUBT_DIST),
  }]))
}

/**
 * MAJ massive par lecture d'écran (appli Android) : une vidéo de l'écran « Échange de points Booster »
 * par extension, l'extension est reconnue d'après les cartes, puis une seule revue et un seul
 * enregistrement pour toutes les extensions lues. Consignes dans l'aide « ? » de l'écran Ajout (`addHelp.tsx`).
 */
export default function ScreenMass() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const reads = useScreenReads()
  const [busy, setBusy] = useState<{ phase: ImportPhase; done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const review = useCorrectionEdits()
  const lastPaint = useRef(0)

  const regular = splitSets(sets).regular
  const deluxe = useMemo(() => new Set(cards.filter((c) => c.finish === 'Brillante').map((c) => c.setId)), [cards])

  const run = async (file: Blob) => {
    setError('')
    setBusy({ phase: 'scroll', done: 0, total: 1 })
    try {
      const { guess, result } = await importVideoAuto(file, cards, (phase, done, total) => {
        const now = performance.now()
        if (now - lastPaint.current > 100 || done === total) { lastPaint.current = now; setBusy({ phase, done, total }) }
      })
      if (!result || !guess.setId || !result.matches.length) throw new Error('Aucune extension reconnue. Filme bien l\'écran « Échange de points Booster » en faisant défiler la liste jusqu\'en bas.')
      putScreenRead({ setId: guess.setId, result, thumbs: result.matches.map((m) => toDataUrl(m.tile.thumb)), guess, at: Date.now() })
      setOpen(guess.setId)
      const name = sets.find((s) => s.id === guess.setId)?.name ?? guess.setId
      toast(`Extension lue : ${name}`)
    } catch (e) {
      setError((e as Error).message || String(e))
    } finally { setBusy(null) }
  }

  const valueOf = review.valueOf
  const perSet = useMemo(() => Object.values(reads).map((rd) => {
    const rows = rowsOf(rd.result, rd.thumbs, owned)
    return { rd, rows }
  }), [reads, owned])
  const changedAll = perSet.flatMap(({ rows }) => review.changed(rows))

  const save = async () => {
    await saveCorrections(review.corrections(changedAll), toast)
    clearScreenReads(); review.reset(); setOpen(null)
  }

  return (
    <>
      {!busy && (
        <div className="add-start">
          <NativeRecording onBlob={run} primary />
          {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
        </div>
      )}

      {busy && <ScanProgress {...busy} />}

      <div className="card screenmass-list">
        <h3><Icon name="layers" />Extensions <small className="muted">{perSet.length} lue{perSet.length > 1 ? 's' : ''} sur {regular.length}</small></h3>
        {perSet.length > 0 && (
          <div className="bulklist">
            {regular.filter((s) => perSet.some((p) => p.rd.setId === s.id)).map((s) => {
              const entry = perSet.find((p) => p.rd.setId === s.id)!
              const changed = entry.rows.filter((r) => valueOf(r) !== r.cur).length
              const doubts = entry.rows.filter((r) => r.doubt).length
              const shaky = entry.rd.guess.share < GUESS_MIN_SHARE
              const isOpen = open === s.id
              return (
                <div key={s.id} className="screenmass-set">
                  <div className="row vimp-line">
                    <SetLogo setId={s.id} name={s.name} />
                    <span className="grow vimp-name">
                      <span className="nm">{s.id}</span>
                      <span className="muted small">{`${changed} changement${changed > 1 ? 's' : ''} · ${doubts} à vérifier${shaky ? ' · extension incertaine' : ''}`}</span>
                    </span>
                    <button className="btn small ghost" onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? 'Fermer' : 'Voir'}</button>
                    <button className="btn small ghost" aria-label={`Retirer ${s.name}`} onClick={() => { dropScreenRead(s.id); if (open === s.id) setOpen(null) }}><Icon name="close" /></button>
                  </div>
                  {isOpen && (
                    <CorrectionList review={review} empty="Rien à changer pour cette extension."
                      items={entry.rows.filter((r) => r.doubt || valueOf(r) !== r.cur).map((r) => ({ ...r, sub: `n° ${r.number} · ${r.rarity}`, thumbs: [{ src: r.thumb }] }))}>
                      {entry.rd.result.missing.length > 0 && <p className="muted small">Pas dans la vidéo, donc inchangées : {entry.rd.result.missing.map((c) => c.name).join(', ')}.</p>}
                    </CorrectionList>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {perSet.length < regular.length && (
          <details className="add-more">
            <summary>Pas encore lues · {regular.length - perSet.length}</summary>
            <div className="set-grid">
              {[...regular].reverse().filter((s) => !reads[s.id]).map((s) => (
                <span key={s.id} className={'set-pick static' + (deluxe.has(s.id) ? ' off' : '')} title={deluxe.has(s.id) ? `${s.name} : écran non lisible (cartes brillantes), saisie manuelle` : s.name}>
                  <SetLogo setId={s.id} name="" /><span className="set-pick-code">{s.id}{deluxe.has(s.id) ? ' · non lisible' : ''}</span>
                </span>
              ))}
            </div>
          </details>
        )}
      </div>

      {perSet.length > 0 && (
        <ReviewActionBar count={changedAll.length} onCancel={() => { clearScreenReads(); review.reset(); setOpen(null) }} onSave={save}
          cancelLabel="Tout effacer" saveLabel="Tout enregistrer" />
      )}
    </>
  )
}
