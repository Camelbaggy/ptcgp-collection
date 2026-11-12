import { prefGet, prefSet } from '../storage'
import { normalizeSettings, type NotifSettings } from './plan'

/** Réglages des notifications (`ptcgp:notif.settings`). */
export const getNotifSettings = (): NotifSettings => normalizeSettings(prefGet<unknown>('notif.settings', null))
export const setNotifSettings = (s: NotifSettings): void => prefSet('notif.settings', s)
