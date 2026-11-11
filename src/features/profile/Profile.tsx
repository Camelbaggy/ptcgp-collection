import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { SetLogo } from '../../components/Brand'
import { itemLabelFr } from '../../lib/events/translate'
import { computeBaseline, pzSetToSetId } from '../../lib/pzProfile/baseline'
import { counterLabelFr } from '../../lib/stats/lifetime'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import type { PzCounter, PzItem } from '../../lib/pzProfile/types'
import { RARITY_LABEL, useBoosters, useHistory, useSets } from '../../lib/useData'
import { setIdOf } from '../../lib/setId'
import { ItemIcon } from '../events/ItemIcon'
import './profile.css'

const nf = new Intl.NumberFormat('fr-FR')
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtDayTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Libellés français des objets (le pluriel convient à une liste de quantités). */
function itemLabel(id: string): string {
  if (/^SHOPTICKET/i.test(id)) return 'Tickets de boutique'
  if (/^SHINEDUST/i.test(id)) return 'Poussière scintillante'
  if (/^POKEGOLD/i.test(id)) return 'Poké Lingots'
  if (/^PACK_CHARGER/i.test(id)) return 'Sabliers de booster'
  if (/^EVENT_CHARGER|^EVENT_HOURGLASS/i.test(id)) return 'Sabliers d’évènement'
  if (/^CHALLENGE_CHARGER/i.test(id)) return 'Sabliers de pioche miracle'
  if (/^TRADE_CHA/i.test(id)) return 'Sabliers d’échange'
  if (/^REVIVAL_CLOCK|^REWIND/i.test(id)) return 'Sabliers de résurrection'
  if (/^EVENT_SHOPTICKET/i.test(id)) return 'Tickets d’évènement'
  if (/^PREMIUM_TICKET/i.test(id)) return 'Tickets premium'
  if (/^TRADE_TOKEN|^TRADETICKET/i.test(id)) return 'Jetons d’échange'
  const l = itemLabelFr(id)
  return l === 'Objet' ? id.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase() : l
}

const amount = (i: { amount: number; approx?: boolean }) => (i.approx ? '≈ ' : '') + (i.amount >= 10000 && i.approx ? nf.format(Math.round(i.amount / 1000)) + ' k' : nf.format(i.amount))
const counterValue = (c: PzCounter) => (c.approx && c.value >= 10000 ? `≈ ${nf.format(Math.round(c.value / 1000))} k` : (c.approx ? '≈ ' : '') + nf.format(c.value))
const rankText = (c: PzCounter) => (c.rank ? `#${nf.format(c.rank.rank)} sur ${nf.format(c.rank.of)} · top ${nf.format(c.rank.topPct)} %` : null)

function Items({ title, items, icon }: { title: string; items: PzItem[]; icon: 'coin' | 'clock' | 'cart' }) {
  const [all, setAll] = useState(false)
  const nz = items.filter((i) => i.amount > 0)
  const zeros = items.filter((i) => i.amount <= 0)
  if (!items.length) return null
  const shown = all ? items : nz
  return (
    <section className="card pf-card">
      <h2 className="pf-h"><Icon name={icon === 'coin' ? 'sparkle' : icon} />{title}</h2>
      {shown.length === 0 && <p className="pf-muted">Aucun pour le moment.</p>}
      <ul className="pf-items">
        {shown.map((i) => (
          <li key={i.id}>
            <ItemIcon file={i.id} label={itemLabel(i.id)} size={34} />
            <span className="pf-il">{itemLabel(i.id)}</span>
            <b>{amount(i)}</b>
          </li>
        ))}
      </ul>
      {zeros.length > 0 && <button type="button" className="pf-link" onClick={() => setAll(!all)}>{all ? 'Masquer les vides' : `Voir tout (${zeros.length} à zéro)`}</button>}
    </section>
  )
}

function CounterList({ list }: { list: PzCounter[] }) {
  return (
    <ul className="pf-counters">
      {list.map((c) => (
        <li key={c.key}>
          <span className="pf-cl">{counterLabelFr(c)}</span>
          <b>{counterValue(c)}</b>
          {(c.detail || rankText(c)) && <small>{[c.detail, rankText(c)].filter(Boolean).join(' · ')}</small>}
        </li>
      ))}
    </ul>
  )
}

export default function Profile() {
  const home = usePzSnapshot('home')
  const stats = usePzSnapshot('stats')
  const history = useHistory(1_000_000)
  const boosters = useBoosters()
  const sets = useSets()
  const [copied, setCopied] = useState(false)

  const fetchedAt = (home ?? stats)?.fetchedAt
  const base = useMemo(() => {
    if (!fetchedAt) return null
    const bs = new Map(boosters.map((b) => [b.id, b.setId]))
    return computeBaseline({
      fetchedAt, home: home?.data, stats: stats?.data, history,
      boosterSet: (id) => bs.get(id) ?? setIdOf(id), setIds: sets.map((s) => s.id),
    })
  }, [fetchedAt, home, stats, history, boosters, sets])

  if (home === undefined || stats === undefined) return <main className="page" data-section="blue"><PageHeader icon="user" title="Profil" /></main>

  if (!home && !stats) {
    return (
      <main className="page" data-section="blue">
        <PageHeader icon="user" title="Profil" sub="Ton profil Pokémon-Zone dans Holothèque." />
        <section className="card pf-card">
          <p>Aucun profil importé. Enregistre tes pages Pokémon-Zone (accueil du profil, statistiques) puis importe-les : tes monnaies, sabliers, trophées et compteurs apparaîtront ici, et l’appli continuera à compter tes packs ensuite.</p>
          <Link to="/guide-pokemon-zone" className="btn primary">Voir le guide</Link>
        </section>
      </main>
    )
  }

  const h = home?.data
  const s = stats?.data
  const copy = async () => {
    if (!h?.friendId) return
    try { await navigator.clipboard.writeText(h.friendId); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const setIds = sets.map((x) => x.id)
  const trophiesOn = h?.trophies.filter((t) => !t.locked).length ?? 0
  const points = (base?.packPoints ?? []).filter((p) => p.points > 0 || p.added > 0)

  return (
    <main className="page pf" data-section="blue">
      <PageHeader icon="user" title={h?.name || 'Profil'} sub={h?.level != null ? `Niveau ${h.level}` : 'Profil Pokémon-Zone'}>
        <Link to="/guide-pokemon-zone" className="btn pf-refresh"><Icon name="sync" />Actualiser</Link>
      </PageHeader>

      <section className="card pf-card pf-id">
        {h?.friendId && (
          <div className="pf-row">
            <span className="pf-muted">ID d’ami</span>
            <code>{h.friendId}</code>
            <button type="button" className="btn" onClick={copy} aria-label="Copier l’ID d’ami"><Icon name={copied ? 'check' : 'ext'} />{copied ? 'Copié' : 'Copier'}</button>
          </div>
        )}
        {h?.syncedAt && <p className="pf-muted">Synchronisé sur Pokémon-Zone le {fmtDay(h.syncedAt)}</p>}
        {fetchedAt && <p className="pf-muted">Importé le {fmtDayTime(fetchedAt)}</p>}
        <p className="pf-note">Monnaies, sabliers et tickets sont une photo « au moment de l’import » : seuls les packs et les points de booster continuent à s’actualiser dans l’appli.</p>
      </section>

      {base && (base.packsOpened != null || base.cardsObtained != null) && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="pack" />Depuis le début</h2>
          <div className="pf-tiles">
            {base.packsOpened != null && <div><b>{nf.format(base.packsOpened)}</b><span>packs ouverts</span></div>}
            {base.cardsObtained != null && <div><b>{nf.format(base.cardsObtained)}</b><span>cartes obtenues</span></div>}
          </div>
          {base.addedPacks > 0 && <p className="pf-muted">dont +{nf.format(base.addedPacks)} packs saisis dans l’appli depuis l’import.</p>}
        </section>
      )}

      {h && (
        <div className="pf-grid">
          <Items title="Monnaies" items={h.currencies} icon="coin" />
          <Items title="Sabliers" items={h.hourglasses} icon="clock" />
          <Items title="Tickets" items={h.tickets} icon="cart" />
        </div>
      )}

      {points.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="layers" />Points de booster</h2>
          <ul className="pf-points">
            {points.map((p) => {
              const sid = pzSetToSetId(p.setCode, setIds)
              return (
                <li key={p.setCode}>
                  {sid ? <SetLogo setId={sid} small fallback={<span className="pf-code">{p.setCode}</span>} /> : <span className="pf-code">{p.setCode}</span>}
                  <b>{nf.format(p.points)}</b>
                  {p.added > 0 && <small>+{nf.format(p.added * 5)} depuis l’import</small>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {h && h.trophies.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="trophy" />Trophées <small>{trophiesOn} / {h.trophies.length}</small></h2>
          <ul className="pf-trophies">
            {h.trophies.map((t) => <li key={t.id} className={t.locked ? 'locked' : ''}><Icon name={t.locked ? 'close' : 'medal'} />{t.label}</li>)}
          </ul>
        </section>
      )}

      {h && h.rarityProgress.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="star" />Progression par rareté</h2>
          <ul className="pf-bars">
            {h.rarityProgress.map((r) => (
              <li key={r.code}>
                <span className="pf-bl">{r.rarity ? RARITY_LABEL[r.rarity] : r.code}</span>
                <span className="pf-bar"><i style={{ width: `${r.total ? Math.min(100, (r.owned / r.total) * 100) : 0}%` }} /></span>
                <small>{nf.format(r.owned)} / {nf.format(r.total)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s && s.counters.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="chart" />Compteurs{s.asOf ? <small>au {fmtDay(s.asOf)}</small> : null}</h2>
          <CounterList list={s.counters} />
        </section>
      )}
      {s && s.battles.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="bolt" />Combats</h2>
          <CounterList list={s.battles} />
        </section>
      )}
    </main>
  )
}
