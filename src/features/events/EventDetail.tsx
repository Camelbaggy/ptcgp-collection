import { useMemo } from 'react'
import { Sheet } from '../../components/Sheet'
import { useCards, useOwned, useSets } from '../../lib/useData'
import type { GameEvent } from '../../lib/events/parse'
import type { EventReward, ImportedEvent } from '../../lib/events/pokemonZone'
import { itemLabelFr, translateEventName, translateMission, translatePhrase, translateRules } from '../../lib/events/translate'
import { Featured, TypeBadge } from './EventViews'
import { ItemIcon } from './ItemIcon'
import { phase, rangeFr, timeLabel } from './format'

const nf = new Intl.NumberFormat('fr-FR')

export function rewardFr(r: EventReward): string {
  return `${r.amount > 1 ? nf.format(r.amount) + ' × ' : ''}${itemLabelFr(r.item)}${r.chance ? ` (${r.chance})` : ''}`
}

/** Récompense avec son icône (28 px) : « [icône] 3 × Sablier de booster ». */
function Reward({ r, eventName }: { r: EventReward; eventName?: string }) {
  const text = rewardFr(r)
  return <span className="ev-d-rw"><ItemIcon file={r.item} label={itemLabelFr(r.item)} ctx={{ eventName }} />{text}</span>
}
function Rewards({ list, eventName }: { list: EventReward[]; eventName?: string }) {
  return <>{list.map((r, i) => <Reward key={i} r={r} eventName={eventName} />)}</>
}
function Price({ price, cur }: { price?: number; cur?: string }) {
  return <span className="ev-d-rw">{price ?? '?'} ×{cur ? <ItemIcon file={cur} size={24} /> : null}{cur ? itemLabelFr(cur) : 'jeton'}</span>
}

/** Fiche détaillée d'un évènement (feuille modale) : cartes, missions, récompenses, boutique, combats. */
export default function EventDetail({ e, now, onClose }: { e: GameEvent; now: number; onClose: () => void }) {
  const d = e as GameEvent & Partial<ImportedEvent>
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const ctx = useMemo(() => ({ sets, cards }), [sets, cards])
  const label = e.type === 'expansion' ? e.name : translateEventName(e.name, ctx)
  const p = phase(e, now)

  const shopCards = (d.shopItems ?? []).filter((i) => i.kind === 'pokemon_card')
  const shopOther = (d.shopItems ?? []).filter((i) => i.kind !== 'pokemon_card')
  const cardGroups = useMemo(() => {
    const g = new Map<string, { n: number; price?: number; cur?: string }>()
    for (const i of shopCards) {
      const k = `${i.price ?? '?'}|${i.currency ?? ''}`
      g.set(k, { n: (g.get(k)?.n ?? 0) + 1, price: i.price, cur: i.currency })
    }
    return [...g.entries()]
  }, [shopCards])
  const missing = (e.cardIds ?? []).filter((id) => (owned.get(id) ?? 0) === 0).length
  const empty = !e.cardIds?.length && !d.battle && !d.missions?.length && !d.shopItems?.length && !d.offers?.length

  return (
    <Sheet title={label} onClose={onClose} full>
      <div className="ev-detail">
        <div className="ev-d-meta">
          <div><TypeBadge type={e.type} /></div>
          {label !== e.name && <small className="muted">Nom d’origine : <i>{e.name}</i></small>}
          <span>{rangeFr(e)}</span>
          <span className={'ev-time' + (p === 'live' ? ' live' : '')}>{timeLabel(e, now)}</span>
        </div>

        {e.cardIds?.length ? (
          <section>
            <h3>Cartes à collectionner{missing ? ` · ${missing} manquante${missing > 1 ? 's' : ''}` : ''}</h3>
            <Featured ids={e.cardIds} detail />
          </section>
        ) : null}

        {d.battle && (
          <section>
            <h3>Combats</h3>
            {d.battle.difficulty && <p>Difficulté : {d.battle.difficulty}</p>}
            {d.battle.rules && (
              <p>{translateRules(d.battle.rules, ctx)}{translateRules(d.battle.rules, ctx) !== d.battle.rules && <small className="muted"> ({d.battle.rules})</small>}</p>
            )}
            {d.battle.milestones?.length ? (
              <>
                <h4>Victoires cumulées</h4>
                <ul className="ev-d-list">{d.battle.milestones.map((m) => <li key={m.wins}><b>{m.wins} victoire{m.wins > 1 ? 's' : ''}</b> : <Reward r={m.reward} eventName={e.name} /></li>)}</ul>
              </>
            ) : null}
            {d.battle.perBattle?.length ? <p>Par combat : <Rewards list={d.battle.perBattle} eventName={e.name} /></p> : null}
            {d.battle.firstTime?.length ? <p>Première victoire : <Rewards list={d.battle.firstTime} eventName={e.name} /></p> : null}
          </section>
        )}

        {d.missions?.length ? (
          <section>
            <h3>Missions ({d.missions.length})</h3>
            <ul className="ev-d-list">
              {d.missions.map((m, i) => {
                const fr = translateMission(m.text, ctx)
                return (
                  <li key={i}>
                    <span title={fr !== m.text ? m.text : undefined}>{fr}</span>
                    {m.reward && <span className="ev-d-reward"> → <Reward r={m.reward} eventName={e.name} /></span>}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {shopCards.length || shopOther.length ? (
          <section>
            <h3>Boutique</h3>
            {cardGroups.map(([k, g]) => <p key={k}>{g.n} carte{g.n > 1 ? 's' : ''} · <Price price={g.price} cur={g.cur} /> chacune</p>)}
            {shopOther.length ? (
              <ul className="ev-d-list">
                {shopOther.map((i, k) => (
                  <li key={k} className="ev-d-row">
                    <ItemIcon file={i.icon} label={translatePhrase(i.name, ctx)} ctx={{ name: i.name }} />
                    <span className="ev-d-text">{translatePhrase(i.name, ctx)}<span className="ev-d-reward"> · <Price price={i.price} cur={i.currency} /></span></span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {d.offers?.length ? (
          <section>
            <h3>Offres ({d.offers.length})</h3>
            <ul className="ev-d-list">
              {d.offers.map((o, i) => {
                const base = o.items.filter((x) => !x.bonus), bonus = o.items.filter((x) => x.bonus)
                return (
                  <li key={i}>
                    <b>{translateEventName(o.name, ctx)}</b>{o.price && <> · {o.price}</>}
                    {o.items.length ? <div className="ev-d-rws">{base.length ? <Rewards list={base} /> : null}{bonus.length ? <>{base.length ? '+ ' : ''}bonus : <Rewards list={bonus} /></> : null}</div> : null}
                    <small className="muted">{rangeFr(o)}</small>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {empty && (
          <p className="muted">Pas de détail disponible pour cet évènement{d.source === 'pokemon-zone' ? ' (réimportez les pages Pokemon-Zone pour récupérer missions et récompenses)' : ''}.</p>
        )}
      </div>
    </Sheet>
  )
}
