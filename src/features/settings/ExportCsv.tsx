import { useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { Fold } from '../../components/Fold'
import { useToast } from '../../components/Toast'
import { buildCsv, CSV_SCOPES, type CsvScope, type CsvSep } from '../../lib/exportCsv'
import { copyText, downloadText, shareTextFile } from '../../lib/shareFile'
import { isNative } from '../../lib/native/holoNative'
import { useBoosters, useCards, useOwned, usePersisted, useSets, useWishlist } from '../../lib/useData'

export default function ExportCsv() {
  const toast = useToast()
  const cards = useCards(), sets = useSets(), boosters = useBoosters(), owned = useOwned(), wishlist = useWishlist()
  const [scope, setScope] = usePersisted<CsvScope>('csv.scope', 'all')
  const [sep, setSep] = usePersisted<CsvSep>('csv.sep', ';')
  const { csv, rows } = useMemo(() => buildCsv({ cards, sets, boosters, owned, wishlist }, scope, sep), [cards, sets, boosters, owned, wishlist, scope, sep])
  const tsv = useMemo(() => (sep === '\t' ? csv : buildCsv({ cards, sets, boosters, owned, wishlist }, scope, '\t').csv), [csv, cards, sets, boosters, owned, wishlist, scope, sep])
  const fileName = () => `holotheque-${scope}-${new Date().toISOString().slice(0, 10)}.csv`
  const run = (fn: () => Promise<void> | void) => { void Promise.resolve().then(fn).catch((e) => toast((e as Error).message || 'Échec de l’export')) }

  return (
    <Fold id="csv" icon="grid" color="var(--green)" title="Exporter en CSV" summary="Un tableau de ta collection pour Google Sheets ou Excel">
      <div className="muted">Contenu</div>
      <div className="chips" role="group" aria-label="Contenu de l’export">
        {CSV_SCOPES.map((s) => (
          <button key={s.id} className={`chip${scope === s.id ? ' on' : ''}`} aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 10 }}>Séparateur</div>
      <div className="chips" role="group" aria-label="Séparateur">
        <button className={`chip${sep === ';' ? ' on' : ''}`} aria-pressed={sep === ';'} onClick={() => setSep(';')}>; (Excel FR)</button>
        <button className={`chip${sep === ',' ? ' on' : ''}`} aria-pressed={sep === ',' } onClick={() => setSep(',')}>, (Sheets)</button>
      </div>
      <p className="muted">{rows.toLocaleString('fr-FR')} ligne{rows > 1 ? 's' : ''}. « Copier » donne un tableau que tu colles directement dans une cellule de Google Sheets.</p>
      <div className="row">
        {!isNative && <button className="btn big" disabled={rows === 0} onClick={() => run(() => { downloadText(fileName(), csv, 'text/csv'); toast('CSV téléchargé') })}><Icon name="download" />Télécharger</button>}
        <button className="btn big" disabled={rows === 0} onClick={() => run(async () => { await copyText(tsv); toast('Tableau copié, colle-le dans Sheets') })}><Icon name="inbox" />Copier</button>
        <button className="btn big" disabled={rows === 0} onClick={() => run(async () => {
          if (!(await shareTextFile(fileName(), csv, 'text/csv', 'Collection Holothèque'))) { await copyText(tsv); toast('Partage indisponible ici : Tableau copié') }
        })}><Icon name="ext" />Partager</button>
      </div>
    </Fold>
  )
}
