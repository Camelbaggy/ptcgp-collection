import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { BASE } from '../db/schema'
import { DEVICE_PREFIX, lsGet, lsSet } from '../storage'
import { ASSET_BASE } from '../native/platform'
import { decodeMht } from '../importers/pzCollection'
import { buildCatalog, findIcon, parsePzIcons, type Names, type ProfileIcon, type PzIcon, type SerebiiIcon, type SerebiiManifest } from './catalog'

/**
 * Icônes de profil disponibles sur cet appareil (communes à tous les profils) :
 * - manifeste Serebii embarqué (`data/profile-icons.json`, absent en développement : liste vide) ;
 * - catalogue Pokémon-Zone lu dans l'appli Android ou importé d'une page enregistrée, gardé dans `ptcgp.profileIcons.pz`.
 */
const LS_PZ = DEVICE_PREFIX + 'profileIcons.pz'
export const PZ_ICONS_URL = 'https://www.pokemon-zone.com/accessories/icons/'

/** Âge au-delà duquel l'appli Android relit le catalogue Pokémon-Zone à l'ouverture. */
export const PZ_ICONS_AUTO_EVERY_MS = 7 * 24 * 3600_000

export interface IconsState { serebii: SerebiiIcon[]; pz: PzIcon[]; pzAt: string | null; loaded: boolean }

function readPz(): { pz: PzIcon[]; pzAt: string | null } {
  try {
    const v = JSON.parse(lsGet(LS_PZ) ?? 'null') as { at?: string; icons?: PzIcon[] } | null
    const pz = Array.isArray(v?.icons) ? v.icons.filter((i) => i && typeof i.num === 'number' && typeof i.asset === 'string' && typeof i.nameEn === 'string') : []
    return { pz, pzAt: v?.at ?? null }
  } catch { return { pz: [], pzAt: null } }
}

let state: IconsState = { serebii: [], ...readPz(), loaded: false }
const subs = new Set<() => void>()
const set = (p: Partial<IconsState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }
let loading: Promise<void> | null = null

function loadSerebii(): Promise<void> {
  loading ??= fetch(`${BASE}data/profile-icons.json`)
    .then((r) => (r.ok ? r.json() as Promise<SerebiiManifest> : { icons: [] }))
    .catch(() => ({ icons: [] }))
    .then((m) => set({ serebii: Array.isArray(m?.icons) ? m.icons : [], loaded: true }))
  return loading
}

export function useProfileIconsState(): IconsState {
  useEffect(() => { void loadSerebii() }, [])
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}

/** Enregistre le catalogue lu sur Pokémon-Zone ; renvoie le nombre d'icônes (erreur si la page n'en montre aucune). */
export function savePzIcons(pages: string[], now = new Date()): number {
  const icons = pages.flatMap((h) => parsePzIcons(decodeMht(h)))
  if (!icons.length) throw new Error('Aucune icône reconnue : enregistre la page « Icons » de Pokémon-Zone (accessories/icons).')
  lsSet(LS_PZ, JSON.stringify({ at: now.toISOString(), icons }))
  set({ pz: icons, pzAt: now.toISOString() })
  return icons.length
}

/** Adresse affichable d'une icône (image embarquée relative à la base des images, ou adresse Pokémon-Zone). */
export const iconImageUrl = (i: ProfileIcon): string => (i.local ? ASSET_BASE + i.src : i.src)

const NO_NAMES: Names = { card: () => undefined, setName: () => undefined }

/** Image d'un identifiant d'icône (pastille du profil) ; les noms ne servent pas ici. */
export function useIconSrc(id: string | undefined): string | null {
  const s = useProfileIconsState()
  return useMemo(() => {
    const icon = id ? findIcon(buildCatalog(s.serebii, s.pz, NO_NAMES), id) : undefined
    return icon ? iconImageUrl(icon) : null
  }, [id, s.serebii, s.pz])
}

/** Catalogue Pokémon-Zone à relire automatiquement (jamais lu, ou plus d'une semaine). */
export function pzIconsDue(now = Date.now()): boolean {
  const t = state.pzAt ? Date.parse(state.pzAt) : NaN
  return Number.isNaN(t) || now - t >= PZ_ICONS_AUTO_EVERY_MS
}
