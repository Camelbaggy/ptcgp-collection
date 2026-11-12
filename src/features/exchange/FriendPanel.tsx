import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { CardTile } from '../../components/CardTile'
import { EmptyState } from '../../components/PageHeader'
import { QrSvg, useQrPath } from '../../components/Qr'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, useCards, useOwned, usePersisted } from '../../lib/useData'
import { REMOTE_BASE } from '../../lib/native/platform'
import { profilePrefName } from '../../lib/profiles'
import { TRADE_RULES } from '../../lib/calc/rules'
import {
  decodeFriendCode, encodeFriendCode, extractFriendCode, matchFriend, myFriendCode, type FriendCode, type RarityMatch,
} from '../../lib/calc/friendTrades'
import { loadFriends, rememberFriend, forgetFriend, type SavedFriend } from './friendStore'
import type { Card } from '../../lib/types'
import './friends.css'

const today = () => new Date().toISOString().slice(0, 10)
const frDate = (d: string) => d.split('-').reverse().join('/')
export const friendLink = (code: string) => `${REMOTE_BASE}#/echange-partage?onglet=ami&code=${code}`

/** Mon code d'échange : QR du lien, partage, copie. */
function MyCode() {
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [name, setName] = usePersisted(profilePrefName('friend.myName'), '')
  const mine = useMemo(() => myFriendCode(cards, owned, name.trim(), today()), [cards, owned, name])
  const [code, setCode] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  useEffect(() => {
    let live = true
    if (!cards.length) return
    void encodeFriendCode(mine).then((c) => { if (live) setCode(c) })
    return () => { live = false }
  }, [mine, cards.length])
  const link = code ? friendLink(code) : null
  const qr = useQrPath(link, 'L')

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copié`) } catch { toast('Copie impossible') }
  }
  const share = async () => {
    if (!link) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Mon code d’échange Holothèque', text: 'Compare nos cartes pour échanger :', url: link }); return } catch { return }
    }
    await copy(link, 'Lien')
  }

  return (
    <section className="card friend-card">
      <h2>Mon code d’échange</h2>
      <input className="input" aria-label="Ton pseudo" placeholder="Ton pseudo (montré à ton ami)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="friend-code">
        <button className="friend-qr" onClick={() => setBig(true)} aria-label="Agrandir le QR code" disabled={!qr}>
          {qr ? <QrSvg path={qr.path} size={qr.size} label="QR code de ton code d’échange" /> : <span className="muted">…</span>}
        </button>
        <p className="muted">
          <b>{mine.offers.length}</b> cartes à proposer<br />
          <b>{mine.missing.length}</b> cartes recherchées<br />
          Raretés {TRADE_RULES.tradableRarities.map((r) => RARITY_LABEL[r]).join(' ')}
        </p>
      </div>
      <div className="row wrap">
        <button className="btn primary" disabled={!link} onClick={() => void share()}><Icon name="ext" />Partager le lien</button>
        <button className="btn" disabled={!code} onClick={() => void copy(code!, 'Code')}><Icon name="download" />Copier le code</button>
      </div>
      <p className="muted small">Ton ami ouvre le lien ou scanne le QR avec son téléphone : son Holothèque compare vos collections, sans serveur. Le code est une photo de ta collection à la date du jour.</p>
      {big && qr && (
        <div className="friend-qr-full" role="dialog" aria-modal="true" aria-label="QR code de ton code d’échange" onClick={() => setBig(false)}>
          <QrSvg path={qr.path} size={qr.size} label="QR code de ton code d’échange" />
          <span>Touche pour fermer</span>
        </div>
      )}
    </section>
  )
}

const PREVIEW = 12

function PickColumn({ title, cards, sel, onSel, empty }: { title: string; cards: Card[]; sel: string | null; onSel: (id: string | null) => void; empty: string }) {
  const owned = useOwned()
  const [all, setAll] = useState(false)
  const shown = all ? cards : cards.slice(0, PREVIEW)
  return (
    <div>
      <p className="muted small">{title} ({cards.length})</p>
      {cards.length ? (
        <div className="grid friend-grid">
          {shown.map((c) => (
            <div key={c.id} className={'friend-pick' + (sel === c.id ? ' on' : '')}>
              <CardTile card={c} count={owned.get(c.id) ?? 0} showName onClick={() => onSel(sel === c.id ? null : c.id)} />
            </div>
          ))}
        </div>
      ) : <p className="muted small">{empty}</p>}
      {cards.length > PREVIEW && <button className="btn friend-more" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Tout voir (${cards.length})`}</button>}
    </div>
  )
}

function RarityBlock({ m, onPrepare }: { m: RarityMatch; onPrepare: (give: Card, receive: Card) => void }) {
  const [recv, setRecv] = useState<string | null>(null)
  const [give, setGive] = useState<string | null>(null)
  const r = m.receive.find((c) => c.id === recv)
  const g = m.give.find((c) => c.id === give)
  const label = m.count > 0 ? `${m.count} échange${m.count > 1 ? 's' : ''}` : 'aucun échange'
  const cost = TRADE_RULES.tokenCost[m.rarity]
  return (
    <div className="friend-rarity">
      <h3><span className="rar-pill">{RARITY_LABEL[m.rarity]}</span>{label}{cost ? <span className="muted small"> · {cost} jetons par échange</span> : null}</h3>
      <div className="friend-cols">
        <PickColumn title="Tu reçois" cards={m.receive} sel={recv} onSel={setRecv} empty="Ton ami n’a pas de double qui te manque." />
        <PickColumn title="Tu donnes" cards={m.give} sel={give} onSel={setGive} empty="Aucun de tes doubles ne lui manque." />
      </div>
      {m.count > 0 && (
        <button className="btn primary" disabled={!r || !g} onClick={() => r && g && onPrepare(g, r)}>
          <Icon name="swap" />{r && g ? `Préparer : ${g.name} contre ${r.name}` : 'Choisis une carte de chaque côté'}
        </button>
      )}
    </div>
  )
}

function Results({ friend, onPrepare }: { friend: FriendCode; onPrepare: (give: Card, receive: Card) => void }) {
  const cards = useCards()
  const owned = useOwned()
  const matches = useMemo(() => matchFriend(cards, owned, friend), [cards, owned, friend])
  const total = matches.reduce((n, m) => n + m.count, 0)
  const who = friend.name || 'ton ami'
  const useful = matches.filter((m) => m.count > 0)
  const oneSided = matches.filter((m) => m.count === 0 && (m.receive.length || m.give.length))
  return (
    <section className="card friend-card">
      <h2>Avec {who} : {total} échange{total > 1 ? 's' : ''} possible{total > 1 ? 's' : ''}</h2>
      <p className="muted small">Code du {frDate(friend.date)}. Même rareté seulement ; tes doubles suivent tes règles (2 exemplaires gardés pour les ◊, 1 pour les brillantes et les ☆), une rareté que tu as complétée n’est plus proposée.</p>
      {useful.length ? (
        <>
          <div className="chips" aria-label="Échanges par rareté">
            {useful.map((m) => <a key={m.rarity} className="chip" href={`#friend-${m.rarity}`} onClick={(e) => { e.preventDefault(); document.getElementById(`friend-${m.rarity}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{RARITY_LABEL[m.rarity]} {m.count}</a>)}
          </div>
          {useful.map((m) => <div key={m.rarity} id={`friend-${m.rarity}`}><RarityBlock m={m} onPrepare={onPrepare} /></div>)}
        </>
      ) : <EmptyState icon="swap" title="Aucun échange possible" text="Il faut, dans une même rareté, un double de ton ami qui te manque et un de tes doubles qui lui manque." />}
      {oneSided.length > 0 && (
        <details className="friend-onesided">
          <summary>Sans contrepartie : {oneSided.map((m) => `${RARITY_LABEL[m.rarity]} ${m.receive.length ? `${m.receive.length} à recevoir` : `${m.give.length} à donner`}`).join(' · ')}</summary>
          <p className="muted small">Dans ces raretés, un seul de vous deux a quelque chose à proposer : utile pour un partage ou un échange plus tard.</p>
          {oneSided.map((m) => <RarityBlock key={m.rarity} m={m} onPrepare={onPrepare} />)}
        </details>
      )}
    </section>
  )
}

/** Onglet « Avec un ami » : mon code, le code d'un ami, les échanges possibles. */
export function FriendPanel({ initialCode, onCodeUsed, onPrepare }: {
  initialCode: string | null
  onCodeUsed: () => void
  onPrepare: (give: Card, receive: Card, friendName: string) => void
}) {
  const toast = useToast()
  const [input, setInput] = useState('')
  const [friend, setFriend] = useState<FriendCode | null>(null)
  const [saved, setSaved] = useState<SavedFriend[]>(loadFriends)
  const [busy, setBusy] = useState(false)

  const open = async (raw: string, quiet = false) => {
    setBusy(true)
    try {
      const f = await decodeFriendCode(raw)
      setFriend(f)
      setSaved(rememberFriend({ name: f.name, date: f.date, code: extractFriendCode(raw) }))
      setInput('')
    } catch (e) {
      if (!quiet) toast((e as Error).message); else toast(`Code d’ami : ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!initialCode) return
    onCodeUsed()
    void open(initialCode, true)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- ne lire le code du lien qu'une fois
  }, [initialCode])

  const prepare = (g: Card, r: Card) => onPrepare(g, r, friend?.name ?? '')

  return (
    <div className={'friend-layout' + (friend ? ' has-result' : '')}>
      <div>
        <MyCode />
        <section className="card friend-card">
          <h2>Code d’un ami</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) void open(input) }}>
            <input className="input" aria-label="Code ou lien d’un ami" placeholder="Colle le code ou le lien de ton ami" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!input.trim() || busy}><Icon name="search" />Comparer</button>
          </form>
          {saved.length > 0 && (
            <ul className="friend-saved">
              {saved.map((s) => (
                <li key={s.code}>
                  <span className="grow"><b>{s.name || 'Sans pseudo'}</b><br /><span className="muted small">code du {frDate(s.date)}</span></span>
                  <button className="btn" onClick={() => void open(s.code)}>Revoir</button>
                  <button className="btn icon" aria-label={`Oublier ${s.name || 'ce code'}`} onClick={() => { setSaved(forgetFriend(s.code)); if (friend && s.name === friend.name && s.date === friend.date) setFriend(null) }}><Icon name="trash" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div>
        {friend ? <Results friend={friend} onPrepare={prepare} />
          : <section className="card friend-card"><EmptyState icon="swap" title="Compare avec un ami" text="Envoie ton code à un ami et colle le sien ici : tu verras les cartes que vous pouvez vous échanger, rareté par rareté." /></section>}
      </div>
    </div>
  )
}
