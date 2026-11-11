/**
 * La fenêtre intégrée Pokémon-Zone / PocketMads de l'appli Android est unique : une seule lecture à la fois
 * (synchro de collection, tier list, évènements). Chaque lecture la réserve le temps de son travail ; une lecture
 * demandée par l'utilisateur interrompt une lecture automatique en cours.
 */
interface Holder { name: string; cancel?: () => void; auto: boolean }
let holder: Holder | null = null

export const windowBusy = (): boolean => holder !== null

/** Réserve la fenêtre pour une lecture automatique ; renvoie la fonction qui la libère, ou null si elle est prise. */
export function holdWindow(name: string, cancel?: () => void): (() => void) | null {
  if (holder) return null
  const h: Holder = { name, cancel, auto: true }
  holder = h
  return () => { if (holder === h) holder = null }
}

/**
 * Réserve la fenêtre pour une lecture demandée par l'utilisateur : une lecture automatique en cours est annulée
 * (attente de sa fin, 10 s au plus). Null si une autre lecture demandée par l'utilisateur tourne déjà.
 */
export async function takeWindow(name: string, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<(() => void) | null> {
  if (holder && !holder.auto) return null
  if (holder) {
    holder.cancel?.()
    for (let i = 0; i < 50 && holder; i++) await wait(200)
    if (holder) return null
  }
  const h: Holder = { name, auto: false }
  holder = h
  return () => { if (holder === h) holder = null }
}
