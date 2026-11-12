import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, EmptyState } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { CardDetail } from '../../components/CardDetail'
import { useToast } from '../../components/Toast'
import { ItemIcon } from '../events/ItemIcon'
import '../events/events.css'
import { cardImageUrl, setWish } from '../../lib/db'
import { translatePhrase, translateThemedTitle } from '../../lib/events/translate'
import { describeReward } from '../../lib/events/rewardInfo'
import { useRewardCtx } from '../events/RewardItem'
import { resolvePzImage } from '../../lib/pzProfile/resolve'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import { computeLiveThemed, type LiveCollection, type LiveThemedCard } from '../../lib/pzProfile/themed'
import type { PzItem } from '../../lib/pzProfile/types'
import type { Card } from '../../lib/types'
import { useCards, useOwned, useSets, useWishlist } from '../../lib/useData'

type Filter = 'todo' | 'done' | 'all'
const nf = new Intl.NumberFormat('fr-FR')
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n > 1 ? many : one}`

function Reward({ r, cards }: { r: PzItem; cards: Card[] }) {
  const rctx = useRewardCtx()
  if (r.group === 'Card') {
    const c = resolvePzImage(r.id, cards)
    return (
      <span className="tc-rw" title={c?.name}>
        {c ? <img className="tc-rw-card" src={cardImageUrl(c)} alt={c.name} loading="lazy" /> : <Icon name="cards" />}
        <span>{c?.name ?? 'Carte'}</span>
      </span>
    )
  }
  return (
    <span className="tc-rw">
      <ItemIcon file={r.id} size={26} />
      <span>{r.amount > 1 ? `${nf.format(r.amount)} × ` : ''}{describeReward({ item: r.id }, rctx).label}</span>
    </span>
  )
}

function Thumb({ c, onOpen }: { c: LiveThemedCard; onOpen: (c: Card) => void }) {
  const inner = c.card ? <img src={cardImageUrl(c.card)} alt={c.name} loading="lazy" decoding="async" /> : <span className="tc-unk">{c.name}</span>
  return (
    <li className={'tc-card' + (c.owned ? '' : ' miss')}>
      <button className="tc-card-btn" disabled={!c.card} onClick={() => c.card && onOpen(c.card)} aria-label={`${c.name}${c.owned ? '' : ' (manquante)'}`}>
        {inner}
        {!c.owned && <span className="tc-miss">manquante</span>}
        {c.owned && !c.ownedAtImport && <span className="tc-new"><Icon name="check" /></span>}
      </button>
    </li>
  )
}

function Collection({ c, cards, title, onOpen, onWish }: { c: LiveCollection; cards: Card[]; title: string; onOpen: (c: Card) => void; onWish: (l: LiveThemedCard[]) => void }) {
  const done = c.status !== 'todo'
  const missing = c.cards.filter((x) => !x.owned)
  return (
    <li className={'card tc-col' + (done ? ' done' : '')}>
      <div className="tc-col-head">
        <b className="tc-title">{title}</b>
        {c.src.secret && <span className="tc-secret"><Icon name="sparkle" />Secrète</span>}
        {c.status === 'done' && <span className="tc-ok"><Icon name="check" />Terminée</span>}
        {c.status === 'doneSince' && <span className="tc-ok since"><Icon name="check" />Terminée depuis l’import</span>}
        {!done && <span className="tc-cnt">{c.cards.length - c.missingNow}/{c.cards.length}</span>}
      </div>
      {!done && (
        <ul className="tc-cards">{c.cards.map((x, i) => <Thumb key={x.key + i} c={x} onOpen={onOpen} />)}</ul>
      )}
      {c.src.rewards.length > 0 && (
        <div className="tc-rws">
          <small>Récompense</small>
          {c.src.rewards.map((r, i) => <Reward key={i} r={r} cards={cards} />)}
        </div>
      )}
      {!done && missing.some((m) => m.card) && (
        <button className="btn tc-wish" onClick={() => onWish(missing)}><Icon name="heart" />Souhaiter les manquantes</button>
      )}
    </li>
  )
}

export default function Themed() {
  const snap = usePzSnapshot('themed')
  const cards = useCards()
  const owned = useOwned()
  const sets = useSets()
  const wishlist = useWishlist()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('todo')
  const [open, setOpen] = useState<Card | null>(null)

  const tctx = useMemo(() => ({ sets, cards }), [sets, cards])
  const live = useMemo(() => (snap ? computeLiveThemed(snap.data, cards, owned) : null), [snap, cards, owned])

  if (snap === undefined) return <main className="page" data-section="teal"><PageHeader icon="medal" title="Collections à thème" /></main>
  if (!snap || !live) {
    return (
      <main className="page" data-section="teal">
        <PageHeader icon="medal" title="Collections à thème" />
        <EmptyState icon="medal" title="Aucune donnée importée"
          text="Importe ta page « Collections à thème » de Pokémon-Zone pour suivre ici les collections à terminer et les cartes qui manquent."
          action={<Link className="btn primary" to="/guide-pokemon-zone">Comment importer</Link>} />
      </main>
    )
  }

  const setIdOf = (code: string | null) => (code ? sets.find((s) => s.id.toLowerCase() === code.toLowerCase())?.id ?? code : '')
  const setName = (name: string, sid: string) => sets.find((x) => x.id === sid)?.name ?? translatePhrase(name, tctx)
  const wished = new Set(wishlist.map((w) => w.cardId))
  const wishable = live.cardsToFind.filter((c) => !wished.has(c.id))

  async function addWishes(cs: Card[]) {
    const fresh = [...new Map(cs.filter((c) => !wished.has(c.id)).map((c) => [c.id, c])).values()]
    for (const c of fresh) await setWish(c.id, 2)
    const already = new Set(cs.map((c) => c.id)).size - fresh.length
    toast(fresh.length ? `${plural(fresh.length, 'carte ajoutée', 'cartes ajoutées')} aux souhaits${already ? ` (${already} déjà présente${already > 1 ? 's' : ''})` : ''}` : 'Tout est déjà dans les souhaits')
  }

  const pct = live.total ? Math.round((live.completedNow / live.total) * 100) : 0
  const show = (c: LiveCollection) => filter === 'all' || (filter === 'todo') === (c.status === 'todo')
  const groups = live.sections
    .map((s) => ({ s, items: live.collections.filter((c) => c.src.setCode === s.setCode && show(c)).sort((a, b) => (a.status === 'todo' ? a.missingNow : 99) - (b.status === 'todo' ? b.missingNow : 99)) }))
    .filter((g) => g.items.length)
  const orphan = live.collections.filter((c) => !live.sections.some((s) => s.setCode === c.src.setCode) && show(c))
  if (orphan.length) groups.push({ s: { setCode: null, name: 'Autres', total: orphan.length, completedAtImport: 0, completedNow: orphan.filter((c) => c.status !== 'todo').length }, items: orphan })

  return (
    <main className="page tc" data-section="teal">
      <PageHeader icon="medal" title="Collections à thème" sub={`Données Pokémon-Zone du ${dateFr(snap.fetchedAt)}, complétées par ta collection`}>
        <Link className="btn" to="/guide-pokemon-zone"><Icon name="sync" />Actualiser</Link>
      </PageHeader>

      <section className="tc-hero">
        <div className="tc-hero-main">
          <b className="tc-big">{nf.format(live.completedNow)}<small> / {nf.format(live.total)}</small></b>
          <span>collections terminées ({pct} %)</span>
          {live.doneSince > 0 && <span className="tc-since">dont {live.doneSince} depuis l’import</span>}
        </div>
        <div className="bar" role="progressbar" aria-valuenow={live.completedNow} aria-valuemax={live.total} aria-label="Collections terminées"><i style={{ width: `${pct}%` }} /></div>
        <div className="tc-pills">
          <span className="tc-pill">{plural(live.incomplete, 'collection à terminer', 'collections à terminer')}</span>
          <span className="tc-pill">{plural(live.cardsToFindCount, 'carte à trouver', 'cartes à trouver')}</span>
        </div>
        {wishable.length > 0 && (
          <button className="btn primary" onClick={() => addWishes(live.cardsToFind)}><Icon name="heart" />Ajouter les cartes manquantes aux souhaits ({wishable.length})</button>
        )}
      </section>

      <div className="tc-filters" role="group" aria-label="Filtre">
        {([['todo', 'À terminer'], ['done', 'Terminées'], ['all', 'Toutes']] as const).map(([k, l]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {!groups.length && <EmptyState icon="check" title="Rien à afficher" text="Aucune collection ne correspond à ce filtre." />}
      {groups.map(({ s, items }) => {
        const sid = setIdOf(s.setCode)
        const p = s.total ? Math.round((s.completedNow / s.total) * 100) : 0
        return (
          <section key={s.setCode ?? 'x'} className="tc-set">
            <header className="tc-set-head">
              {sid ? <SetLogo setId={sid} name={setName(s.name, sid)} small /> : <b>{setName(s.name, sid)}</b>}
              <span className="tc-set-name">{setName(s.name, sid)}</span>
              <span className="tc-set-cnt">{s.completedNow}/{s.total}</span>
            </header>
            <div className="bar tc-set-bar"><i style={{ width: `${p}%` }} /></div>
            <ul className="tc-list">
              {items.map((c) => <Collection key={c.index} c={c} cards={cards} title={translateThemedTitle(c.src.title, tctx)} onOpen={setOpen} onWish={(l) => addWishes(l.flatMap((x) => (x.card ? [x.card] : [])))} />)}
            </ul>
          </section>
        )
      })}
      {open && <CardDetail card={open} qty={owned.get(open.id) ?? 0} onClose={() => setOpen(null)} />}
    </main>
  )
}
