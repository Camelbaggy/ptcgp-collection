import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Fold } from '../../components/Fold'
import { useToast } from '../../components/Toast'
import { FREQ_LABEL, KEEP_COPIES, getFreq, getLastBackup, setFreq, sinceLabel, type BackupFreq } from '../../lib/autoBackup'
import { chooseFolder, folderSupported, forgetFolder, getFolder, writeToFolder } from '../../lib/backupFolder'

/** Réglages › rappel/écriture périodique de la sauvegarde JSON (voir lib/autoBackup.ts). */
export default function AutoBackup() {
  const toast = useToast()
  const [freq, setF] = useState<BackupFreq>(getFreq())
  const [folder, setFolder] = useState<string | null>(null)
  const [last, setLast] = useState(getLastBackup())
  const supported = folderSupported()

  useEffect(() => { void getFolder().then((h) => setFolder(h?.name ?? null)) }, [])

  const pick = async () => {
    try { const n = await chooseFolder(); if (n) { setFolder(n); toast(`Dossier : ${n}`) } } catch (e) { toast((e as Error).message) }
  }
  const now = async () => {
    const r = await writeToFolder(true)
    if (r.ok) { setLast(getLastBackup()); toast(`Sauvegarde écrite : ${r.name}`) }
    else toast(r.reason === 'permission' ? 'Autorisation refusée pour ce dossier.' : r.message ?? 'Sauvegarde impossible.')
  }
  return (
    <Fold id="autobackup" icon="clock" color="var(--green)" title="Sauvegarde automatique"
      summary={`${freq === 'off' ? 'Désactivée' : `Chaque ${FREQ_LABEL[freq].toLowerCase()}`} · dernière : ${sinceLabel(last)}`}>
      <p className="muted">
        {supported
          ? `À l’ouverture de l’appli, une copie JSON est écrite dans le dossier choisi si la dernière est trop ancienne (les ${KEEP_COPIES} plus récentes sont gardées). Si le navigateur demande une autorisation, un rappel s’affiche.`
          : 'Ce navigateur ne peut pas écrire dans un dossier : un rappel s’affiche quand la dernière sauvegarde est trop ancienne, avec un bouton pour télécharger le fichier.'}
      </p>
      <div className="seg" role="group" aria-label="Fréquence de la sauvegarde">
        {(Object.keys(FREQ_LABEL) as BackupFreq[]).map((f) => (
          <button key={f} className={freq === f ? 'on' : ''} onClick={() => { setF(f); setFreq(f) }}>{FREQ_LABEL[f]}</button>
        ))}
      </div>
      {supported && (
        <div className="row">
          <span className="muted grow">Dossier : <b>{folder ?? 'aucun'}</b></span>
          <button className="btn" onClick={() => void pick()}><Icon name="download" />{folder ? 'Changer' : 'Choisir un dossier'}</button>
          {folder && <button className="btn" onClick={() => void now()}>Sauvegarder maintenant</button>}
          {folder && <button className="btn ghost" onClick={() => void forgetFolder().then(() => setFolder(null))}>Oublier</button>}
        </div>
      )}
      <p className="muted">Dernière sauvegarde : <b>{sinceLabel(last)}</b></p>
    </Fold>
  )
}
