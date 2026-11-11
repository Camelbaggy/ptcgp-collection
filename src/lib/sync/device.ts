import { DEVICE_PREFIX, lsGet, lsSet } from '../storage'
/** Identité de l'appareil et horodatage des écritures (pour la fusion entre appareils). */
let mem: string | null = null

export function deviceId(): string {
  const key = DEVICE_PREFIX + 'deviceId'
  const saved = lsGet(key)
  if (saved) return saved
  const id = mem ?? 'd' + Math.random().toString(36).slice(2, 10)
  mem = id
  lsSet(key, id)
  return id
}

export function stamp(): { updatedAt: string; by: string } {
  return { updatedAt: new Date().toISOString(), by: deviceId() }
}
