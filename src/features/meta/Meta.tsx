import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { isNative } from '../../lib/native/holoNative'
import { useCardById, useCards, useOwned, usePersisted, useRates } from '../../lib/useData'
import type { MetaDeck } from '../../lib/meta/compute'
import { MAX_NEAR, buildContext, deckBuild, type DeckBuild } from '../../lib/meta/buildable'
import { matchPmDeck } from '../../lib/pocketMads/match'
import { parsePmRaw } from '../../lib/pocketMads/parse'
import { decodePmPayload, savePmTierList, usePmTierList } from '../../lib/pocketMads/store'
import type { PmDeck, PmRaw, PmTierList } from '../../lib/pocketMads/types'
import { usePmSync } from '../../lib/pocketMads/auto'
import { HOME_WINDOW, PM_STALE_HOURS, chooseMetaSource, hasHomeTiers, homeTierList, type MetaSource } from '../../lib/meta/source'
import { DeckRow } from './DeckRow'
import MetaDetail from './MetaDetail'
import { PM_WEB_HELP, PmSync, pmRefresh, usePmSupported } from './PmSync'
import { TIER_LABEL, TIER_SUB, dateTimeFr, metaStaleHours, useMeta } from './useMeta'
import './meta.css'

type BuildFilter = 'all' | 'ready' | 'near'

export interface OpenDeck { deck: MetaDeck | null; pm: PmDeck | null; tier: string | null; source: MetaSource }

export default function Meta() {
  const { meta, loading, reload } = useMeta()
  const [loadedAt] = useState(() => Date.now())
  const staleHours = meta ? metaStaleHours(meta.generatedAt, loadedAt) : null
  const pm = usePmTierList()
  const cardById = useCardById()
  const [open, setOpen] = useState<OpenDeck | null>(null)
  const [params, setParams] = useSearchParams()
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = usePersisted<BuildFilter>('meta.build', 'all')
  const cards = useCards()
  const owned = useOwned()
  const rates = useRates()
  const pmSync = usePmSync()
  const pmSupported = usePmSupported()
  const [webSheet, setWebSheet] = useState(false)
  // PocketMads quand sa lecture est récente, sinon repli sur le calcul Holothèque (meta.json)
  const choice = chooseMetaSource(pm, meta, loadedAt, !!pmSync.error)
  const [forced, setForced] = useState<MetaSource | null>(null)
  const canHome = hasHomeTiers(meta)
  const source: MetaSource | null = forced === 'home' && canHome ? 'home' : forced === 'pm' && pm ? 'pm' : choice.source
  const both = !!pm && canHome
  const list = useMemo<PmTierList | null>(() => (source === 'home' && meta ? homeTierList(meta) : source === 'pm' ? pm ?? null : null), [source, meta, pm])

  // données envoyées par le favori, lancé sur la tier list PocketMads : on demande confirmation avant d'écraser
  const payload = params.get('pm')
  const [pending, setPending] = useState<PmTierList | null>(null)
  useEffect(() => {
    if (!payload) return
    try {
      // oxlint-disable-next-line react/set-state-in-effect -- lecture unique de l'adresse (?pm=), retirée aussitôt
      setPending(parsePmRaw(decodePmPayload(payload) as PmRaw))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Données PocketMads illisibles.')
    }
    setParams({}, { replace: true })
  }, [payload, setParams])
  const nbPending = pending ? pending.tiers.reduce((n, x) => n + x.decks.length, 0) : 0
  const confirmPending = async () => {
    if (!pending) return
    await savePmTierList(pending)
    setMsg(`Tier list PocketMads importée : ${nbPending} decks.`)
    setPending(null)
  }

  const decks = useMemo(() => meta?.decks ?? [], [meta])
  // ce qu'il manque pour monter la liste type de chaque deck Limitless
  const builds = useMemo(() => {
    const ctx = buildContext(cards, owned, rates)
    return new Map(decks.filter((d) => d.consensus.length).map((d) => [d.id, deckBuild(d.consensus, ctx)]))
  }, [decks, cards, owned, rates])
  const buildOf = (d: MetaDeck | null): DeckBuild | undefined => (d ? builds.get(d.id) : undefined)
  const keep = (d: MetaDeck | null) => {
    const b = buildOf(d)
    return filter === 'all' || (!!b && (filter === 'ready' ? b.missing === 0 : b.missing <= MAX_NEAR))
  }
  const nbReady = [...builds.values()].filter((b) => b.missing === 0).length
  const nbNear = [...builds.values()].filter((b) => b.missing <= MAX_NEAR).length
  // tous les tiers, même vides (Tier 0 l'est le plus souvent)
  const groups = useMemo(() => (list?.tiers ?? [])
    .filter((t) => t.decks.length || t.key !== null)
    .map((t) => ({ ...t, rows: t.decks.map((d) => ({ pm: d, deck: matchPmDeck(d, decks) })) })), [list, decks])
  const visible = groups.map((g) => ({ ...g, rows: g.rows.filter((x) => keep(x.deck)) }))
  const tierOfDeck = (d: MetaDeck): { pm: PmDeck | null; tier: string | null } => {
    for (const t of list?.tiers ?? []) for (const x of t.decks) if (matchPmDeck(x, [d])) return { pm: x, tier: t.key }
    return { pm: null, tier: null }
  }

  const help = [
    ...(source === 'home' ? [{ title: 'Calcul Holothèque', text: `${choice.source === 'home' ? (
      choice.reason === 'error' ? 'La lecture de PocketMads a échoué : '
        : choice.reason === 'stale' ? `Ta tier list PocketMads date de plus de ${choice.pmAgeHours !== undefined ? Math.max(2, Math.floor(choice.pmAgeHours / 24)) : PM_STALE_HOURS / 24} jours (site indisponible ?) : `
          : 'Pas encore de tier list PocketMads : ') + 'voici en secours le calcul Holothèque. ' : ''}À partir des tournois Limitless des ${HOME_WINDOW.replace(/d$/, '')} derniers jours (${meta?.windows[HOME_WINDOW]?.matches.toLocaleString('fr-FR') ?? '?'} matchs, ${meta?.windows[HOME_WINDOW]?.tournaments ?? '?'} tournois). Score 0–100 : popularité, victoires et résultats contre les decks les plus joués.` }] : []),
    ...(source === 'pm' && pm ? [{ title: 'Source', text: `Tier list PocketMads${pm.range ? ` (${pm.range.replace(/d$/, ' jours')})` : ''}${pm.updated ? ` · calculée le ${pm.updated}` : ''} · lue le ${dateTimeFr(pm.fetchedAt)}. Listes types et matchups : Limitless${meta ? `, ${dateTimeFr(meta.generatedAt)}` : ''}.` }] : []),
    ...(!isNative ? [{ title: 'Actualisation', text: 'L’icône d’actualisation recharge les données Limitless (calcul Holothèque, listes, matchups) et ouvre la lecture de PocketMads.' }, ...PM_WEB_HELP] : [{ title: 'Actualisation', text: 'L’icône d’actualisation relit PocketMads et recharge les données Limitless (calcul Holothèque, listes, matchups). PocketMads est aussi actualisée toute seule à l’ouverture de l’appli, au plus toutes les 6 h.' }]),
  ]

  return (
    <div className="page meta" data-section="red">
      <PageHeader icon="trophy" title="Méta" help={help}
        actions={[{ icon: 'sync', label: 'Actualiser la Méta', onClick: () => { void reload(); pmRefresh(pmSupported, () => setWebSheet(true))() } }]} />
      {pending && (
        <section className="card meta-msg">
          <p>Un lien veut remplacer ta tier list PocketMads par une liste de {nbPending} decks. Tu l’as bien lancé toi-même depuis PocketMads ?</p>
          <div className="row">
            <button className="btn big" onClick={() => void confirmPending()}><Icon name="check" />Importer</button>
            <button className="btn big" onClick={() => setPending(null)}>Ignorer</button>
          </div>
        </section>
      )}
      {msg && <p className="card meta-msg"><Icon name="check" /> {msg}</p>}
      <PmSync supported={pmSupported} webOpen={webSheet} onWebClose={() => setWebSheet(false)} />
      {pm !== undefined && !loading && !list && <EmptyState icon="trophy" title="Pas encore de tier list" text="Lis la tier list PocketMads avec le bouton ci-dessus." />}
      {list && (
        <>
          {both && (
            <div className="chips meta-source" role="group" aria-label="Source de la tier list">
              {([['pm', 'PocketMads'], ['home', 'Calcul Holothèque']] as [MetaSource, string][]).map(([v, label]) => (
                <button key={v} className={'chip' + (source === v ? ' on' : '')} aria-pressed={source === v} onClick={() => setForced(v)}>{label}</button>
              ))}
            </div>
          )}
          <p className="muted meta-src" data-fallback={source === 'home' && choice.source === 'home' ? '' : undefined}>
            {source === 'pm' && pm ? <>PocketMads · {dateTimeFr(pm.fetchedAt)}</> : meta ? <>Calcul Holothèque · {dateTimeFr(meta.generatedAt)}</> : null}
          </p>
          {staleHours !== null && (
            <p className="card meta-msg"><Icon name="alert" /> Les listes et matchups Limitless ont {staleHours} h : la mise à jour automatique semble en panne.</p>
          )}
          {builds.size > 0 && (
            <div className="chips meta-filter" role="group" aria-label="Decks jouables avec ta collection">
              {([['all', 'Tous'], ['ready', `Je peux le monter · ${nbReady}`], ['near', `Manque ≤ ${MAX_NEAR} · ${nbNear}`]] as [BuildFilter, string][]).map(([v, label]) => (
                <button key={v} className={'chip' + (filter === v ? ' on' : '')} aria-pressed={filter === v} onClick={() => setFilter(v)}>{label}</button>
              ))}
            </div>
          )}
          {filter !== 'all' && !visible.some((g) => g.rows.length) && <p className="muted card meta-msg">Aucun deck ne correspond pour le moment.</p>}
          {visible.filter((g) => filter === 'all' || g.rows.length).map((g) => (
            <section key={g.label} className={'meta-tier card' + (g.rows.length ? '' : ' is-empty')} data-content-start="">
              <h2><span className={'tier-badge t-' + (g.key ?? '3')}>{g.key ? TIER_LABEL[g.key] : g.label}</span> <small className="muted">{g.key ? TIER_SUB[g.key] : ''}</small></h2>
              
              <ul className="meta-list">
                {g.rows.map((x) => <DeckRow key={x.pm.id ?? x.pm.name} pm={x.pm} deck={x.deck} build={buildOf(x.deck)} cardById={cardById} onOpen={() => setOpen({ deck: x.deck, pm: x.pm, tier: g.key, source: source ?? 'pm' })} />)}
              </ul>
            </section>
          ))}
        </>
      )}
      {open && (
        <MetaDetail
          key={(open.deck?.name ?? '') + (open.pm?.name ?? '')}
          open={open}
          decks={decks}
          onOpen={(d) => setOpen({ deck: d, ...tierOfDeck(d), source: source ?? 'pm' })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
