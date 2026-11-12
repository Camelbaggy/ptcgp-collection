import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { usePersisted } from '../../lib/useData'
import { TradePanel } from './TradePanel'
import { SharePanel } from './SharePanel'

type Tab = 'echange' | 'partage'

export default function Exchange() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('onglet') === 'partage' ? 'partage' : 'echange'
  const [friend, setFriend] = usePersisted('friend', '')
  const go = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set('onglet', t); return n }, { replace: true })
  const isTrade = tab === 'echange'

  return (
    <div className="page" data-section={isTrade ? 'orange' : 'pink'}>
      <PageHeader icon={isTrade ? 'swap' : 'gift'} title="Échange et partage"
        sub={isTrade ? 'Troque une carte en double contre une autre' : "Donne ou reçois une carte d'un ami"} />
      <div className="seg" role="tablist" aria-label="Échange ou partage">
        <button role="tab" aria-selected={isTrade} className={isTrade ? 'on' : ''} onClick={() => go('echange')}><Icon name="swap" />Échange</button>
        <button role="tab" aria-selected={!isTrade} className={!isTrade ? 'on' : ''} onClick={() => go('partage')}><Icon name="gift" />Partage</button>
      </div>
      <input className="input" aria-label="Ami" placeholder="Ami (facultatif)" value={friend} onChange={(e) => setFriend(e.target.value)} />
      {isTrade ? <TradePanel friend={friend} /> : <SharePanel friend={friend} />}
    </div>
  )
}
