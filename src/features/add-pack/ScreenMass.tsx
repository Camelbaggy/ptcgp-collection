import { useMemo, useRef, useState } from 'react'
import { applyCorrections, undoLast } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, setLabel, splitSets, useCards, useOwned, useSets } from '../../lib/useData'
import { importVideoAuto, toDataUrl, type ImportPhase, type VideoImportResult } from '../../lib/videoScan/browser'
import NativeRecording from './NativeRecording'
import { clearScreenReads, dropScreenRead, putScreenRead, useScreenReads } from './screenMassStore'

const DOUBT_DIST = 0.25
const DOUBT_CONF = 0.6
/** En dessous, l'extension devinée est incertaine. */
const GUESS_MIN_SHARE = 0.6
const PHASE_LABEL: Record<ImportPhase, string> = {
  scroll: 'Lecture du défilement',
  cards: 'Lecture des cartes',
  refs: 'Identification des cartes',
}

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
  const [edits, setEdits] = useState<Record<string, string>>({})
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

  const valueOf = (r: Row) => {
    const e = edits[r.cardId]
    return e !== undefined && e !== '' ? Number(e) : r.read ?? r.cur
  }
  const perSet = useMemo(() => Object.values(reads).map((rd) => {
    const rows = rowsOf(rd.result, rd.thumbs, owned)
    return { rd, rows }
  }), [reads, owned])
  const changedAll = perSet.flatMap(({ rows }) => rows.filter((r) => valueOf(r) !== r.cur))

  const save = async () => {
    const n = changedAll.length
    const ev = await applyCorrections(changedAll.map((r) => ({ cardId: r.cardId, to: valueOf(r) })))
    clearScreenReads(); setEdits({}); setOpen(null)
    toast(ev ? `${n} carte(s) mise(s) à jour` : 'Rien à changer', ev ? { label: 'Annuler', run: () => void undoLast() } : undefined)
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

      {busy && (
        <div className="card vimp-busy" role="status" aria-live="polite">
          <h3><Icon name="sync" />{PHASE_LABEL[busy.phase]}…</h3>
          <div className="bar"><i style={{ width: `${Math.round((100 * busy.done) / Math.max(1, busy.total))}%` }} /></div>
          <p className="muted">Garde l'appli ouverte pendant l'analyse.</p>
        </div>
      )}

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
                  <div className="bulklist">
                    {entry.rows.filter((r) => r.doubt || valueOf(r) !== r.cur).map((r) => {
                      const v = valueOf(r)
                      return (
                        <div key={r.cardId} className={'vimp-line' + (r.doubt ? ' doubt' : '') + (v !== r.cur ? ' changed' : '')}>
                          <img className="vimp-thumb" src={r.thumb} alt="" />
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
                    {!entry.rows.some((r) => r.doubt || valueOf(r) !== r.cur) && <p className="muted vimp-none">Rien à changer pour cette extension.</p>}
                    {entry.rd.result.missing.length > 0 && <p className="muted small">Pas dans la vidéo, donc inchangées : {entry.rd.result.missing.map((c) => c.name).join(', ')}.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {perSet.length > 0 && (
        <div className="actionbar">
          <span>{changedAll.length} modifiée{changedAll.length > 1 ? 's' : ''}</span>
          <button className="btn ghost" onClick={() => { clearScreenReads(); setEdits({}); setOpen(null) }}>Tout effacer</button>
          <button className="btn primary" disabled={!changedAll.length} onClick={save}>Tout enregistrer</button>
        </div>
      )}
    </>
  )
}
