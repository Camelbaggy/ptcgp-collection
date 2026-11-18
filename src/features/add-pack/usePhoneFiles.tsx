import { useRef } from 'react'
import { hasNativePicker, pickFromPhone, type PickKind } from '../../lib/native/gallery'

const ACCEPT: Record<PickKind, string> = { image: 'image/*', video: 'video/*', any: 'image/*,video/*' }

/**
 * Choix de captures ou de vidéos : sélecteur d'Android dans l'appli (les originaux pourront être
 * supprimés après l'ajout, voir `lib/native/gallery.ts`), sinon le champ fichier du navigateur.
 * Placer `input` dans le rendu et appeler `open()` depuis un bouton.
 */
export function usePhoneFiles({ kind, multiple, onFiles, onError }: {
  kind: PickKind
  multiple: boolean
  onFiles: (files: File[]) => void
  onError?: (message: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    if (hasNativePicker()) {
      pickFromPhone(kind, multiple)
        .then((fs) => { if (fs.length) onFiles(fs) })
        .catch((e) => onError?.((e as Error).message || String(e)))
      return
    }
    ref.current?.click()
  }
  const input = (
    <input ref={ref} type="file" accept={ACCEPT[kind]} multiple={multiple} hidden
      onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) onFiles(fs) }} />
  )
  return { open, input }
}
