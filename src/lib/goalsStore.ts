import { useSyncExternalStore } from 'react'
import { prefGet, prefSet } from './storage'
import type { Goal } from './goals'

const KEY = 'goals'
let cache: Goal[] | null = null
const listeners = new Set<() => void>()
const read = (): Goal[] => (cache ??= prefGet<Goal[]>(KEY, []).filter((g) => g && typeof g.id === 'string' && (g.copies === 1 || g.copies === 2) && Array.isArray(g.rarities)))
const write = (next: Goal[]) => { cache = next; prefSet(KEY, next); listeners.forEach((l) => l()) }

/** Objectifs enregistrés (préférence locale, incluse dans la sauvegarde JSON, pas dans la synchro Drive). */
export const useGoals = (): Goal[] =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, read)

export const addGoal = (g: Omit<Goal, 'id' | 'createdAt'>): void =>
  write([...read(), { ...g, id: Math.random().toString(36).slice(2, 10), createdAt: new Date().toISOString().slice(0, 10) }])
export const removeGoal = (id: string): void => write(read().filter((g) => g.id !== id))
/** Après import d'une sauvegarde : relire les préférences. */
export const reloadGoals = (): void => { cache = null; listeners.forEach((l) => l()) }
export const restoreGoal = (g: Goal): void => write([...read().filter((x) => x.id !== g.id), g])
/** Place l'objectif en tête de liste : c'est l'objectif principal, présenté en grand. */
export const promoteGoal = (id: string): void => { const g = read().find((x) => x.id === id); if (g) write([g, ...read().filter((x) => x.id !== id)]) }
