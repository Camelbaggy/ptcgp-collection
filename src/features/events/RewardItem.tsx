import { useEffect, useMemo, useState } from 'react'
import { BoosterEmblem, BoosterPackImage, SetLogo } from '../../components/Brand'
import { BASE } from '../../lib/db'
import { describeReward, type RewardCtx, type RewardInput, type RewardView } from '../../lib/events/rewardInfo'
import { useBoosters, useCards, useOwned, useSets } from '../../lib/useData'
import { CardThumb } from './EventViews'
import { ItemIcon } from './ItemIcon'

// public/data/jp-names.json : noms japonais des fichiers du jeu -> noms français (nommage des cosmétiques).
let jpP: Promise<Record<string, string>> | undefined
function loadJp(): Promise<Record<string, string>> {
  jpP ??= fetch(`${BASE}data/jp-names.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  return jpP
}

export function useRewardCtx(): RewardCtx {
  const cards = useCards()
  const sets = useSets()
  const boosters = useBoosters()
  const [jp, setJp] = useState<Record<string, string>>()
  useEffect(() => { let on = true; void loadJp().then((j) => on && setJp(j)); return () => { on = false } }, [])
  return useMemo(() => ({ cards, sets, boosters, jp }), [cards, sets, boosters, jp])
}

const nf = new Intl.NumberFormat('fr-FR')

/** Image hébergée par Pokémon-Zone (cosmétiques, boosters promo) ; si elle ne charge pas, `fallback`. */
function PzImage({ src, alt, className, fallback }: { src: string; alt: string; className: string; fallback: React.ReactNode }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <>{fallback}</>
  return <img className={className} src={src} alt={alt} title={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
}

/**
 * Récompense ou article détaillé : la carte (illustration, possédée ou non), le booster (illustration, logo de
 * l'extension, emblème du booster), le cosmétique (image du jeu, nom du Pokémon), sinon l'icône de l'objet.
 */
export function RewardItem({ r, ctx, eventName, amount, extra }: {
  r: RewardInput; ctx: RewardCtx; eventName?: string; amount?: number; extra?: React.ReactNode
}) {
  const owned = useOwned()
  const v: RewardView = describeReward(r, ctx)
  const qty = amount && amount > 1 ? `${nf.format(amount)} × ` : ''
  const card = v.cardId ? ctx.cards.find((c) => c.id === v.cardId) : undefined
  let pic: React.ReactNode
  let brand: React.ReactNode = null
  const fallbackIcon = <ItemIcon file={r.item} label={v.label} ctx={{ eventName, name: r.name }} size={40} />
  if (card) pic = <CardThumb card={card} qty={owned.get(card.id) ?? 0} />
  else if (v.kind === 'pack' && v.boosterId) {
    pic = <BoosterPackImage boosterId={v.boosterId} className="ev-rw-packimg" fallback={v.pzImage ? <PzImage src={v.pzImage} alt={v.label} className="ev-rw-packimg" fallback={fallbackIcon} /> : fallbackIcon} />
    brand = <span className="ev-rw-brand">{v.setId && <SetLogo setId={v.setId} small />}<BoosterEmblem boosterId={v.boosterId} small /></span>
  } else if (v.kind === 'item') pic = <ItemIcon file={r.item} label={v.label} ctx={{ eventName, name: r.name }} size={40} />
  else if (v.pzImage) pic = <PzImage src={v.pzImage} alt={v.label} className={v.kind === 'pack' ? 'ev-rw-packimg' : 'ev-rw-img'} fallback={fallbackIcon} />
  else pic = fallbackIcon
  if (v.kind === 'pack' && !v.boosterId && v.setId) brand = <span className="ev-rw-brand"><SetLogo setId={v.setId} small /></span>
  const sub = v.kind === 'card' ? (card ? ((owned.get(card.id) ?? 0) > 0 ? `Carte · ×${owned.get(card.id)}` : 'Carte · manquante') : 'Carte') : v.sub
  return (
    <span className={'ev-rw ev-rw-' + v.kind}>
      <span className="ev-rw-pic">{pic}</span>
      <span className="ev-rw-txt">
        {brand}
        <span className="ev-rw-label">{qty}{v.label}</span>
        {sub || extra ? <small className={'muted' + (sub === 'Carte · manquante' ? ' ev-miss' : '')}>{sub}{sub && extra ? ' · ' : ''}{extra}</small> : null}
      </span>
    </span>
  )
}
