import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { itemLabelFr } from '../../lib/events/translate'
import { counterLabelFr } from '../../lib/stats/lifetime'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import type { PzCounter, PzItem } from '../../lib/pzProfile/types'
import { RARITY_LABEL } from '../../lib/useData'
import { ItemIcon } from '../events/ItemIcon'
import './game-account.css'

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

/**
 * Stats › À vie, « Compte de jeu » : ce que l'instantané Pokémon-Zone apporte en plus des compteurs
 * (ID d'ami, monnaies, sabliers, tickets, trophées, progression par rareté, combats).
 * Les packs, cartes, points de booster et compteurs sont déjà dans les tuiles et sections de l'onglet.
 */
export function GameAccount() {
  const home = usePzSnapshot('home')
  const stats = usePzSnapshot('stats')
  const [copied, setCopied] = useState(false)
  const h = home?.data
  const s = stats?.data
  if (!h && !s?.battles.length) return null
  const copy = async () => {
    if (!h?.friendId) return
    try { await navigator.clipboard.writeText(h.friendId); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const trophiesOn = h?.trophies.filter((t) => !t.locked).length ?? 0
  const fetchedAt = home?.fetchedAt

  return (
    <div className="pf">
      {h && (
        <section className="card pf-card pf-id">
          <h2 className="pf-h"><Icon name="user" />Compte de jeu · {h.name || 'Pokémon-Zone'}{h.level != null && <small>Niveau {h.level}</small>}</h2>
          {h.friendId && (
            <div className="pf-idrow">
              <span className="pf-muted">ID d’ami</span>
              <code>{h.friendId}</code>
              <button type="button" className="btn" onClick={copy} aria-label="Copier l’ID d’ami"><Icon name={copied ? 'check' : 'ext'} />{copied ? 'Copié' : 'Copier'}</button>
            </div>
          )}
          {h.syncedAt && <p className="pf-muted">Synchronisé sur Pokémon-Zone le {fmtDay(h.syncedAt)}</p>}
          {fetchedAt && <p className="pf-muted">Importé le {fmtDayTime(fetchedAt)}</p>}
          <p className="pf-snote">Monnaies, sabliers et tickets sont une photo « au moment de l’import ».</p>
        </section>
      )}

      {h && (
        <div className="pf-grid">
          <Items title="Monnaies" items={h.currencies} icon="coin" />
          <Items title="Sabliers" items={h.hourglasses} icon="clock" />
          <Items title="Tickets" items={h.tickets} icon="cart" />
        </div>
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

      {s && s.battles.length > 0 && (
        <section className="card pf-card">
          <h2 className="pf-h"><Icon name="bolt" />Combats</h2>
          <CounterList list={s.battles} />
        </section>
      )}
    </div>
  )
}
