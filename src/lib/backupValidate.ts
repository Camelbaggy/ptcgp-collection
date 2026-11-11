/** Validation d'une sauvegarde JSON avant tout effacement : une seule ligne invalide refuse le fichier. */
const KINDS = new Set(['pack', 'share', 'trade', 'correction'])
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const isCount = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 100000

type Check = (r: Record<string, unknown>) => boolean
const CHECKS: Record<string, [label: string, check: Check]> = {
  sets: ['extensions', (r) => isStr(r.id)],
  boosters: ['boosters', (r) => isStr(r.id)],
  cards: ['cartes', (r) => isStr(r.id)],
  rates: ['taux', (r) => isStr(r.boosterId)],
  owned: ['quantités', (r) => isStr(r.cardId) && isCount(r.quantity)],
  wishlist: ['souhaits', (r) => isStr(r.cardId) && typeof r.priority === 'number' && Number.isInteger(r.priority) && r.priority >= 1 && r.priority <= 9],
  history: ['évènements', (r) => isStr(r.id) && typeof r.kind === 'string' && KINDS.has(r.kind) && typeof r.date === 'string'],
  meta: ['réglages', (r) => isStr(r.key)],
  importedEvents: ['évènements importés', (r) => isStr(r.id)],
}

/** Lève une erreur claire si le fichier n'est pas une sauvegarde saine. N'écrit rien. */
export function validateBackup(data: unknown): void {
  if (!isObj(data) || data.app !== 'ptcgp-collection' || !Array.isArray(data.owned) || !Array.isArray(data.cards))
    throw new Error('Fichier de sauvegarde invalide')
  for (const [key, [label, check]] of Object.entries(CHECKS)) {
    const rows = data[key]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) throw new Error(`Sauvegarde invalide : « ${label} » illisible. Rien n’a été modifié.`)
    const bad = rows.filter((r) => !isObj(r) || !check(r)).length
    if (bad) throw new Error(`Sauvegarde invalide : ${bad} ligne${bad > 1 ? 's' : ''} incorrecte${bad > 1 ? 's' : ''} dans « ${label} ». Rien n’a été modifié.`)
  }
}
