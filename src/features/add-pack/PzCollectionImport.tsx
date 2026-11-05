import { useMemo, useRef, useState } from 'react'
import { applyCorrections, cardImageUrl, undoLast } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, useBoosters, useCards, useOwned, useSets } from '../../lib/useData'
import { parsePzCollection, resolvePzCollection, type PzCardRow, type PzMatch } from '../../lib/importers/pzCollection'
import type { Card } from '../../lib/types'

interface FileResult { file: string; setId: string | null; matches: PzMatch[]; unknown: PzCardRow[] }

/**
 * Mise à jour depuis la page « collection d'une extension » de Pokémon-Zone, enregistrée
 * par l'utilisateur (Ctrl+S) après avoir synchronisé son compte sur le site.
 * Rien n'est envoyé en ligne : le fichier est lu dans l'appli.
 */
export default function PzCollectionImport() {
  const sets = useSets()
  const cards = useCards()
  const boosters = useBoosters()
  const owned = useOwned()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [results, setResults] = useState<FileResult[] | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showAll, setShowAll] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true); setErrors([]); setResults(null); setEdits({}); setShowAll(false)
    const out: FileResult[] = []
    const errs: string[] = []
    const setIds = sets.map((s) => s.id)
    try {
      for (const f of Array.from(list)) {
        try {
          const page = parsePzCollection(await f.text())
          if (!page.rows.length) { errs.push(`${f.name} : aucune carte trouvée. Enregistre la page « Sets » d'une extension de ton profil Pokémon-Zone.`); continue }
          out.push({ file: f.name, ...resolvePzCollection(page, cards, boosters, setIds) })
        } catch { errs.push(`${f.name} : lecture impossible`) }
      }
    } finally {
      setBusy(false)
      setErrors(errs)
      if (out.length) setResults(out)
    }
  }

  // une ligne par carte (si deux pages citent la même carte, la dernière l'emporte)
  const rows = useMemo(() => {
    const m = new Map<string, { card: Card; read: number; setId: string | null }>()
    for (const r of results ?? []) for (const x of r.matches) m.set(x.card.id, { card: x.card, read: x.row.count, setId: r.setId })
    return [...m.values()].map((x) => ({ ...x, cur: owned.get(x.card.id) ?? 0 }))
  }, [results, owned])

  const valueOf = (r: (typeof rows)[number]) => {
    const e = edits[r.card.id]
    return e !== undefined && e !== '' ? Number(e) : r.read
  }
  const changed = rows.filter((r) => valueOf(r) !== r.cur)
  const lower = changed.filter((r) => valueOf(r) < r.cur)
  const shown = [...(showAll ? rows : changed)].sort((a, b) => a.card.setId.localeCompare(b.card.setId) || a.card.number - b.card.number)
  const unknown = (results ?? []).flatMap((r) => r.unknown)
  const setName = (id: string | null) => sets.find((s) => s.id === id)?.name ?? id ?? '?'

  const save = async () => {
    const ev = await applyCorrections(changed.map((r) => ({ cardId: r.card.id, to: valueOf(r) })))
    const n = changed.length
    setResults(null); setEdits({})
    toast(ev ? `${n} carte(s) mise(s) à jour` : 'Rien à changer', ev ? { label: 'Annuler', run: () => void undoLast() } : undefined)
  }

  if (!results) {
    return (
      <div className="card vimp-help">
        <h3><Icon name="upload" />Mettre à jour depuis Pokémon-Zone</h3>
        <ol>
          <li>Sur pokemon-zone.com, synchronise ton compte puis ouvre ton profil, onglet <b>« Sets »</b>, et choisis une extension.</li>
          <li>Enregistre la page (Ctrl+S sur PC, « Télécharger la page » sur téléphone). Le dossier _files n'est pas nécessaire.</li>
          <li>Importe le fichier .html ici. Tu peux en choisir plusieurs, une extension par fichier.</li>
        </ol>
        <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name={busy ? 'sync' : 'upload'} />{busy ? 'Lecture…' : 'Choisir les pages .html'}
        </button>
        <input ref={input} type="file" accept=".html,.htm,text/html" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
        {errors.map((m) => <p key={m} className="vimp-error"><Icon name="warn" />{m}</p>)}
      </div>
    )
  }

  return (
    <>
      <div className="card vimp-sum">
        {results.map((r) => (
          <p key={r.file} className="pzc-set">
            {r.setId && <SetLogo setId={r.setId} name={setName(r.setId)} />}
            <span><b>{setName(r.setId)}</b> · {r.matches.length} cartes lues{r.unknown.length ? ` · ${r.unknown.length} non reconnues` : ''}</span>
          </p>
        ))}
        <p><b>{changed.length}</b> changement{changed.length > 1 ? 's' : ''}{lower.length ? <> · dont <b>{lower.length}</b> en baisse</> : null}</p>
        {lower.length > 0 && <p className="muted small">Pokémon-Zone indique moins d'exemplaires que l'appli pour certaines cartes. Si tu as ouvert des boosters depuis ta dernière synchronisation sur le site, resynchronise et réenregistre la page.</p>}
        {errors.map((m) => <p key={m} className="vimp-error"><Icon name="warn" />{m}</p>)}
        {unknown.length > 0 && <p className="muted small">Non reconnues, donc ignorées : {unknown.map((u) => `${u.nameEn || '?'} (n° ${u.number})`).join(', ')}.</p>}
        <label className="vimp-all"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Afficher toutes les cartes</label>
      </div>
      <div className="bulklist">
        {shown.map((r) => {
          const v = valueOf(r)
          return (
            <div key={r.card.id} className={'vimp-line' + (v !== r.cur ? ' changed' : '')}>
              <img className="vimp-thumb" src={cardImageUrl(r.card)} alt="" loading="lazy" />
              <span className="grow vimp-name">
                <span className="nm">{r.card.name}</span>
                <span className="muted small">{r.card.id} · {RARITY_LABEL[r.card.rarity]}</span>
              </span>
              <span className="vimp-from mono">{r.cur} →</span>
              <input className="bulk-input" inputMode="numeric" autoComplete="off" aria-label={`Quantité ${r.card.name}`}
                value={edits[r.card.id] ?? String(v)} onFocus={(e) => e.target.select()}
                onChange={(e) => setEdits((p) => ({ ...p, [r.card.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            </div>
          )
        })}
        {!shown.length && <p className="muted vimp-none">Aucun changement : ta collection est déjà à jour.</p>}
      </div>
      <div className="actionbar">
        <span>{changed.length} modifiée{changed.length > 1 ? 's' : ''}</span>
        <button className="btn ghost" onClick={() => { setResults(null); setEdits({}) }}>Annuler</button>
        <button className="btn primary" disabled={!changed.length} onClick={save}>Enregistrer</button>
      </div>
    </>
  )
}
