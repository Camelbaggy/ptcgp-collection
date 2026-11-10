import { HoloNative } from '../native/holoNative'
import type { PzHost } from './run'

/** Hôte réel : fenêtre intégrée de l'appli Android (plugin `HoloNative`, `PzWebView`). */
export function nativePzHost(): PzHost {
  let listener: Promise<{ remove: () => Promise<void> }> | null = null
  return {
    open: (url, status) => HoloNative.pzOpen({ url, status }),
    navigate: async (url, timeoutMs = 30_000) => (await HoloNative.pzNavigate({ url, timeoutMs })).ok,
    eval: async (js) => (await HoloNative.pzEval({ js })).value,
    setVisible: (visible, status, button) => HoloNative.pzSetVisible({ visible, status, button }),
    onUi(cb) {
      listener = HoloNative.addListener('pzUi', (e) => cb(e.action))
      return () => { void listener?.then((l) => l.remove()).catch(() => {}) }
    },
    close: () => HoloNative.pzClose(),
  }
}

/** Vrai si la version installée de l'appli Android sait ouvrir la fenêtre Pokémon-Zone. */
export async function pzSyncSupported(): Promise<boolean> {
  try {
    await HoloNative.pzClose()
    return true
  } catch {
    return false // ancienne version de l'appli : méthode absente
  }
}
