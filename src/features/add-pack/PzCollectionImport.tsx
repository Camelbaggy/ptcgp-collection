import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { applyCorrections, BASE, cardImageUrl, undoLast } from '../../lib/db'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, setLabel, splitSets, useBoosters, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import { inflatePzPayload, parsePzCollection, parsePzPayload, pzPlayerFromUrl, pzSetUrl, resolvePzCollection, type PzCardRow, type PzCollectionPage, type PzMatch } from '../../lib/importers/pzCollection'
import PzBookmarklet from './PzBookmarklet'
import type { Card } from '../../lib/types'

/**
 * Les cartes restaurées depuis une ancienne sauvegarde peuvent ne pas avoir d'entité du jeu :
 * on la reprend des données livrées, nécessaire pour reconnaître les rééditions.
 */
async function withEntities(cards: Card[]): Promise<Card[]> {
  if (cards.every((c) => c.entityId !== undefined)) return cards
  try {
    const res = await fetch(`${BASE}data/cards.json`)
    if (!res.ok) return cards
    const shipped = new Map((await res.json() as Card[]).map((c) => [c.id, c]))
    return cards.map((c) => {
      const s = shipped.get(c.id)
      return c.entityId === undefined && s?.entityId !== undefined ? { ...c, entityId: s.entityId, entityKind: s.entityKind } : c
    })
  } catch { return cards }
}

interface FileResult { file: string; setId: string | null; matches: PzMatch[]; unknown: PzCardRow[]; hasMore: boolean }

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
  const [player, setPlayer] = usePersisted('pz.player', '')
  const [openSet, setOpenSet] = usePersisted('pz.setId', '')
  const [profileUrl, setProfileUrl] = useState('')
  const grouped = splitSets(sets)
  const curSet = sets.find((s) => s.id === openSet) ?? grouped.regular[grouped.regular.length - 1]

  const load = async (items: { name: string; read: () => Promise<PzCollectionPage[] | null> }[]) => {
    if (!items.length) return
    setBusy(true); setErrors([]); setResults(null); setEdits({}); setShowAll(false)
    const out: FileResult[] = []
    const errs: string[] = []
    const setIds = sets.map((s) => s.id)
    try {
      const known = await withEntities(cards)
      for (const it of items) {
        try {
          const pages = (await it.read() ?? []).filter((p) => p.rows.length)
          if (!pages.length) { errs.push(`${it.name} : aucune carte trouvée. Utilise la page « Sets » d'une extension de ton profil Pokémon-Zone.`); continue }
          for (const page of pages) {
            if (page.playerId) setPlayer(page.playerId)
            out.push({ file: `${it.name} ${page.setSlug ?? ''}`, hasMore: page.hasMore, ...resolvePzCollection(page, known, boosters, setIds) })
          }
        } catch { errs.push(`${it.name} : lecture impossible`) }
      }
    } finally {
      setBusy(false)
      setErrors(errs)
      if (out.length) setResults(out)
    }
  }
  const onFiles = (list: File[]) => load(list.map((f) => ({ name: f.name, read: async () => [parsePzCollection(await f.text())] })))

  // données envoyées par le favori : #/ajout?onglet=pz&pz=…
  const [params, setParams] = useSearchParams()
  const payload = params.get('pz')
  const packed = params.get('pzz')
  const ready = cards.length > 0 && sets.length > 0
  useEffect(() => {
    if ((!payload && !packed) || !ready) return
    setParams({ onglet: 'pz' }, { replace: true }) // ne pas garder les données dans l'adresse
    void load([{ name: 'Favori', read: async () => parsePzPayload(packed ? await inflatePzPayload(packed) : payload!) }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, packed, ready])

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
      <>
        <div className="card vimp-help">
          <h3><Icon name="upload" />Mettre à jour depuis Pokémon-Zone</h3>
          {player ? (
            <>
              <div className="row pzc-open">
                {curSet && <SetLogo setId={curSet.id} name={curSet.name} />}
                <select className="input" aria-label="Extension à ouvrir" value={curSet?.id ?? ''} onChange={(e) => setOpenSet(e.target.value)}>
                  {grouped.regular.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
                  {grouped.special.length > 0 && <optgroup label="Promos et spéciaux">{grouped.special.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}</optgroup>}
                </select>
              </div>
              <a className="btn primary" href={curSet ? pzSetUrl(player, curSet.id) : undefined} target="_blank" rel="noopener noreferrer">
                <Icon name="upload" />Ouvrir sur Pokémon-Zone
              </a>
              <ol>
                <li>Sur Pokémon-Zone, synchronise ton compte si tu as ouvert des boosters depuis la dernière fois.</li>
                <li>Lance le favori <b>Holothèque</b> : il charge toutes les cartes et te ramène ici.</li>
                <li>Vérifie les changements, puis « Enregistrer ».</li>
              </ol>
            </>
          ) : (
            <>
              <p className="small">Colle une fois l'adresse de ton profil Pokémon-Zone (par exemple pokemon-zone.com/players/123…/). L'appli s'en souviendra pour ouvrir directement tes extensions.</p>
              <div className="row pzc-open">
                <input className="input" inputMode="url" placeholder="Adresse de ton profil Pokémon-Zone" aria-label="Adresse de ton profil Pokémon-Zone" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} />
                <button className="btn" disabled={!pzPlayerFromUrl(profileUrl)} onClick={() => setPlayer(pzPlayerFromUrl(profileUrl) ?? '')}>OK</button>
              </div>
              {profileUrl && !pzPlayerFromUrl(profileUrl) && <p className="muted small">Adresse non reconnue : elle doit contenir pokemon-zone.com/players/…</p>}
            </>
          )}
          {busy && <p className="muted"><Icon name="sync" />Lecture…</p>}
          {errors.map((m) => <p key={m} className="vimp-error"><Icon name="warn" />{m}</p>)}
          <PzBookmarklet />
          {player && <button className="btn ghost small pzc-forget" onClick={() => setPlayer('')}>Changer de profil Pokémon-Zone</button>}
        </div>
        <details className="card pzc-file">
          <summary><Icon name="layers" />Avec une page enregistrée (.html, .mhtml)</summary>
          <ol>
            <li>Sur ton profil Pokémon-Zone, onglet <b>« Sets »</b>, ouvre une extension et clique sur <b>« Load More »</b> jusqu'à ce que le bouton disparaisse.</li>
            <li>Enregistre la page (Ctrl+S sur PC, « Télécharger la page » sur téléphone). Le dossier _files n'est pas nécessaire.</li>
            <li>Importe le fichier ici. Tu peux en choisir plusieurs, une extension par fichier.</li>
          </ol>
          <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
            <Icon name={busy ? 'sync' : 'upload'} />{busy ? 'Lecture…' : 'Choisir les pages enregistrées'}
          </button>
          <input ref={input} type="file" accept=".html,.htm,.mht,.mhtml,text/html,multipart/related,message/rfc822" multiple hidden onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void onFiles(files) }} />
        </details>
      </>
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
        {results.filter((r) => r.hasMore).map((r) => (
          <p key={'more' + r.file} className="vimp-error"><Icon name="warn" />Page {setName(r.setId)} incomplète : seules les {r.matches.length + r.unknown.length} premières cartes y figurent. Sur Pokémon-Zone, clique sur « Load More » jusqu'en bas puis réenregistre la page. Les cartes absentes restent inchangées.</p>
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
