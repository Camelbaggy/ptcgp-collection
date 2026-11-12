/**
 * Notifications locales de l'appli Android (plugin `@capacitor/local-notifications`) : lecture des données, planification
 * et toucher d'une notification. Chargé uniquement dans l'appli (`isNative`) ; sur le web rien n'est importé.
 * Tout est calculé et prévu sur le téléphone, rien ne passe par Internet.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { liveQuery } from 'dexie'
import { BASE, db } from '../db'
import { releaseEvents, type GameEvent, type Release } from '../events/parse'
import { translateEventName } from '../events/translate'
import { mergeEvents, PRUNE_DAYS } from '../../features/events/useEvents'
import { HoloNative } from '../native/holoNative'
import { planNotifications, type PlanInput, type PlannedNotif } from './plan'
import { getNotifSettings } from './settings'

const CHANNEL = 'rappels'
const SMALL_ICON = 'ic_stat_holo'
const ICON_COLOR = '#a794ff'
const TEST_ID = 9999

const log = (message: string) => { void HoloNative.log({ message: `[notif] ${message}`.slice(0, 800) }).catch(() => {}) }

async function loadReleases(): Promise<GameEvent[]> {
  try {
    const r = await fetch(`${BASE}data/releases.json`)
    const t = r.ok ? await r.text() : ''
    const j = t.trim().startsWith('[') ? (JSON.parse(t) as Release[]) : []
    return releaseEvents(j, new Date(Date.now() - PRUNE_DAYS * 86400000))
  } catch { return [] }
}

/** Données nécessaires au calcul, lues dans la base locale (et `releases.json`). */
export async function loadPlanInput(now = Date.now()): Promise<PlanInput> {
  const [imported, releases, sets, cards, owned, last] = await Promise.all([
    db.importedEvents.toArray(), loadReleases(), db.sets.toArray(), db.cards.toArray(), db.owned.toArray(),
    db.history.orderBy('date').last(),
  ])
  const ctx = { sets, cards }
  const qty = new Map(owned.map((o) => [o.cardId, o.quantity]))
  const lastUpdate = last ? Date.parse(last.date) : NaN
  return {
    now,
    settings: getNotifSettings(),
    events: mergeEvents(imported, releases, now),
    label: (e) => (e.type === 'expansion' ? e.name : translateEventName(e.name, ctx)),
    missing: (e) => (e.cardIds ?? []).filter((id) => (qty.get(id) ?? 0) === 0).length,
    lastUpdate: Number.isFinite(lastUpdate) ? lastUpdate : null,
  }
}

/** Notifications prévues avec les réglages actuels (pour la liste « Prochaines notifications »). */
export async function previewPlan(): Promise<PlannedNotif[]> {
  return planNotifications(await loadPlanInput())
}

export async function notifPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const p = (await LocalNotifications.checkPermissions()).display
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt'
  } catch { return 'denied' }
}

/** Demande l'autorisation Android (fenêtre système sur Android 13+). */
export async function requestNotifPermission(): Promise<boolean> {
  try { return (await LocalNotifications.requestPermissions()).display === 'granted' } catch { return false }
}

let channelReady = false
async function ensureChannel(): Promise<void> {
  if (channelReady) return
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'Rappels', description: 'Fins d’évènements, nouvelles extensions et rappels de mise à jour', importance: 3 })
  channelReady = true
}

async function cancelPending(): Promise<void> {
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) })
}

let running: Promise<void> | null = null
let again = false

/** Remplace toutes les notifications prévues par celles calculées maintenant. Ne demande jamais l'autorisation. */
export function reschedule(): Promise<void> {
  if (running) { again = true; return running }
  running = (async () => {
    try {
      do {
        again = false
        await doReschedule()
      } while (again)
    } catch (e) {
      log(`échec de la planification : ${(e as Error)?.message ?? String(e)}`)
    } finally { running = null }
  })()
  return running
}

async function doReschedule(): Promise<void> {
  const settings = getNotifSettings()
  if (!settings.enabled || (await notifPermission()) !== 'granted') { await cancelPending(); return }
  const plan = planNotifications(await loadPlanInput())
  await ensureChannel()
  await cancelPending()
  if (!plan.length) return
  await LocalNotifications.schedule({
    notifications: plan.map((n) => ({
      id: n.id, title: n.title, body: n.body, largeBody: n.body,
      channelId: CHANNEL, smallIcon: SMALL_ICON, iconColor: ICON_COLOR, autoCancel: true,
      // alarme approximative (quelques minutes) : pas d'autorisation « Alarmes et rappels » à demander
      isExactNotification: false,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      extra: { route: n.route },
    })),
  })
  log(`${plan.length} notification(s) prévue(s), prochaine le ${new Date(plan[0].at).toLocaleString('fr-FR')}`)
}

/** Notification d'essai, dans 5 secondes. */
export async function sendTestNotification(): Promise<void> {
  await ensureChannel()
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_ID, title: 'Notification d’essai', body: 'Les notifications de l’Holothèque fonctionnent.',
      channelId: CHANNEL, smallIcon: SMALL_ICON, iconColor: ICON_COLOR, autoCancel: true, isExactNotification: false,
      schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { route: '#/reglages?ouvrir=notif' },
    }],
  })
}

/** À appeler une fois au démarrage de l'appli : toucher d'une notification, replanification quand les données changent. */
export function setupNotifications(): void {
  void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const route = (a.notification.extra as { route?: unknown } | undefined)?.route
    if (typeof route === 'string' && route.startsWith('#/')) location.hash = route
  }).catch(() => {})

  // Évènements importés, dernière saisie, extensions : replanifie (au calme) quand l'un change.
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => { void reschedule() }, ms) }
  liveQuery(async () => {
    const [evs, last] = await Promise.all([db.importedEvents.toArray(), db.history.orderBy('date').last()])
    return `${evs.map((e) => `${e.id}@${e.end}`).sort().join(',')}|${last?.id ?? ''}`
  }).subscribe({ next: () => soon(3000), error: () => {} })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(3000) })
}
