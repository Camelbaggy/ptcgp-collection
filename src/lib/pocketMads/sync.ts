import { PzCancelled, type PzHost } from '../pzSync/run'
import { POLL_JS, RESET_JS, readChunkJs } from '../pzSync/extractors'
import { PM_GRAB_JS, PM_PROBE_JS } from './extract'
import { parsePmRaw } from './parse'
import type { PmRaw, PmTierList } from './types'

export const PM_TIER_URL = 'https://app.pocketmads.com/tier-list'

const TIMING = { poll: 500, readyMax: 60_000, grabMax: 60_000, userMax: 600_000 }

/**
 * Lit la tier list PocketMads dans la fenêtre intégrée de l'appli Android (même fenêtre que la
 * synchro Pokémon-Zone) : une seule page, ouverte comme le ferait l'utilisateur ; les tiers
 * repliés sont ouverts, puis les decks relevés. La fenêtre reste cachée sauf si une vérification
 * de sécurité s'affiche (à faire soi-même : rien n'est contourné).
 */
export interface PmSyncOptions {
  onProgress?: (label: string) => void
  /** lecture automatique : la fenêtre ne se montre jamais ; une vérification de sécurité arrête tout */
  silent?: boolean
  timing?: Partial<typeof TIMING>
  sleep?: (ms: number) => Promise<void>
}

export async function runPmSync(host: PzHost, o: PmSyncOptions = {}): Promise<PmTierList> {
  const T = { ...TIMING, ...o.timing }
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let cancelled = false
  let forced = false
  const off = host.onUi((a) => { if (a === 'cancel') cancelled = true; else forced = true })
  const check = () => { if (cancelled) throw new PzCancelled() }
  const evalJson = async <X>(js: string): Promise<X | null> => {
    try { return JSON.parse((await host.eval(js)) ?? 'null') as X } catch { return null }
  }
  try {
    o.onProgress?.('Ouverture de PocketMads…')
    await host.open(PM_TIER_URL, 'Ouverture de la tier list PocketMads…', o.silent)
    await host.setVisible(false, 'Lecture de la tier list…', '')
    let t0 = Date.now()
    for (;;) {
      check()
      const p = await evalJson<{ challenge?: boolean; heads?: number }>(PM_PROBE_JS)
      if (p?.challenge) {
        if (o.silent) throw new Error('PocketMads demande une vérification de sécurité.')
        await host.setVisible(true, 'PocketMads demande une vérification : fais-la ici, la lecture reprendra seule.')
        forced = false
        const t1 = Date.now()
        while (Date.now() - t1 < T.userMax) {
          check()
          const q = await evalJson<{ challenge?: boolean }>(PM_PROBE_JS)
          if (forced || (q && !q.challenge)) break
          await sleep(T.poll * 3)
        }
        await host.setVisible(false, 'Lecture de la tier list…', '')
        t0 = Date.now()
        continue
      }
      if ((p?.heads ?? 0) > 0) break
      if (Date.now() - t0 > T.readyMax) throw new Error('La tier list PocketMads ne s\'affiche pas.')
      await sleep(T.poll)
    }
    o.onProgress?.('Lecture des tiers…')
    await host.eval(RESET_JS)
    await host.eval(PM_GRAB_JS)
    const t2 = Date.now()
    for (;;) {
      check()
      const s = await evalJson<{ state?: string; size?: number; err?: string }>(POLL_JS)
      if (s?.state === 'done') {
        let out = ''
        while (out.length < (s.size ?? 0)) {
          const part = await host.eval(readChunkJs(out.length, 120_000))
          if (!part) break
          out += part
        }
        return parsePmRaw(JSON.parse(out) as PmRaw)
      }
      if (s?.state === 'error') throw new Error('Lecture de la tier list impossible : ' + (s.err || 'erreur inconnue'))
      if (Date.now() - t2 > T.grabMax) throw new Error('Lecture de la tier list trop longue.')
      await sleep(T.poll)
    }
  } finally {
    off()
    try { await host.close() } catch { /* déjà fermée */ }
  }
}
