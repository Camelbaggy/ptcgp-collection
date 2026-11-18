import { useSyncExternalStore } from 'react'

/**
 * Clavier virtuel ouvert ? Vrai quand la zone visible (`visualViewport.height`) fait moins de 75 %
 * de la plus grande hauteur vue à cette largeur. La référence est la plus grande hauteur observée
 * (et non `innerHeight`) parce que la WebView Android rétrécit aussi la fenêtre quand le clavier s'ouvre.
 * Pose `data-kb="open"` sur `<html>` : le CSS masque alors la barre du bas et colle `.actionbar` en bas.
 */
export const KB_RATIO = 0.75

/** Pur et testé : le clavier est-il ouvert pour cette hauteur visible et cette référence ? */
export function isKeyboardOpen(visible: number, reference: number): boolean {
  return reference > 0 && visible < reference * KB_RATIO
}

let open = false
let refH = 0
let refW = 0
const listeners = new Set<() => void>()

function measure() {
  const vv = window.visualViewport
  const h = vv?.height ?? window.innerHeight
  const w = window.innerWidth
  if (w !== refW) { refW = w; refH = 0 } // rotation ou nouvelle largeur : on repart de zéro
  refH = Math.max(refH, h, vv ? 0 : window.innerHeight)
  const next = isKeyboardOpen(h, refH)
  if (next === open) return
  open = next
  if (open) document.documentElement.dataset.kb = 'open'
  else delete document.documentElement.dataset.kb
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  if (listeners.size === 0) {
    measure()
    window.visualViewport?.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
  }
  listeners.add(l)
  return () => {
    listeners.delete(l)
    if (listeners.size === 0) {
      window.visualViewport?.removeEventListener('resize', measure)
      window.removeEventListener('resize', measure)
    }
  }
}

export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false)
}
