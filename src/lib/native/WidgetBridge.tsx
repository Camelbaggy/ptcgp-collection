/**
 * Appli Android : tient à jour le widget d'écran d'accueil (lot F11). Calcule le résumé à partir des données
 * partagées (DataProvider) et l'envoie au natif quand ce qu'il affiche change : 3 s après le dernier changement,
 * ou tout de suite quand l'appli passe en arrière-plan. Ne rend rien.
 */
import { useContext, useEffect } from 'react'
import { packUrl } from '../assets'
import { BoostersContext, CardsContext, OwnedContext, RatesContext } from '../dataContext'
import { widgetKey, widgetSummary } from '../widget/summary'
import { HoloNative } from './holoNative'

const DELAY_MS = 3000
let lastKey = ''
let unsupported = false

export default function WidgetBridge() {
  const cards = useContext(CardsContext)
  const boosters = useContext(BoostersContext)
  const rates = useContext(RatesContext)
  const owned = useContext(OwnedContext)

  useEffect(() => {
    if (!cards || !boosters || !rates || !owned || cards.raw.length === 0) return
    let done = false
    const flush = () => {
      if (done || unsupported) return
      done = true
      const s = widgetSummary(cards.raw, boosters.list, rates, owned, packUrl)
      const key = widgetKey(s)
      if (key === lastKey) return
      lastKey = key
      HoloNative.widgetUpdate({ summary: JSON.stringify(s) }).catch(() => { unsupported = true }) // APK sans widget
    }
    const t = setTimeout(flush, DELAY_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onHide) }
  }, [cards, boosters, rates, owned])

  return null
}
