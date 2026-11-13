import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import type { HelpBlock } from '../../components/HelpSheet'
import { Icon } from '../../components/Icon'
import { useCardById, usePersisted } from '../../lib/useData'
import { TradePanel } from './TradePanel'
import { SharePanel } from './SharePanel'
import { FriendPanel } from './FriendPanel'

type Tab = 'echange' | 'partage' | 'ami'

const HELP: Record<Tab, HelpBlock[]> = {
  echange: [{ text: 'Troque une carte en double contre une autre.' }],
  partage: [{ text: "Donne ou reçois une carte d'un ami." }],
  ami: [
    { title: 'Comparer avec un ami', text: 'Compare tes doubles avec ceux d’un ami.' },
    { title: 'Partager mon code', text: 'Ton ami ouvre le lien ou scanne le QR avec son téléphone : son Holothèque compare vos collections.' },
    { title: 'Mise à jour automatique', text: 'Sans elle, le lien est une photo de ta collection à la date du jour. Avec elle, ton code est publié dans un fichier de ton Google Drive, lisible avec le lien, et remis à jour à chaque changement : tes amis le relisent tout seuls et voient toujours tes doubles du moment.' },
    { title: 'Règles des échanges', text: 'Même rareté seulement ; tes doubles suivent tes règles (2 exemplaires gardés pour les ◊, 1 pour les brillantes et les ☆), une rareté que tu as complétée n’est plus proposée.' },
    { title: 'Sans contrepartie', text: 'Dans ces raretés, un seul de vous deux a quelque chose à proposer : utile pour un partage ou un échange plus tard.' },
  ],
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
      <PageHeader icon={tab === 'partage' ? 'gift' : 'swap'} title="Échange et partage" help={HELP[tab]} />
      <div className="seg" role="tablist" aria-label="Échange, partage ou ami" data-content-start="">
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
