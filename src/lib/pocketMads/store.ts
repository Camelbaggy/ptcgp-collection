import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { PmTierList } from './types'

/** Dernière tier list PocketMads lue, rangée dans la table `meta` (non synchronisée : elle se relit). */
export const PM_KEY = 'pm.tierlist'
const KEY = PM_KEY

export async function savePmTierList(t: PmTierList): Promise<void> {
  await db.meta.put({ key: KEY, value: t })
}

/** null tant qu'aucune lecture ; undefined pendant le chargement. */
export function usePmTierList(): PmTierList | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get(KEY))?.value as PmTierList | undefined) ?? null, [])
}

/** Données du favori, dans l'ancre de l'adresse (`#/meta?pm=<base64url du JSON>`). */
export function decodePmPayload(b64: string): unknown {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}
