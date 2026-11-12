import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { BASE } from '../../lib/db/schema'
import { isNative } from '../../lib/native/holoNative'
import { buildCatalog, filterIcons, findIcon, type IconKind, type Names, type ProfileIcon } from '../../lib/profileIcons/catalog'
import { cancelPzIconsRead, startPzIconsRead, usePzIconsRead } from '../../lib/profileIcons/pzRead'
import { iconImageUrl, PZ_ICONS_URL, savePzIcons, useProfileIconsState } from '../../lib/profileIcons/store'
import { initialOf, profileCssColor } from '../../lib/profiles'
import { useCards, useSets } from '../../lib/useData'

const TRAINER_TYPES = new Set(['Supporter', 'Dresseur', 'Objet', 'Outil', 'Outil Pokémon', 'Stade'])

let jpP: Promise<Record<string, string>> | null = null
function useJpNames(): Record<string, string> {
  const [jp, setJp] = useState<Record<string, string>>({})
  useEffect(() => {
    jpP ??= fetch(`${BASE}data/jp-names.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    let live = true
    void jpP.then((v) => { if (live) setJp(v) })
    return () => { live = false }
  }, [])
  return jp
}

/** Noms français : cartes (nom anglais → français), extensions, jetons japonais des fichiers Pokémon-Zone. */
function useNames(): Names {
  const cards = useCards()
  const sets = useSets()
  const jp = useJpNames()
  return useMemo(() => {
    const byEn = new Map<string, { name: string; trainer: boolean }>()
    const add = (en: string, name: string, trainer: boolean) => { const k = en.toLowerCase(); if (!byEn.has(k)) byEn.set(k, { name, trainer }) }
    for (const c of cards) {
      if (!c.nameEn || !c.name) continue
      const trainer = TRAINER_TYPES.has(c.type ?? '')
      add(c.nameEn, c.name, trainer)
      if (/ ex$/.test(c.nameEn)) add(c.nameEn.slice(0, -3), c.name.replace(/ ex$/, ''), trainer)
    }
    const setName = new Map(sets.map((s) => [s.id, s.name]))
    return { card: (en) => byEn.get(en.toLowerCase()), setName: (id) => setName.get(id), jp: (t) => jp[t] }
  }, [cards, sets, jp])
}

const KINDS: [IconKind | 'all', string][] = [['all', 'Toutes'], ['pokemon', 'Pokémon'], ['trainer', 'Dresseurs']]

/** Feuille « Choisis ton icône » : grille des icônes du jeu (plus récentes d'abord), recherche, filtre ; l'initiale reste un choix. */
export function IconPicker({ value, name, color, onPick, onClose }: {
  value: string | undefined; name: string; color: string; onPick: (icon: string | undefined) => void; onClose: () => void
}) {
  const s = useProfileIconsState()
  const names = useNames()
  const catalog = useMemo(() => buildCatalog(s.serebii, s.pz, names), [s.serebii, s.pz, names])
  const [sel, setSel] = useState<string | undefined>(() => findIcon(catalog, value)?.id ?? (value || undefined))
  const [kind, setKind] = useState<IconKind | 'all'>('all')
  const [q, setQ] = useState('')
  const shown = useMemo(() => filterIcons(catalog, kind, q), [catalog, kind, q])
  const current = findIcon(catalog, sel)
  const counts = useMemo(() => ({ all: catalog.length, pokemon: catalog.filter((i) => i.kind === 'pokemon').length, trainer: catalog.filter((i) => i.kind === 'trainer').length }), [catalog])

  return (
    <Sheet title="Choisis ton icône" onClose={onClose} full>
      <div className="ip-prev">
        {current ? <span className="pf-av pf-av-xl pf-av-img" style={{ '--c': profileCssColor(color) } as CSSProperties}><img src={iconImageUrl(current)} alt="" referrerPolicy="no-referrer" /></span>
          : <span className="pf-av pf-av-xl" style={{ '--c': profileCssColor(color) } as CSSProperties}>{initialOf(name)}</span>}
        <span className="grow">
          <b>{current ? current.name : 'Initiale'}</b>
          <small className="muted">{current ? current.source || 'Icône du jeu' : 'La première lettre du nom, dans la couleur du profil'}</small>
        </span>
      </div>
      <label className="ip-search">
        <Icon name="search" />
        <input type="search" value={q} placeholder="Rechercher (Pikachu, Méga, Team Rocket…)" aria-label="Rechercher une icône" onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Genre">
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" className={'chip' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}{k === 'all' && ` · ${counts.all}`}
          </button>
        ))}
      </div>
      <div className="ip-grid" role="radiogroup" aria-label="Icônes">
        {kind === 'all' && !q && (
          <button type="button" role="radio" aria-checked={!sel} className={'ip-cell' + (!sel ? ' on' : '')} onClick={() => setSel(undefined)}>
            <span className="pf-av" style={{ '--c': profileCssColor(color) } as CSSProperties}>{initialOf(name)}</span>Initiale
          </button>
        )}
        {shown.map((i) => <IconCell key={i.id} icon={i} on={sel === i.id} onClick={() => setSel(i.id)} />)}
      </div>
      {!shown.length && <p className="muted">{catalog.length ? 'Aucune icône ne correspond.' : 'Aucune icône pour l’instant : charge le catalogue ci-dessous.'}</p>}
      <CatalogSource count={s.pz.length} at={s.pzAt} />
      <div className="ip-actions">
        <button type="button" className="btn primary grow" onClick={() => { onPick(sel); onClose() }}><Icon name="check" />Choisir</button>
        <button type="button" className="btn" onClick={onClose}>Annuler</button>
      </div>
    </Sheet>
  )
}

function IconCell({ icon, on, onClick }: { icon: ProfileIcon; on: boolean; onClick: () => void }) {
  const [broken, setBroken] = useState(false)
  return (
    <button type="button" role="radio" aria-checked={on} className={'ip-cell' + (on ? ' on' : '')} onClick={onClick} title={icon.source ? `${icon.name} · ${icon.source}` : icon.name} aria-label={icon.name}>
      <span className="pf-av pf-av-img">
        {!broken && <img src={iconImageUrl(icon)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
      </span>
      <span className="ip-name">{icon.name}</span>
    </button>
  )
}

/** Catalogue complet : lu dans l'appli Android, ou importé de la page « Icons » de Pokémon-Zone enregistrée. */
function CatalogSource({ count, at }: { count: number; at: string | null }) {
  const toast = useToast()
  const read = usePzIconsRead()
  const input = useRef<HTMLInputElement>(null)
  const date = at ? new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null
  const onFiles = async (files: File[]) => {
    try { toast(`${savePzIcons(await Promise.all(files.map((f) => f.text())))} icônes importées`) } catch (e) { toast((e as Error).message) }
  }
  return (
    <section className="ip-source">
      <p className="muted">
        {count ? `Catalogue complet Pokémon-Zone : ${count} icônes (lu le ${date}).` : 'Seules les icônes récentes sont incluses dans l’appli. Pour avoir toutes les autres, charge le catalogue de Pokémon-Zone.'}
        {read.running && <> {read.label}</>}
        {read.error && <span style={{ color: 'var(--warn)' }}> {read.error}</span>}
      </p>
      {isNative ? (
        read.running ? <button type="button" className="btn" onClick={cancelPzIconsRead}><Icon name="close" />Arrêter</button>
          : <button type="button" className="btn" onClick={() => void startPzIconsRead(false)}><Icon name="sync" />{count ? 'Actualiser depuis Pokémon-Zone' : 'Charger toutes les icônes'}</button>
      ) : (
        <>
          <p className="muted">
            Ouvre <a href={PZ_ICONS_URL} target="_blank" rel="noreferrer">la page des icônes de Pokémon-Zone</a>, enregistre-la (Ctrl+S, page complète ou .mht) puis importe-la ici.
          </p>
          <button type="button" className="btn" onClick={() => input.current?.click()}><Icon name="upload" />Importer la page enregistrée</button>
          <input ref={input} type="file" accept=".html,.htm,.mht,.mhtml,text/html,multipart/related,message/rfc822" hidden
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void onFiles(files) }} />
        </>
      )}
    </section>
  )
}
