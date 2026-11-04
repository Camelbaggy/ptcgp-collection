/** Traduction (best effort) des noms d'évènements scrapés en anglais sur Serebii. Fonction pure. */

export interface TranslateCtx {
  sets?: { name: string; nameEn?: string }[]
  cards?: { name: string; nameEn?: string }[]
}

const MONTHS: Record<string, string> = {
  january: 'janvier', february: 'février', march: 'mars', april: 'avril', may: 'mai', june: 'juin',
  july: 'juillet', august: 'août', september: 'septembre', october: 'octobre', november: 'novembre', december: 'décembre',
}
const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)'

const TYPES: Record<string, string> = {
  Grass: 'Plante', Fire: 'Feu', Water: 'Eau', Lightning: 'Électrik', Psychic: 'Psy', Fighting: 'Combat',
  Darkness: 'Obscurité', Metal: 'Métal', Dragon: 'Dragon', Colorless: 'Incolore',
}

/** Expressions fixes, appliquées avant les noms de cartes/extensions (déjà triées par longueur à l'usage). */
const PHRASES: [string, string][] = [
  ['Second Anniversary Celebration Campaign', 'Campagne du 2e anniversaire'],
  ['First Anniversary Countdown', 'Compte à rebours du 1er anniversaire'],
  ['First Anniversary Special', 'Spécial 1er anniversaire'],
  ['Parallel Foil Cards', 'cartes brillantes parallèles'],
  ['PROMO Reissue', 'Réédition PROMO'],
  ['Deluxe Pack', 'Deluxe Pack'],
  ['Elite Deck Gift', 'Cadeau Deck Élite'],
  ['Handy Card Gift', 'Cadeau carte pratique'],
  ['Holiday Event', 'Fêtes de fin d’année'],
  ['New Year Event', 'Nouvel An'],
  ['Part', 'partie'],
]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildDict(ctx: TranslateCtx): [RegExp, string][] {
  const m = new Map<string, string>()
  for (const [en, fr] of PHRASES) m.set(en, fr)
  for (const s of ctx.sets ?? []) if (s.nameEn && s.name) m.set(s.nameEn, s.name)
  for (const c of ctx.cards ?? []) {
    if (!c.nameEn || !c.name) continue
    m.set(c.nameEn, c.name)
    if (/ ex$/.test(c.nameEn) && / ex$/.test(c.name)) m.set(c.nameEn.slice(0, -3), c.name.slice(0, -3))
  }
  return [...m.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([en, fr]) => [new RegExp(`(?<![\\p{L}\\p{N}’'])${esc(en)}(?![\\p{L}\\p{N}])`, 'u'), fr])
}

const cache = new WeakMap<object, [RegExp, string][]>()
function dictFor(ctx: TranslateCtx) {
  let d = cache.get(ctx)
  if (!d) { d = buildDict(ctx); cache.set(ctx, d) }
  return d
}

function frMonths(s: string): string {
  return s.replace(new RegExp(`\\b${MONTH_RE}\\b`, 'g'), (m) => MONTHS[m.toLowerCase()])
}

/** Traduit le coeur X (Pokémon, extension, expressions courantes). Les mots inconnus restent en anglais. */
function inner(x: string, ctx: TranslateCtx): string {
  let s = x.trim()
  s = s.replace(/^(\w+)-type\b/, (m, t: string) => (TYPES[t] ? `type ${TYPES[t]}` : m))
  s = s.replace(/^(.*?)(?:'s|’s) (.+)$/, (m, owner: string, rest: string) => (owner === 'Team Rocket' ? `${rest} de la Team Rocket` : m))
  // Remplacement en un seul passage pour ne pas retraduire un texte déjà traduit.
  const dict = dictFor(ctx)
  const taken: [number, number, string][] = []
  for (const [re, fr] of dict) {
    const g = new RegExp(re.source, 'gu')
    for (let m = g.exec(s); m; m = g.exec(s)) {
      const a = m.index, b = a + m[0].length
      if (!taken.some(([x0, x1]) => a < x1 && b > x0)) taken.push([a, b, fr])
    }
  }
  taken.sort((p, q) => q[0] - p[0])
  for (const [a, b, fr] of taken) s = s.slice(0, a) + fr + s.slice(b)
  return frMonths(s)
}

function tail(t: string): string {
  const s = t.trim()
  return s ? ' ' + frMonths(s).toLowerCase().replace(/(^| )(\d{4})/g, '$1$2') : ''
}

export function translateEventName(name: string, ctx: TranslateCtx = {}): string {
  const n = name.trim().replace(/\s+/g, ' ')
  let m: RegExpExecArray | null

  if ((m = new RegExp(`^Wonder Pick Event (${MONTH_RE}) (\\d{4})$`).exec(n))) return `Pioche miracle – ${MONTHS[m[1].toLowerCase()]} ${m[2]}`
  if ((m = /^Wonder Pick Event(?: (\d{4}))?$/.exec(n))) return `Pioche miracle${m[1] ? ' – ' + m[1] : ''}`
  if ((m = new RegExp(`^Community Week Missions (${MONTH_RE}) (\\d{4})$`).exec(n))) return `Missions de la semaine communautaire – ${MONTHS[m[1].toLowerCase()]} ${m[2]}`
  if ((m = /^Community Week Missions$/.exec(n))) return 'Missions de la semaine communautaire'
  if ((m = new RegExp(`^Bonus Week Missions(?: (${MONTH_RE}))?(?: (\\d{4}))?$`).exec(n)))
    return 'Missions de la semaine bonus' + (m[1] || m[2] ? ' – ' + [m[1] && MONTHS[m[1].toLowerCase()], m[2]].filter(Boolean).join(' ') : '')

  // <X> <Suffix> [Mois] [Année|n°]
  const tl = `((?: ${MONTH_RE})?(?: \\d{1,4})?)`
  if ((m = new RegExp(`^(.+?) Wonder Pick Event${tl}$`).exec(n))) return `Pioche miracle : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Drop Event${tl}$`).exec(n))) return `Évènement drop : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Emblem Event${tl}$`).exec(n))) return `Évènement emblème : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Mass Outbreak Event${tl}$`).exec(n))) return `Apparitions massives : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Missions${tl}$`).exec(n))) return `Missions : ${inner(m[1], ctx)}${tail(m[2])}`
  return name
}
