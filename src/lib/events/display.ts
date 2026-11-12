/** Aides d'affichage de l'écran Évènements (fonctions pures, testées). */

/**
 * Nom court pour une ligne de liste : sans le préfixe de catégorie (« Évènement drop : », « Missions : »),
 * puisque la pastille de catégorie le dit déjà. Le nom complet reste dans la fiche.
 */
export function shortEventName(label: string): string {
  const s = label.replace(/^(?:Évènement|Évènements)\s+[^:]{1,30}?\s*:\s+/i, '').replace(/^Missions?\s*:\s+/i, '')
  const t = s.trim()
  if (!t) return label
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Vrai pour chaque évènement qui commence ou se termine pendant le jour [d0, d1) ; `null` sinon. Les évènements ponctuels « commencent ». */
export function edgeOn(e: { start: string; end: string }, d0: number, d1: number): 'start' | 'end' | 'both' | null {
  const s = Date.parse(e.start), x = Date.parse(e.end)
  const starts = s >= d0 && s < d1
  const ends = x > s && x > d0 && x <= d1
  return starts && ends ? 'both' : starts ? 'start' : ends ? 'end' : null
}

export interface MissionLike<R> { text: string; reward?: R }
export interface MissionGroup<R> { text: string; reward?: R; count: number }

const sing = (s: string) => s.replace(/\b(\w{3,}?)s\b/g, '$1')
const rewardKey = (r: unknown): string => (r ? JSON.stringify(r) : '')

/**
 * Regroupe les missions identiques à un nombre près qui ont la même récompense :
 * « Participer à 1 combat », « … 3 combats », « … 5 combats » → « Participer à 1, 3, 5 combats ».
 * `text` est déjà traduit. Un groupe n'est fusionné que si un seul nombre varie ; sinon les lignes restent séparées.
 */
export function groupMissions<R>(missions: MissionLike<R>[]): MissionGroup<R>[] {
  const buckets = new Map<string, MissionLike<R>[]>()
  const order: (string | MissionLike<R>)[] = []
  for (const m of missions) {
    if (!/\d/.test(m.text)) { order.push(m); continue }
    const key = sing(m.text.replace(/\d+/g, '#')) + '|' + rewardKey(m.reward)
    const b = buckets.get(key)
    if (b) b.push(m)
    else { buckets.set(key, [m]); order.push(key) }
  }
  const out: MissionGroup<R>[] = []
  for (const o of order) {
    if (typeof o !== 'string') { out.push({ text: o.text, reward: o.reward, count: 1 }); continue }
    const list = buckets.get(o)!
    const nums = list.map((m) => m.text.match(/\d+/g) ?? [])
    const slots = nums[0].length
    const varying = Array.from({ length: slots }, (_, i) => i).filter((i) => nums.some((n) => n[i] !== nums[0][i]))
    if (list.length === 1 || varying.length !== 1) {
      for (const m of list) out.push({ text: m.text, reward: m.reward, count: 1 })
      continue
    }
    const slot = varying[0]
    const joined = [...new Set(nums.map((n) => n[slot]))].join(', ')
    // on garde la forme (pluriel) de la dernière mission, la plus grande
    let i = -1
    const last = list[list.length - 1].text.replace(/\d+/g, (d) => (++i === slot ? joined : d))
    out.push({ text: last, reward: list[0].reward, count: list.length })
  }
  return out
}
