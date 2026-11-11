import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, setLabel, splitSets, useCards, useOwned, useSets } from '../../lib/useData'
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
 * enregistrement pour toutes les extensions lues.
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
        <div className="card vimp-help">
          <h3><Icon name="video" />Mettre à jour toutes les extensions</h3>
          <ol>
            <li>Touche <b>« Enregistrer depuis le jeu »</b> (« Tout l'écran »), puis « Démarrer dans 5 s ».</li>
            <li>Dans le jeu, ouvre une extension, puis l'écran <b>« Échange de points Booster »</b> et fais défiler la liste <b>jusqu'en bas</b>.</li>
            <li>Arrête l'enregistrement : l'appli <b>reconnaît l'extension toute seule</b> et la coche ci-dessous. Recommence pour la suivante.</li>
            <li>Quand tu as fini, vérifie et enregistre <b>en une seule fois</b>.</li>
          </ol>
          <NativeRecording onBlob={run} />
          {error && <p className="vimp-error"><Icon name="warn" />{error}</p>}
        </div>
      )}

      {busy && <ScanProgress {...busy} />}

      <div className="card screenmass-list">
        <h3><Icon name="layers" />Extensions</h3>
        <p className="muted small">{perSet.length} lue{perSet.length > 1 ? 's' : ''} sur {regular.length}. Rien n'est enregistré avant ta validation.</p>
        <div className="bulklist">
          {regular.map((s) => {
            const entry = perSet.find((p) => p.rd.setId === s.id)
            const changed = entry ? entry.rows.filter((r) => valueOf(r) !== r.cur).length : 0
            const doubts = entry ? entry.rows.filter((r) => r.doubt).length : 0
            const shaky = entry && entry.rd.guess.share < GUESS_MIN_SHARE
            const isOpen = open === s.id && !!entry
            return (
              <div key={s.id} className="screenmass-set">
                <div className="row vimp-line">
                  <SetLogo setId={s.id} name={s.name} />
                  <span className="grow vimp-name">
                    <span className="nm">{setLabel(s)}</span>
                    <span className="muted small">
                      {entry ? `${changed} changement${changed > 1 ? 's' : ''} · ${doubts} à vérifier${shaky ? ' · extension incertaine' : ''}`
                        : deluxe.has(s.id) ? 'Écran non lisible (cartes brillantes) : saisie manuelle' : 'Pas encore lue'}
                    </span>
                  </span>
                  {entry ? (
                    <>
                      <button className="btn small ghost" onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? 'Fermer' : 'Voir'}</button>
                      <button className="btn small ghost" aria-label="Retirer" onClick={() => { dropScreenRead(s.id); if (open === s.id) setOpen(null) }}><Icon name="close" /></button>
                    </>
                  ) : <Icon name="clock" />}
                </div>
                {isOpen && entry && (
                  <CorrectionList review={review} empty="Rien à changer pour cette extension."
                    items={entry.rows.filter((r) => r.doubt || valueOf(r) !== r.cur).map((r) => ({ ...r, sub: `n° ${r.number} · ${r.rarity}`, thumbs: [{ src: r.thumb }] }))}>
                    {entry.rd.result.missing.length > 0 && <p className="muted small">Pas dans la vidéo, donc inchangées : {entry.rd.result.missing.map((c) => c.name).join(', ')}.</p>}
                  </CorrectionList>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {perSet.length > 0 && (
        <ReviewActionBar count={changedAll.length} onCancel={() => { clearScreenReads(); review.reset(); setOpen(null) }} onSave={save}
          cancelLabel="Tout effacer" saveLabel="Tout enregistrer" />
      )}
    </>
  )
}
