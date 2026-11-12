import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { useCardById } from '../../lib/useData'
import type { MetaDeck } from '../../lib/meta/compute'
import { matchPmDeck } from '../../lib/pocketMads/match'
import { parsePmRaw } from '../../lib/pocketMads/parse'
import { decodePmPayload, savePmTierList, usePmTierList } from '../../lib/pocketMads/store'
import type { PmDeck, PmRaw, PmTierList } from '../../lib/pocketMads/types'
import { DeckRow } from './DeckRow'
import MetaDetail from './MetaDetail'
import { PmSync } from './PmSync'
import { TIER_LABEL, TIER_SUB, dateTimeFr, metaStaleHours, useMeta } from './useMeta'
import './meta.css'

export interface OpenDeck { deck: MetaDeck | null; pm: PmDeck | null; tier: string | null }

export default function Meta() {
  const { meta } = useMeta()
  const [loadedAt] = useState(() => Date.now())
  const staleHours = meta ? metaStaleHours(meta.generatedAt, loadedAt) : null
  const pm = usePmTierList()
  const cardById = useCardById()
  const [open, setOpen] = useState<OpenDeck | null>(null)
  const [params, setParams] = useSearchParams()
  const [msg, setMsg] = useState('')

  // données envoyées par le favori, lancé sur la tier list PocketMads : on demande confirmation avant d'écraser
  const payload = params.get('pm')
  const [pending, setPending] = useState<PmTierList | null>(null)
  useEffect(() => {
    if (!payload) return
    try {
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
  // tous les tiers, même vides (Tier 0 l'est le plus souvent)
  const groups = useMemo(() => (pm?.tiers ?? [])
    .filter((t) => t.decks.length || t.key !== null)
    .map((t) => ({ ...t, rows: t.decks.map((d) => ({ pm: d, deck: matchPmDeck(d, decks) })) })), [pm, decks])
  const tierOfDeck = (d: MetaDeck): { pm: PmDeck | null; tier: string | null } => {
    for (const t of pm?.tiers ?? []) for (const x of t.decks) if (matchPmDeck(x, [d])) return { pm: x, tier: t.key }
    return { pm: null, tier: null }
  }

  return (
    <div className="page meta" data-section="red">
      <PageHeader icon="trophy" title="Méta" sub="Tier list PocketMads, listes et matchups Limitless" />
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
      <PmSync has={!!pm} />
      {pm === null && <EmptyState icon="trophy" title="Pas encore de tier list" text="Lis la tier list PocketMads avec le bouton ci-dessus." />}
      {pm && (
        <>
          <p className="muted meta-src card">
            Tier list PocketMads{pm.range ? ` (${pm.range.replace(/d$/, ' jours')})` : ''}{pm.updated ? ` · calculée le ${pm.updated}` : ''} · lue le {dateTimeFr(pm.fetchedAt)}.
            {' '}Listes types et matchups : Limitless{meta ? `, ${dateTimeFr(meta.generatedAt)}` : ''}.
          </p>
          {staleHours !== null && (
            <p className="card meta-msg"><Icon name="alert" /> Les listes et matchups Limitless ont {staleHours} h : la mise à jour automatique semble en panne.</p>
          )}
          {groups.map((g) => (
            <section key={g.label} className="meta-tier card">
              <h2><span className={'tier-badge t-' + (g.key ?? '3')}>{g.key ? TIER_LABEL[g.key] : g.label}</span> <small className="muted">{g.key ? TIER_SUB[g.key] : ''}</small></h2>
              {!g.rows.length && <p className="muted meta-empty">Aucun deck pour le moment.</p>}
              <ul className="meta-list">
                {g.rows.map((x) => <DeckRow key={x.pm.id ?? x.pm.name} pm={x.pm} deck={x.deck} cardById={cardById} onOpen={() => setOpen({ deck: x.deck, pm: x.pm, tier: g.key })} />)}
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
          onOpen={(d) => setOpen({ deck: d, ...tierOfDeck(d) })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
