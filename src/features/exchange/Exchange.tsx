import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { useCardById, usePersisted } from '../../lib/useData'
import { TradePanel } from './TradePanel'
import { SharePanel } from './SharePanel'
import { FriendPanel } from './FriendPanel'

type Tab = 'echange' | 'partage' | 'ami'

const SUB: Record<Tab, string> = {
  echange: 'Troque une carte en double contre une autre',
  partage: "Donne ou reçois une carte d'un ami",
  ami: 'Compare tes doubles avec ceux d’un ami',
}

export default function Exchange() {
  const [params, setParams] = useSearchParams()
  const o = params.get('onglet')
  const tab: Tab = o === 'partage' || o === 'ami' ? o : 'echange'
  const [friend, setFriend] = usePersisted('friend', '')
  const cardById = useCardById()
  const edit = (f: (n: URLSearchParams) => void) => setParams((p) => { const n = new URLSearchParams(p); f(n); return n }, { replace: true })
  const go = (t: Tab) => edit((n) => { n.set('onglet', t); n.delete('donne'); n.delete('recoit') })
  const given = cardById.get(params.get('donne') ?? '') ?? null
  const received = cardById.get(params.get('recoit') ?? '') ?? null

  return (
    <div className="page" data-section={tab === 'partage' ? 'pink' : 'orange'}>
      <PageHeader icon={tab === 'partage' ? 'gift' : 'swap'} title="Échange et partage" sub={SUB[tab]} />
      <div className="seg" role="tablist" aria-label="Échange, partage ou ami">
        <button role="tab" aria-selected={tab === 'echange'} className={tab === 'echange' ? 'on' : ''} onClick={() => go('echange')}><Icon name="swap" />Échange</button>
        <button role="tab" aria-selected={tab === 'partage'} className={tab === 'partage' ? 'on' : ''} onClick={() => go('partage')}><Icon name="gift" />Partage</button>
        <button role="tab" aria-selected={tab === 'ami'} className={tab === 'ami' ? 'on' : ''} onClick={() => go('ami')}><Icon name="user" />Avec un ami</button>
      </div>
      {tab !== 'ami' && <input className="input" aria-label="Ami" placeholder="Ami (facultatif)" value={friend} onChange={(e) => setFriend(e.target.value)} />}
      {tab === 'echange' && <TradePanel key={`${given?.id ?? ''}|${received?.id ?? ''}`} friend={friend} initialGiven={given} initialReceived={received} />}
      {tab === 'partage' && <SharePanel friend={friend} />}
      {tab === 'ami' && (
        <FriendPanel initialCode={params.get('code')} initialFileId={params.get('f')} onCodeUsed={() => edit((n) => { n.delete('code'); n.delete('f') })}
          onPrepare={(g, r, name) => {
            if (name) setFriend(name)
            edit((n) => { n.set('onglet', 'echange'); n.set('donne', g.id); n.set('recoit', r.id) })
            window.scrollTo({ top: 0 })
          }} />
      )}
    </div>
  )
}
