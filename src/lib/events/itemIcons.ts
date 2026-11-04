// Pure mapping "Pokémon-Zone icon file name" -> icon to display. Serebii images (public/items, see scripts/fetch-item-icons.mjs)
// when the manifest lists them, otherwise a small built-in icon (see src/features/events/ItemIcon.tsx).

/** Built-in icons (drawn in ItemIcon.tsx) used when no bundled image matches. */
export type BuiltinIcon =
  | 'exp' | 'emblem' | 'cover' | 'backdrop' | 'sleeve' | 'playmat' | 'coin' | 'profile' | 'pack' | 'deck' | 'card' | 'gift'

export type ItemIconRef = { kind: 'image'; path: string; key: string } | { kind: 'builtin'; id: BuiltinIcon }

/** public/data/item-icons.json: image paths relative to the app base. */
export interface ItemIconManifest { items: Record<string, string>; emblems: { name: string; path: string }[] }

/** Pokémon-Zone icon file name (no extension) -> Serebii item key (items/<key>.png), or undefined. */
export function serebiiItemKey(file: string): string | undefined {
  const k = file.replace(/^cmn_icn_/, '')
  if (/^POKEGOLD/i.test(k)) return 'pokegold'
  if (/^SHINEDUST/i.test(k)) return 'shinedust'
  if (/^PACK_CHARGER/i.test(k)) return 'packhourglass'
  // ChallengePowerCharger is labelled "Wonder Hourglass" on Pokémon-Zone (checked on the real pages).
  if (/^CHALLENGE_CHARGER|stamina_challenge/i.test(k)) return 'wonderhourglass'
  if (/^TRADE_CHA[GR]ER/i.test(k)) return 'tradehourglass'
  if (/^EVENT_(CHARGER|HOURGLASS)/i.test(k)) return 'eventhourglass'
  if (/^PREMIER_SHOPTICKET|^SPECIAL_SHOPTICKET/i.test(k)) return 'specialshopticket'
  if (/^EVENT_SHOPTICKET|^SHOPTICKET/i.test(k)) return 'shopticket'
  if (/^PREMIUM_TICKET/i.test(k)) return 'premiumticket'
  if (/^EMBLEM_?TICKET/i.test(k)) return 'emblemticket'
  if (/^TRADE_TOKEN|^TRADETICKET/i.test(k)) return 'tradetoken'
  if (/^ADVANCE_?TICKET/i.test(k)) return 'advanceticket'
  if (/^REWIND/i.test(k)) return 'rewindwatch'
  return undefined
}

const compact = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')

// Pokémon-Zone uses the Japanese names in file names.
const JP_ALIASES: Record<string, string> = {
  aburibbon: 'ribombee', hibanny: 'scorbunny', gekkouga: 'greninja', lizardon: 'charizard', kairyu: 'gyarados',
  fushigibana: 'venusaur', kamex: 'blastoise', mewtwo: 'mewtwo', bashamo: 'blaziken', juptile: 'sceptile',
  sirnight: 'gardevoir', lucario: 'lucario', metagross: 'metagross', hassam: 'scizor', pinsir: 'pinsir',
  rayquaza: 'rayquaza', chiriri: 'togedemaru',
}
const MEGA = /^mega/

function normToken(tok: string): string {
  let t = compact(tok)
  let mega = false
  if (MEGA.test(t) && t.length > 4) { mega = true; t = t.slice(4) }
  let suffix = ''
  const x = /(x|y)$/.exec(t)
  if (mega && x && t.length > 3) { suffix = x[1]; t = t.slice(0, -1) }
  for (const [jp, en] of Object.entries(JP_ALIASES)) if (t === jp) t = en
  return (mega ? 'mega' : '') + t + suffix
}

const GRADE: Record<string, string> = { NOR: 'participation', BRZ: 'bronze', SIL: 'silver', GOL: 'gold' }

/** Serebii emblem (from the manifest, listed newest first) for an EMBLEM_<id>_<NAME> icon, or undefined. */
export function matchEmblem(file: string, eventName: string | undefined, emblems: ItemIconManifest['emblems']): string | undefined {
  const m = /^EMBLEM_\d+_(.+)$/i.exec(file)
  if (!m || !emblems.length) return undefined
  const rest = m[1]
  const ev = /^EVENT\d+(?:_(NOR|BRZ|SIL|GOL))?$/i.exec(rest)
  if (ev) {
    // Event emblems: "<event> Emblem Event [n] <Participation|Bronze|Silver|Gold> Emblem" on Serebii.
    if (!eventName || !ev[1]) return undefined
    const base = compact(eventName.replace(/\bEmblem Event\b.*$/i, '').replace(/\b(SP|Event)\b/gi, '').replace(/\b\d{4}\b/g, ''))
    if (base.length < 4) return undefined
    const grade = GRADE[ev[1].toUpperCase()]
    const hit = emblems.find((e) => {
      const n = compact(e.name)
      return /emblemevent/.test(n) && n.startsWith(base) && n.includes(grade)
    })
    return hit?.path
  }
  const tok = normToken(rest.replace(/_?(NOR|BRZ|SIL|GOL)$/i, ''))
  if (tok.length < 3) return undefined
  const exact = emblems.filter((e) => /emblem$/i.test(e.name) && !/emblem event/i.test(e.name) && normToken(e.name.replace(/\bEmblem$/i, '').replace(/\bver\.?\s*\d+/i, '')) === tok)
  return exact[0]?.path // several versions (Pikachu): the first listed = the most recent
}

export interface IconCtx {
  /** Displayed name (shop items: "Mega Greninja (playmat)"). */
  name?: string
  /** English name of the event (to match emblem events). */
  eventName?: string
}

/** Icon for a Pokémon-Zone icon file name (`POKEGOLD`, `EMBLEM_101430_EVENT16_NOR`, `PLAYMAT_100920_...`). */
export function resolveItemIcon(file: string | undefined, ctx: IconCtx = {}, manifest?: ItemIconManifest): ItemIconRef {
  const k = (file ?? '').replace(/^cmn_icn_/, '')
  const image = (key: string): ItemIconRef | undefined => {
    const path = manifest?.items[key]
    return path ? { kind: 'image', path, key } : undefined
  }
  const key = serebiiItemKey(k)
  if (key) return image(key) ?? { kind: 'builtin', id: 'gift' }
  if (/^item_exp/i.test(k)) return { kind: 'builtin', id: 'exp' }
  if (/^EMBLEM_/i.test(k)) {
    const path = manifest && matchEmblem(k, ctx.eventName, manifest.emblems)
    return path ? { kind: 'image', path, key: 'emblem' } : { kind: 'builtin', id: 'emblem' }
  }
  if (/^COIN_/i.test(k)) return { kind: 'builtin', id: 'coin' }
  if (/^DECKSHIELD_/i.test(k)) return { kind: 'builtin', id: 'sleeve' }
  if (/^PLAYMAT_/i.test(k)) return { kind: 'builtin', id: 'playmat' }
  if (/^ICON_BOARD/i.test(k)) return { kind: 'builtin', id: 'backdrop' }
  if (/^ICON_FILE/i.test(k)) return { kind: 'builtin', id: 'cover' }
  if (/^PROFILE_ICON/i.test(k)) return { kind: 'builtin', id: 'profile' }
  if (/^PACK_ICON/i.test(k)) return { kind: 'builtin', id: 'pack' }
  if (/^c(PK|TR)_/.test(k)) return { kind: 'builtin', id: 'card' }
  // Name-based fallbacks (shop items without a recognised file name).
  const n = ctx.name ?? ''
  if (/\bdeck\b/i.test(n) && !/sleeve/i.test(n)) return { kind: 'builtin', id: 'deck' }
  if (/\(cover\)|binder/i.test(n)) return { kind: 'builtin', id: 'cover' }
  if (/\(backdrop\)|display board/i.test(n)) return { kind: 'builtin', id: 'backdrop' }
  if (/\(card sleeve\)/i.test(n)) return { kind: 'builtin', id: 'sleeve' }
  if (/\(playmat\)/i.test(n)) return { kind: 'builtin', id: 'playmat' }
  if (/\(Pokémon coin\)/i.test(n)) return { kind: 'builtin', id: 'coin' }
  return { kind: 'builtin', id: 'gift' }
}
