import { useState } from 'react'
import { trade, undoLast } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { CardTile } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { useOwned, usePersisted } from '../../lib/useData'
import { canGive } from '../../lib/ops'
import type { Card } from '../../lib/types'

export default function Trade() {
  const owned = useOwned()
  const toast = useToast()
  const [friend, setFriend] = usePersisted('friend', '')
  const [given, setGiven] = useState<Card | null>(null)
  const [received, setReceived] = useState<Card | null>(null)
  const [tokens, setTokens] = useState('')
  const [picking, setPicking] = useState<'given' | 'received' | null>(null)
  const qty = given ? owned.get(given.id) ?? 0 : 0
  const ok = given && received && canGive(qty)

  const confirm = async () => {
    if (!given || !received) return
    try {
      await trade(given.id, received.id, friend.trim(), tokens ? Number(tokens) : undefined)
      toast(`Échangé : ${given.name} contre ${received.name}`, { label: 'Annuler', run: () => void undoLast() })
      setGiven(null); setReceived(null); setTokens('')
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="page">
      <h1>Échange</h1>
      <input className="input" placeholder="Ami (facultatif)" value={friend} onChange={(e) => setFriend(e.target.value)} />
      <div className="two">
        <section>
          <h3>Je donne</h3>
          {given && <CardTile card={given} count={qty} showName />}
          <button className="btn big" onClick={() => setPicking('given')}>{given ? 'Changer' : 'Choisir'}</button>
          {given && !canGive(qty) && <p className="warn">Il faut au moins 2 exemplaires.</p>}
        </section>
        <section>
          <h3>Je reçois</h3>
          {received && <CardTile card={received} count={owned.get(received.id) ?? 0} showName />}
          <button className="btn big" onClick={() => setPicking('received')}>{received ? 'Changer' : 'Choisir'}</button>
        </section>
      </div>
      <input className="input" inputMode="numeric" placeholder="Jetons d'échange (facultatif)" value={tokens} onChange={(e) => setTokens(e.target.value.replace(/\D/g, ''))} />
      <button className="btn primary big" disabled={!ok} onClick={confirm}>Confirmer l'échange</button>
      {picking === 'given' && (
        <CardPicker title="Carte donnée (≥ 2 ex.)" allow={(_c, q) => canGive(q)} hideDisallowed onClose={() => setPicking(null)}
          onPick={(c) => { setGiven(c); setPicking(null) }} />
      )}
      {picking === 'received' && (
        <CardPicker title="Carte reçue" onClose={() => setPicking(null)} onPick={(c) => { setReceived(c); setPicking(null) }} />
      )}
    </div>
  )
}
