import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { downloadBackup } from '../../lib/backupFile'
import { getFolder, folderSupported, writeToFolder } from '../../lib/backupFolder'
import { getLastBackup, shouldRemind, sinceLabel, snoozeReminder } from '../../lib/autoBackup'
import { db } from '../../lib/db'

/**
 * Sauvegarde périodique : à l'ouverture (et au retour sur l'appli), si une copie est due, l'écrit dans le dossier choisi
 * quand le navigateur le permet déjà, sinon affiche un rappel avec un bouton « Sauvegarder ».
 */
export default function BackupController() {
  const toast = useToast()
  const [remind, setRemind] = useState(false)
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    if (!shouldRemind()) { setRemind(false); return }
    if ((await db.owned.count()) === 0) return // rien à sauvegarder
    if (folderSupported() && (await getFolder())) {
      const r = await writeToFolder(false)
      if (r.ok) { setRemind(false); toast(`Sauvegarde automatique : ${r.name}`); return }
    }
    setRemind(true)
  }, [toast])

  useEffect(() => {
    const t = setTimeout(() => void check(), 4000)
    const onVis = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [check])

  if (!remind) return null
  const run = async () => {
    setBusy(true)
    try {
      const r = folderSupported() ? await writeToFolder(true) : { ok: false as const }
      if (r.ok) toast(`Sauvegarde écrite : ${r.name}`)
      else { await downloadBackup(); toast('Sauvegarde téléchargée') }
      setRemind(false)
    } catch (e) { toast('Sauvegarde impossible : ' + (e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <div className="update-banner backup-banner" role="status">
      <span className="tile-ic"><Icon name="download" /></span>
      <span className="grow">Dernière sauvegarde : {sinceLabel(getLastBackup())}</span>
      <button className="btn small primary" disabled={busy} onClick={() => void run()}>Sauvegarder</button>
      <button className="btn small ghost" aria-label="Plus tard" onClick={() => { snoozeReminder(); setRemind(false) }}><Icon name="close" /></button>
    </div>
  )
}
