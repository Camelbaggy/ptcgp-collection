import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { HoloNative, captureBlob, isNative, type CaptureStatus } from '../../lib/native/holoNative'
import { BLACK_WARNING, DENIED_HELP, errorMessage, splitCaptures } from '../../lib/native/captureQueue'

const logNative = (message: string) => { void HoloNative.log({ message: `[capture-ui] ${message}` }).catch(() => {}) }

/**
 * Capture de l'écran du téléphone (appli Android) : l'utilisateur lance une session, retourne dans le jeu,
 * puis les captures prises sont lues au retour dans l'appli et transmises à l'import de capture.
 */
export default function NativeCapture({ onBlob, hidden }: { onBlob: (blob: Blob) => void; hidden?: boolean }) {
  const [status, setStatus] = useState<CaptureStatus>({ active: false, pending: 0 })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [blackCount, setBlackCount] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const reading = useRef(false)
  const onBlobRef = useRef(onBlob)
  useEffect(() => { onBlobRef.current = onBlob })

  const refresh = useCallback(async () => {
    try { setStatus(await HoloNative.captureStatus()) } catch (e) { logNative(`captureStatus: ${errorMessage(e)}`) }
  }, [])

  const take = useCallback(async () => {
    if (reading.current) return
    reading.current = true
    try {
      const { items } = await HoloNative.takeCaptures()
      if (items.length) {
        setWaiting(false)
        const { black } = splitCaptures(items)
        if (black.length) { setBlackCount((n) => n + black.length); logNative(`${black.length} capture(s) noire(s)`) }
        for (const it of items) {
          try {
            if (!it.black) onBlobRef.current(await captureBlob(it))
          } catch (e) {
            setError(`Capture illisible : ${errorMessage(e)}`)
            logNative(`lecture ${it.id}: ${errorMessage(e)}`)
          } finally {
            await HoloNative.deleteCapture({ id: it.id }).catch(() => {})
          }
        }
      }
    } catch (e) {
      setError(`Impossible de lire les captures : ${errorMessage(e)}`)
      logNative(`takeCaptures: ${errorMessage(e)}`)
    } finally {
      reading.current = false
      void refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!isNative) return
    void refresh(); void take()
    const onVis = () => { if (document.visibilityState === 'visible') { void refresh(); void take() } }
    document.addEventListener('visibilitychange', onVis)
    const subs = [
      HoloNative.addListener('captureTaken', () => { void take() }),
      HoloNative.addListener('captureSessionEnded', (e) => { setStatus({ active: false, pending: 0 }); setWaiting(false); logNative(`session terminée: ${e.reason}`) }),
    ]
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      subs.forEach((s) => void s.then((h) => h.remove()).catch(() => {}))
    }
  }, [refresh, take])

  if (!isNative || hidden) return null

  const start = async () => {
    setError(''); setMsg(''); setBusy(true)
    try {
      const r = await HoloNative.startCaptureSession()
      if (!r.granted) { setError(DENIED_HELP); logNative('autorisation refusée') }
    } catch (e) {
      setError(`${DENIED_HELP} (${errorMessage(e)})`); logNative(`startCaptureSession: ${errorMessage(e)}`)
    } finally { setBusy(false); void refresh() }
  }
  const stop = async () => {
    try { await HoloNative.stopCaptureSession() } catch (e) { logNative(`stop: ${errorMessage(e)}`) }
    setWaiting(false); setMsg(''); void refresh()
  }
  const schedule = async () => {
    setError(''); setBlackCount(0)
    try {
      await HoloNative.scheduleCapture({ delayMs: 5000 })
      setWaiting(true)
      setMsg('Capture dans 5 s : retourne vite dans le jeu, sur l\'écran de fin d\'ouverture. Le téléphone vibre quand c\'est fait, puis reviens ici.')
    } catch (e) { setError(`Capture impossible : ${errorMessage(e)}`); logNative(`scheduleCapture: ${errorMessage(e)}`) }
  }

  return (
    <div className="native-cap">
      {!status.active ? (
        <>
          <button className="btn" disabled={busy} onClick={start}><Icon name="video" />Capturer depuis le jeu</button>
          <p className="muted small">Android va te demander l'autorisation de lire l'écran : choisis « Tout l'écran ».</p>
        </>
      ) : (
        <div className="card native-cap-panel">
          <p><b>Capture prête.</b> Ouvre le jeu sur l'écran de fin d'ouverture du booster, puis :</p>
          <div className="row native-cap-actions">
            <button className="btn primary" onClick={schedule}><Icon name="clock" />Capturer dans 5 s</button>
            <button className="btn ghost" onClick={stop}><Icon name="close" />Arrêter la capture</button>
          </div>
          <p className="muted small">Ou, depuis le jeu, touche « Capturer dans 3 s » dans la notification d'Holothèque.</p>
          {status.pending > 0 && <p className="small native-cap-pending"><Icon name="inbox" />{status.pending} capture{status.pending > 1 ? 's' : ''} à lire</p>}
          {waiting && msg && <p className="small">{msg}</p>}
        </div>
      )}
      {blackCount > 0 && (
        <p className="vimp-error native-cap-black" role="alert"><Icon name="warn" /><span><b>{BLACK_WARNING}</b> {blackCount > 1 ? `${blackCount} captures noires. ` : ''}Si cela se répète, dis-le moi : il faudra une autre méthode.</span></p>
      )}
      {error && <p className="vimp-error" role="alert"><Icon name="warn" />{error}</p>}
    </div>
  )
}
