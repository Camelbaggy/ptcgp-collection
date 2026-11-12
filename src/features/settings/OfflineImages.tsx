import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/PageHeader'
import { db, cardImageUrl } from '../../lib/db'
import { packUrl } from '../../lib/assets'
import {
  cacheSupported, countCached, downloadAll, formatBytes, progressPercent, type Progress,
} from '../../lib/offlineImages'

export default function OfflineImages() {
  const [cached, setCached] = useState<number | null>(null)
  const [prog, setProg] = useState<Progress | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')
  const signal = useRef({ aborted: false })
  const supported = cacheSupported()

  useEffect(() => { if (supported) void countCached().then(setCached) }, [supported])

  const start = async () => {
    signal.current = { aborted: false }
    setRunning(true); setMsg(''); setProg(null)
    try {
      const [cards, boosters] = await Promise.all([db.cards.toArray(), db.boosters.toArray()])
      const urls = [...new Set([...cards.map(cardImageUrl), ...boosters.map((b) => packUrl(b.id))])]
      const res = await downloadAll(urls, setProg, signal.current)
      setMsg(signal.current.aborted ? 'Téléchargement interrompu.'
        : res.failed ? `Terminé, ${res.failed} image(s) indisponible(s).` : 'Toutes les images sont disponibles hors connexion.')
    } catch (e) { setMsg((e as Error).message) }
    setRunning(false)
    void countCached().then(setCached)
  }

  return (
    <section className="card">
      <SectionHead icon="download" title="Images hors connexion" />
      <p className="muted">
        Les images des cartes sont téléchargées au fil de ta navigation, puis conservées sur l’appareil.
        Tu peux aussi tout télécharger d’un coup pour tout voir sans connexion (plusieurs centaines de Mo, idéalement en Wi-Fi).
      </p>
      {!supported ? <p className="muted">Le stockage hors connexion n’est pas disponible sur ce navigateur.</p> : <>
        <p className="muted">{cached === null ? '…' : `${cached} image(s) déjà conservée(s)`}</p>
        {prog && (
          <div role="status">
            <div className="bar"><i style={{ width: `${progressPercent(prog)}%` }} /></div>
            <p className="muted">{prog.done} / {prog.total} · {formatBytes(prog.bytes)} téléchargés</p>
          </div>
        )}
        {msg && <p className="muted">{msg}</p>}
        <div className="row">
          {running
            ? <button className="btn big" onClick={() => { signal.current.aborted = true }}><Icon name="close" />Annuler</button>
            : <button className="btn big" onClick={() => void start()}><Icon name="download" />Télécharger toutes les images</button>}
        </div>
      </>}
    </section>
  )
}
