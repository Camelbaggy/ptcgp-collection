/** Traduction (best effort) des noms d'évènements anglais (Pokémon-Zone). Fonction pure. */

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
  ['Handy Card Collection', 'Collection de cartes pratiques'],
  ['Winter Holidays', 'Fêtes d’hiver'],
  ['Summer Holidays', 'Vacances d’été'],
  ['Step-Up Battle', 'Combat progressif'],
  ['Random Battles', 'Combats aléatoires'],
  ['Battle Rally', 'Rallye de combats'],
  ['Pack Hourglass', 'Sablier de booster'],
  ['Wonder Hourglass', 'Sablier de pioche'],
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
export function translatePhrase(x: string, ctx: TranslateCtx = {}): string { return inner(x, ctx) }
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
  return s ? ' ' + frMonths(s) : ''
}

const SHOP_KIND: Record<string, string> = { Cards: 'cartes', Items: 'objets', Accessories: 'accessoires' }

/** Offres Poké Gold payantes : "Sale: Poké Gold (paid) ×100 Deal" -> "Promo Poké Lingots (payant) ×100". */
function goldName(n: string): string {
  const pre = /^(Sale|(\d+)(?:st|nd|rd|th) Anniv\.): /.exec(n)
  const lead = !pre ? '' : pre[1] === 'Sale' ? 'Promo ' : `${pre[2]}e anniv. : `
  let s = n.slice(pre ? pre[0].length : 0)
  s = s.replace(/Poké Gold/g, 'Poké Lingots').replace(/\(paid\)/g, '(payant)').replace(/\(non-paid\)/g, '(non payant)')
    .replace(/\bSuper Deal\b/, 'super offre').replace(/\bDeal\b/, '').replace(/\bBonus\b/, 'bonus')
    .replace(/New Booster Pack Jump Start!/, 'Lancement du nouveau booster :').replace(/Accessories/, 'accessoires')
  return (lead + s).replace(/\s+/g, ' ').trim()
}

/** Traduit X comme un nom d'évènement s'il en est un (« … Drop Event 2026 »), sinon comme un simple coeur. */
function sub(x: string, ctx: TranslateCtx): string {
  const r = translateEventName(x, ctx)
  return r !== x ? r : inner(x, ctx)
}

export function translateEventName(name: string, ctx: TranslateCtx = {}): string {
  const n = name.trim().replace(/\s+/g, ' ')
  let m: RegExpExecArray | null

  if (n === 'Poké Gold Offers') return 'Offres Poké Lingots'
  if ((m = new RegExp(`^Wonder Pick Event (${MONTH_RE}) (\\d{4})$`).exec(n))) return `Pioche miracle – ${MONTHS[m[1].toLowerCase()]} ${m[2]}`
  if ((m = /^Wonder Pick Event(?: (\d{4}))?$/.exec(n))) return `Pioche miracle${m[1] ? ' – ' + m[1] : ''}`
  if ((m = new RegExp(`^Community Week Missions (${MONTH_RE}) (\\d{4})$`).exec(n))) return `Missions de la semaine communautaire – ${MONTHS[m[1].toLowerCase()]} ${m[2]}`
  if ((m = /^Community Week Missions$/.exec(n))) return 'Missions de la semaine communautaire'
  if ((m = new RegExp(`^Bonus Week Missions(?: (${MONTH_RE}))?(?: (\\d{4}))?$`).exec(n)))
    return 'Missions de la semaine bonus' + (m[1] || m[2] ? ' – ' + [m[1] && MONTHS[m[1].toLowerCase()], m[2]].filter(Boolean).join(' ') : '')

  // <X> <Suffix> [Mois] [Année|n°]
  const tl = `((?: ${MONTH_RE})?(?: \\d{1,4})?(?: [A-Z]\\d[a-z]?)?)`
  if ((m = new RegExp(`^(.+?) Wonder Pick [Ee]vent${tl}$`).exec(n))) return `Pioche miracle : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Drop Event${tl}$`).exec(n))) return `Évènement drop : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Emblem Event${tl}$`).exec(n))) return `Évènement emblème : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = new RegExp(`^(.+?) Mass Outbreak Event${tl}$`).exec(n))) return `Apparitions massives : ${inner(m[1], ctx)}${tail(m[2])}`
  if ((m = /^(?:(Sale|[0-9]+(?:st|nd|rd|th) Anniv\.|[A-Za-z ]+!?): )?(?:(.*?) )?Poké Gold \(paid\)(.*)$/.exec(n))) return goldName(n)
  if ((m = new RegExp(`^(${MONTH_RE}) (\\d{4}) Premium (Missions|Shop)(?: - (Cards|Items|Accessories))?$`).exec(n)))
    return `${m[3] === 'Shop' ? 'Boutique premium' : 'Missions premium'} – ${MONTHS[m[1].toLowerCase()]} ${m[2]}${m[4] ? ' – ' + SHOP_KIND[m[4]] : ''}`
  if ((m = new RegExp(`^Bonus Week (?!Missions)(.+)$`).exec(n))) {
    const t = new RegExp(`^(${MONTH_RE}) (\\d{4})$`).exec(m[1])
    return t ? `Semaine bonus – ${MONTHS[t[1].toLowerCase()]} ${t[2]}` : `Semaine bonus : ${inner(m[1], ctx)}`
  }
  if ((m = /^(.+?) Themed Promo Card Event Week ?(\d+)$/.exec(n))) return `Carte promo thématique : ${inner(m[1], ctx)} (semaine ${m[2]})`
  if ((m = /^(.+?) Daily Missions$/.exec(n))) return `Missions quotidiennes : ${inner(m[1], ctx)}`
  if ((m = /^(.+?) Limited Battles$/.exec(n))) return `Combats limités : ${inner(m[1], ctx)}`
  if ((m = /^(.+?) Shop(?: - (Cards|Items|Accessories))?$/.exec(n))) return `Boutique : ${sub(m[1], ctx)}${m[2] ? ' – ' + SHOP_KIND[m[2]] : ''}`
  if ((m = /^"(.+?)" [Ee]vent Missions$/.exec(n))) return `Missions : « ${m[1]} »`
  if ((m = /^(.+?) \(missions\)$/.exec(n))) return `Missions : ${inner(m[1], ctx)}`
  if ((m = new RegExp(`^(.+?) [Mm]issions${tl}$`).exec(n))) return `Missions : ${sub(m[1], ctx)}${tail(m[2])}`
  return name
}

/** Libellé français d'un objet à partir du nom de son icône (`POKEGOLD`, `EMBLEM_101440_EVENT16_BRZ`...). Inconnu : « Objet ». */
export function itemLabelFr(key: string): string {
  const k = key.replace(/^cmn_icn_/, '')
  if (/^POKEGOLD/i.test(k)) return 'Poké Lingots'
  if (/^SHINEDUST/i.test(k)) return 'Poussière scintillante'
  if (/^PACK_CHARGER/i.test(k)) return 'Sablier de booster'
  if (/^CHALLENGE_CHARGER/i.test(k) || /stamina_challenge/i.test(k)) return 'Sablier de pioche'
  if (/^TRADE_CHA/i.test(k)) return 'Sablier d’échange'
  if (/^EVENT_SHOPTICKET/i.test(k)) return 'Ticket d’évènement'
  if (/^SHOPTICKET/i.test(k)) return 'Ticket de boutique'
  if (/^PREMIUM_TICKET/i.test(k)) return 'Ticket premium'
  if (/^TRADE_TOKEN|^TRADETICKET/i.test(k)) return 'Ticket d’échange'
  if (/^item_exp/i.test(k)) return 'Points d’expérience'
  if (/^EMBLEM_/i.test(k)) {
    const grade = /_(NOR|BRZ|SIL|GOL)$/i.exec(k)?.[1].toUpperCase()
    const g = grade === 'BRZ' ? ' bronze' : grade === 'SIL' ? ' argent' : grade === 'GOL' ? ' or' : ''
    return 'Emblème' + g
  }
  if (/^COIN_/i.test(k)) return 'Pièce de combat'
  if (/^DECKSHIELD_/i.test(k)) return 'Protège-deck'
  if (/^PLAYMAT_/i.test(k)) return 'Tapis de jeu'
  if (/^ICON_BOARD/i.test(k)) return 'Tableau de collection'
  if (/^ICON_FILE/i.test(k)) return 'Classeur'
  if (/^PACK_ICON/i.test(k)) return 'Booster'
  if (/^c(PK|TR)_/.test(k)) return 'Carte'
  return 'Objet'
}

const plural = (n: number, one: string, many = one + 's') => (n > 1 ? many : one)
const RARITY_FR: Record<string, string> = { 'Trainer': 'Dresseur', 'Art Rare': 'Art Rare', 'Special Art Rare or Super Rare': 'Art Rare Spécial ou Super Rare', 'Immersive Rare': 'Immersive Rare', 'Crown Rare': 'Couronne', 'Shiny': 'Chromatique', 'Shiny Super Rare': 'Super Rare chromatique' }

/** Traduction de l'intitulé d'une mission (motifs simples ; sinon texte d'origine). */
export function translateMission(text: string, ctx: TranslateCtx = {}): string {
  const t = text.trim()
  let m: RegExpExecArray | null
  const where = (x: string) => inner(x, ctx)
  if ((m = /^Log in \(Day (\d+)\)$/.exec(t))) return `Se connecter (jour ${m[1]})`
  if ((m = /^Week (\d+) log in \(Day (\d+)\)$/.exec(t))) return `Se connecter, semaine ${m[1]} (jour ${m[2]})`
  if (t === 'Log in') return 'Se connecter'
  if ((m = /^Wonder pick (\d+) times?$/.exec(t))) return `Pioche miracle ${m[1]} fois`
  if ((m = /^Participate in (\d+) battles?$/.exec(t))) return `Participer à ${m[1]} ${plural(+m[1], 'combat')}`
  if ((m = /^Win (\d+) battles?$/.exec(t))) return `Gagner ${m[1]} ${plural(+m[1], 'combat')}`
  if ((m = /^Use pack stamina to open (\d+) booster packs?$/.exec(t))) return `Utiliser l’endurance de pack pour ouvrir ${m[1]} ${plural(+m[1], 'booster')}`
  if ((m = /^Trade (\d+) times?$/.exec(t))) return `Échanger ${m[1]} fois`
  if ((m = /^Share (\d+) times?$/.exec(t))) return `Partager ${m[1]} fois`
  if ((m = /^Send (\d+) thanks$/.exec(t))) return `Envoyer ${m[1]} remerciements`
  if ((m = /^Register (\d+) friends?$/.exec(t))) return `Ajouter ${m[1]} ${plural(+m[1], 'ami')}`
  if ((m = /^Get (\d+) points in solo battles$/.exec(t))) return `Obtenir ${m[1]} points en combats solo`
  if ((m = /^Collect (\d+) cards$/.exec(t))) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')}`
  if ((m = /^Collect (\d+) specific cards from (.+)$/.exec(t))) return `Obtenir ${m[1]} ${plural(+m[1], 'carte précise', 'cartes précises')} de ${where(m[2])}`
  if ((m = /^Collect (\d+) cards from (.+)$/.exec(t))) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')} de ${where(m[2])}`
  if ((m = /^Collect (\d+) (\w+) cards$/.exec(t)) && TYPES[m[2]]) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')} de type ${TYPES[m[2]]}`
  if ((m = /^Collect (\d+) (\w+) Pokémon cards from (.+)$/.exec(t)) && TYPES[m[2]]) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')} Pokémon de type ${TYPES[m[2]]} de ${where(m[3])}`
  if ((m = /^Collect (\d+) (.+?) cards from (.+)$/.exec(t)) && RARITY_FR[m[2]]) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')} ${RARITY_FR[m[2]]} de ${where(m[3])}`
  if ((m = /^Collect (\d+) (.+?) cards$/.exec(t))) { const x = where(m[2]); if (x !== m[2]) return `Obtenir ${m[1]} ${plural(+m[1], 'carte')} ${x}` }
  return text
}

/** Règle de combat limité (texte de Pokémon-Zone) ; sinon texte d'origine. */
export function translateRules(text: string, ctx: TranslateCtx = {}): string {
  const m = /^Only cards from (.+?) can be used, and promo cards are not allowed\. These cards are the exception and can be used too:?$/.exec(text.trim())
  return m ? `Seules les cartes de ${inner(m[1], ctx)} sont autorisées, sans cartes promo. Exceptions autorisées :` : text
}
