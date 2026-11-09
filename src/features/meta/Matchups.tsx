import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { cardImageUrl } from '../../lib/db'
import type { Card } from '../../lib/types'
import type { Matchup, MetaDeck } from '../../lib/meta/compute'

/** Below this many decided matches a matchup is shown faded ("peu de matchs"). */
const MATCHUP_MIN_GAMES = 10
const EDGE = 0.05 // ±5 points around 50 % = even
const SHOWN = 10 // rows before "Voir les 20"

type MatchupLean = 'fav' | 'even' | 'unfav' | 'few'
function lean(m: Matchup): MatchupLean {
  if (m.games < MATCHUP_MIN_GAMES) return 'few'
  const r = m.wins / m.games
  return r >= 0.5 + EDGE ? 'fav' : r <= 0.5 - EDGE ? 'unfav' : 'even'
}

/** Win rates of a deck against the most played archetypes: one compact row per opponent with a bar centred on 50 %. */
export function Matchups({ matchups, deckByName, cardById, onOpen }: {
  matchups: Matchup[]
  deckByName: Map<string, MetaDeck>
  cardById: Map<string, Card>
  onOpen?: (d: MetaDeck) => void
}) {
  const [all, setAll] = useState(false)
  if (!matchups.length) return null
  const count = { fav: 0, even: 0, unfav: 0, few: 0 }
  for (const m of matchups) count[lean(m)]++
  const rows = all ? matchups : matchups.slice(0, SHOWN)
  return (
    <div className="mu">
      <p className="mu-sum">
        <span className="mu-pill fav">Favorable · {count.fav}</span>
        <span className="mu-pill even">Équilibré · {count.even}</span>
        <span className="mu-pill unfav">Défavorable · {count.unfav}</span>
      </p>
      <ul className="mu-list">
        {rows.map((m) => {
          const d = deckByName.get(m.op)
          const card = d?.iconCardIds[0] ? cardById.get(d.iconCardIds[0]) : undefined
          const r = m.games ? m.wins / m.games : 0.5
          const l = lean(m)
          // Bar: 50 % in the middle, 20 % / 80 % at the edges.
          const off = Math.max(-1, Math.min(1, (r - 0.5) / 0.3)) * 50
          const body = (
            <>
              <span className="mu-ico" style={card ? { backgroundImage: `url("${cardImageUrl(card)}")` } : undefined} aria-hidden="true" />
              <span className="mu-name"><b>{d?.nameFr ?? m.op}</b><small>{m.games ? `${m.wins} V · ${m.games - m.wins} D` : 'aucun match'}</small></span>
              <span className="mu-bar" aria-hidden="true">
                {m.games > 0 && <i style={off >= 0 ? { left: '50%', width: `${off}%` } : { right: '50%', width: `${-off}%` }} />}
              </span>
              <span className="mu-pct">{m.games ? `${Math.round(r * 100)} %` : '–'}</span>
            </>
          )
          return (
            <li key={m.op} className={'mu-row ' + l} title={l === 'few' ? 'Peu de matchs : à prendre avec prudence' : undefined}>
              {d && onOpen ? <button onClick={() => onOpen(d)} aria-label={`${d.nameFr} : ${m.games ? Math.round(r * 100) + ' % de victoires sur ' + m.games + ' matchs' : 'aucun match'}`}>{body}</button> : <div>{body}</div>}
            </li>
          )
        })}
      </ul>
      {matchups.length > SHOWN && (
        <button className="btn mu-more" onClick={() => setAll(!all)}>
          <Icon name={all ? 'up' : 'down'} /> {all ? 'Réduire' : `Voir les ${matchups.length} adversaires`}
        </button>
      )}
      <p className="muted mu-note">Taux de victoire face aux archétypes les plus joués de la période (hors miroir, égalités et byes). Grisé : moins de {MATCHUP_MIN_GAMES} matchs.</p>
    </div>
  )
}
