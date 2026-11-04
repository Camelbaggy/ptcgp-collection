/** Identité de l'appareil et horodatage des écritures (pour la fusion entre appareils). */
let mem: string | null = null

export function deviceId(): string {
  try {
    let id = localStorage.getItem('ptcgp.deviceId')
    if (!id) {
      id = 'd' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('ptcgp.deviceId', id)
    }
    return id
  } catch {
    return (mem ??= 'd' + Math.random().toString(36).slice(2, 10))
  }
}

export function stamp(): { updatedAt: string; by: string } {
  return { updatedAt: new Date().toISOString(), by: deviceId() }
}
