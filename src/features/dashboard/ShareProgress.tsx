import { useEffect, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'
import { renderShareImage } from '../../lib/shareImage/render'
import { downloadImage, shareImage } from '../../lib/shareImage/share'
import type { ShareData } from '../../lib/shareImage/data'
import { useToast } from '../../components/Toast'

/** Feuille « Partager ma progression » : aperçu de l'image générée, puis partage ou enregistrement. */
export default function ShareProgress({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const toast = useToast()
  const [filename] = useState(() => `holotheque-${new Date().toISOString().slice(0, 10)}.png`)

  useEffect(() => {
    let alive = true
    let u: string | null = null
    renderShareImage(data).then((b) => {
      if (!alive) return
      u = URL.createObjectURL(b)
      setBlob(b); setUrl(u)
    }).catch(() => { if (alive) setError(true) })
    return () => { alive = false; if (u) URL.revokeObjectURL(u) }
  }, [data])

  const share = async () => {
    if (!blob) return
    try {
      const r = await shareImage(blob, filename, 'Ma collection Pokémon TCG Pocket')
      if (r === 'downloaded') toast('Image enregistrée dans tes téléchargements')
    } catch {
      toast('Partage impossible, essaie « Enregistrer ».')
    }
  }

  return (
    <Sheet title="Partager ma progression" onClose={onClose}>
      <div className="share-prev">
        {error ? <p className="ptc-empty">Impossible de générer l'image.</p>
          : url ? <img src={url} alt={`Image de progression : ${data.owned} cartes sur ${data.total}`} />
            : <p className="ptc-empty">Création de l'image…</p>}
      </div>
      <div className="share-actions">
        <button type="button" className="btn primary" disabled={!blob} onClick={() => { void share() }}><Icon name="share" />Partager</button>
        <button type="button" className="btn" disabled={!blob} onClick={() => blob && downloadImage(blob, filename)}><Icon name="download" />Enregistrer</button>
      </div>
      <p className="share-hint">L'image ne contient que tes chiffres de collection, rien d'autre.</p>
    </Sheet>
  )
}
