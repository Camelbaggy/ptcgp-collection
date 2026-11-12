import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { HoloNative, captureBlob, isNative, type CaptureStatus } from '../../lib/native/holoNative'
import { DENIED_HELP, errorMessage } from '../../lib/native/captureQueue'
import { RECORDING_START_HELP, RECORDING_TOO_SHORT_MS, formatDuration, recordingStateText, splitRecordings } from '../../lib/native/recordingQueue'

const logNative = (message: string) => { void HoloNative.log({ message: `[record-ui] ${message}` }).catch(() => {}) }

/**
 * Enregistrement de l'écran du téléphone (appli Android) pour l'import vidéo : l'utilisateur lance
 * l'enregistrement, parcourt le jeu, l'arrête (notification ou ici), puis la vidéo est transmise à l'import.
 * `onBlob` doit se résoudre une fois l'import terminé (ou échoué) : le fichier est alors supprimé.
 */
export default function NativeRecording({ onBlob, hidden }: { onBlob: (blob: Blob) => Promise<void>; hidden?: boolean }) {
  const [session, setSession] = useState<CaptureStatus>({ active: false, pending: 0 })
  const [recording, setRecording] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reading = useRef(false)
  const onBlobRef = useRef(onBlob)
  useEffect(() => { onBlobRef.current = onBlob })

  const refresh = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([HoloNative.captureStatus(), HoloNative.recordingStatus()])
      setSession(c); setRecording(r.recording)
      if (r.recording) setWaiting(false)
    } catch (e) { logNative(`status: ${errorMessage(e)}`) }
  }, [])

  const take = useCallback(async () => {
    if (reading.current) return
    reading.current = true
    try {
      const { items } = await HoloNative.takeRecordings()
      const { latest, older } = splitRecordings(items)
      for (const o of older) { logNative(`vidéo ancienne ignorée ${o.id}`); await HoloNative.deleteRecording({ id: o.id }).catch(() => {}) }
      if (latest) {
        setWaiting(false); setError(''); logNative(`vidéo ${latest.id} (${formatDuration(latest.durationMs)})`)
        try {
          if (latest.durationMs < RECORDING_TOO_SHORT_MS) throw new Error('Enregistrement trop court : fais défiler toute la liste avant d\'arrêter.')
          await onBlobRef.current(await captureBlob(latest))
        } catch (e) {
          setError(`Vidéo inutilisable : ${errorMessage(e)}`); logNative(`lecture ${latest.id}: ${errorMessage(e)}`)
        } finally {
          await HoloNative.deleteRecording({ id: latest.id }).catch(() => {})
        }
      }
    } catch (e) {
      setError(`Impossible de lire l'enregistrement : ${errorMessage(e)}`); logNative(`takeRecordings: ${errorMessage(e)}`)
    } finally {
      reading.current = false
      void refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!isNative) return
    // oxlint-disable-next-line react/set-state-in-effect -- lecture initiale de l'état natif
    void refresh(); void take()
    const onVis = () => { if (document.visibilityState === 'visible') { void refresh(); void take() } }
    document.addEventListener('visibilitychange', onVis)
    const subs = [
      HoloNative.addListener('recordingStopped', () => { setRecording(false); void take() }),
      HoloNative.addListener('captureSessionEnded', (e) => { setSession({ active: false, pending: 0 }); setRecording(false); setWaiting(false); logNative(`session terminée: ${e.reason}`) }),
    ]
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      subs.forEach((s) => void s.then((h) => h.remove()).catch(() => {}))
    }
  }, [refresh, take])

  if (!isNative || hidden) return null

  const startSession = async () => {
    setError(''); setBusy(true)
    try {
      const r = await HoloNative.startCaptureSession()
      if (!r.granted) { setError(DENIED_HELP); logNative('autorisation refusée') }
    } catch (e) {
      setError(`${DENIED_HELP} (${errorMessage(e)})`); logNative(`startCaptureSession: ${errorMessage(e)}`)
    } finally { setBusy(false); void refresh() }
  }
  const start = async () => {
    setError('')
    try { await HoloNative.startRecording({ delayMs: 5000 }); setWaiting(true) }
    catch (e) { setError(`Enregistrement impossible : ${errorMessage(e)}`); logNative(`startRecording: ${errorMessage(e)}`) }
  }
  const stop = async () => {
    try { await HoloNative.stopRecording() } catch (e) { logNative(`stopRecording: ${errorMessage(e)}`) }
    setRecording(false); setWaiting(false); await take()
  }

  const state = recordingStateText({ recording, waiting })

  return (
    <div className="native-cap">
      {!session.active && !recording ? (
        <>
          <button className="btn" disabled={busy} onClick={startSession}><Icon name="video" />Enregistrer depuis le jeu</button>
          <p className="muted small">Android va te demander l'autorisation de lire l'écran : choisis « Tout l'écran ».</p>
        </>
      ) : (
        <div className="card native-cap-panel">
          {recording || waiting ? (
            <>
              <p role="status"><b>{state}</b></p>
              <p className="muted small">{RECORDING_START_HELP}</p>
              <div className="row native-cap-actions">
                <button className="btn primary" onClick={stop}><Icon name="close" />Arrêter l'enregistrement</button>
              </div>
            </>
          ) : (
            <>
              <p><b>Prêt à enregistrer.</b> {RECORDING_START_HELP}</p>
              <div className="row native-cap-actions">
                <button className="btn primary" onClick={start}><Icon name="clock" />Démarrer dans 5 s</button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="vimp-error" role="alert"><Icon name="warn" />{error}</p>}
    </div>
  )
}
