import { useSyncExternalStore } from 'react'
import type { SetGuess } from '../../lib/videoScan/detectSet'
import type { VideoImportResult } from '../../lib/videoScan/browser'

/**
 * Lectures d'écran de la MAJ massive, gardées le temps de la session (pas de sauvegarde sur disque :
 * elles contiennent des miniatures). Elles survivent au changement d'écran, pas à la fermeture de l'appli.
 */
export interface ScreenRead { setId: string; result: VideoImportResult; thumbs: string[]; guess: SetGuess; at: number }

let reads: Record<string, ScreenRead> = {}
const subs = new Set<() => void>()
const emit = () => { reads = { ...reads }; subs.forEach((f) => f()) }

export const useScreenReads = (): Record<string, ScreenRead> =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => reads)

export function putScreenRead(r: ScreenRead): void { reads[r.setId] = r; emit() }
export function dropScreenRead(setId: string): void { delete reads[setId]; emit() }
export function clearScreenReads(): void { reads = {}; emit() }
