import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { trade, onUndoError, undoLast } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { CardTile } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { useOwned } from '../../lib/useData'
import { canTradeCard } from '../../lib/ops'
import type { Card } from '../../lib/types'
import { RecentHistory } from '../history/RecentHistory'

export function TradePanel({ friend }: { friend: string }) {
  const owned = useOwned()
  const toast = useToast()
  const [given, setGiven] = useState<Card | null>(null)
  const [received, setReceived] = useState<Card | null>(null)
  const [tokens, setTokens] = useState('')
  const [picking, setPicking] = useState<'given' | 'received' | null>(null)
  const qty = given ? owned.get(given.id) ?? 0 : 0
  const ok = given && received && canTradeCard(given.rarity, qty)

  const confirm = async () => {
    if (!given || !received) return
    try {
      await trade(given.id, received.id, friend.trim(), tokens ? Number(tokens) : undefined)
      toast(`Échangé : ${given.name} contre ${received.name}`, { label: 'Annuler', run: () => void undoLast().catch(onUndoError(toast)) })
      setGiven(null); setReceived(null); setTokens('')
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <>
      <div className="two">
        <section className="card">
          <h3>Je donne</h3>
          {given && <CardTile card={given} count={qty} showName />}
          <button className="btn big" onClick={() => setPicking('given')}><Icon name="search" />{given ? 'Changer' : 'Choisir'}</button>
          {given && !canTradeCard(given.rarity, qty) && <p className="warn">Carte non échangeable ou moins de 2 exemplaires.</p>}
        </section>
        <section className="card">
          <h3>Je reçois</h3>
          {received && <CardTile card={received} count={owned.get(received.id) ?? 0} showName />}
          <button className="btn big" onClick={() => setPicking('received')}><Icon name="search" />{received ? 'Changer' : 'Choisir'}</button>
        </section>
      </div>
      <input className="input" aria-label="Jetons" inputMode="numeric" placeholder="Jetons d'échange (facultatif)" value={tokens} onChange={(e) => setTokens(e.target.value.replace(/\D/g, ''))} />
      <button className="btn primary big" disabled={!ok} onClick={confirm}><Icon name="swap" />Confirmer l'échange</button>
      <RecentHistory kind="trade" />
      {picking === 'given' && (
        <CardPicker title="Carte donnée (≥ 2 ex.)" allow={(c, q) => canTradeCard(c.rarity, q)} hideDisallowed onClose={() => setPicking(null)}
          onPick={(c) => { setGiven(c); setPicking(null) }} />
      )}
      {picking === 'received' && (
        <CardPicker title="Carte reçue" onClose={() => setPicking(null)} onPick={(c) => { setReceived(c); setPicking(null) }} />
      )}
    </>
  )
}
