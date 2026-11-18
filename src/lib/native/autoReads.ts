import { maybeAutoEventsSync } from '../events/autoSync'
import { maybeAutoPmSync } from '../pocketMads/auto'
import { maybeAutoPzIconsRead } from '../profileIcons/pzRead'

/**
 * Lectures automatiques de l'appli Android, à l'ouverture et au retour dans l'appli, l'une après l'autre (elles
 * partagent la fenêtre intégrée) : évènements Pokémon-Zone (au plus une fois par heure), puis tier list PocketMads
 * (au plus toutes les 6 h), puis icônes de profil Pokémon-Zone (au plus une fois par semaine). Chacune décide seule
 * si elle est due.
 */
let running = false

export async function runAutoReads(): Promise<void> {
  if (running) return
  running = true
  try {
    await maybeAutoEventsSync().catch(() => {})
    await maybeAutoPmSync().catch(() => {})
    await maybeAutoPzIconsRead().catch(() => {})
  } finally { running = false }
}

/** À appeler une fois au démarrage de l'appli Android. */
export function setupAutoReads(): void {
  const go = () => { void runAutoReads() }
  // laisse l'appli finir de démarrer (base de données, mise à jour éventuelle)
  setTimeout(go, 4000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(go, 1500) })
}
