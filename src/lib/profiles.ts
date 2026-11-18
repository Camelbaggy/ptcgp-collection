/**
 * Profils (membres du foyer) : une base IndexedDB par profil, docs/profiles.md.
 * - Le profil principal (`main`) garde la base `ptcgp` et les clés locales d'origine : aucune migration.
 * - Un autre profil a sa base `ptcgp-p-<id>`, ses clés `ptcgp.p.<id>.*` / `ptcgp:p.<id>.*`
 *   et son fichier Drive `ptcgp-sync-<id>.json`.
 * - Le profil actif est lu une fois au chargement ; changer de profil recharge la page.
 */
import { DEVICE_PREFIX, PREF_PREFIX, lsGet, lsRemove, lsSet } from './storage'

export interface Profile {
  id: string; name: string; color: string; createdAt: string
  /** icône du jeu choisie comme image de profil (id du catalogue `lib/profileIcons`) ; sans : l'initiale */
  icon?: string
}

export const MAIN_PROFILE_ID = 'main'
export const PROFILE_COLORS = ['violet', 'pink', 'teal', 'orange', 'blue', 'green', 'yellow', 'red'] as const
export type ProfileColor = (typeof PROFILE_COLORS)[number]
export const MAX_PROFILES = 8
export const MAX_NAME = 24

const LS_LIST = DEVICE_PREFIX + 'profiles'
const LS_ACTIVE = DEVICE_PREFIX + 'profile.active'
const ID_RE = /^[a-z0-9]{4,16}$/
const ICON_RE = /^(s|pz)-[a-z0-9]{1,64}$/

const defaultMain = (): Profile => ({ id: MAIN_PROFILE_ID, name: 'Moi', color: 'violet', createdAt: '' })

function isProfile(x: unknown): x is Profile {
  const p = x as Partial<Profile> | null
  return !!p && typeof p.id === 'string' && (p.id === MAIN_PROFILE_ID || ID_RE.test(p.id))
    && typeof p.name === 'string' && typeof p.color === 'string' && (p.icon === undefined || typeof p.icon === 'string')
}

/** Profils de l'appareil, principal en tête. Sans registre : le seul profil principal (comportement d'avant). */
export function listProfiles(): Profile[] {
  let raw: unknown = null
  try { raw = JSON.parse(lsGet(LS_LIST) ?? 'null') } catch { raw = null }
  const list = Array.isArray(raw) ? raw.filter(isProfile) : []
  const main = list.find((p) => p.id === MAIN_PROFILE_ID) ?? defaultMain()
  const seen = new Set([MAIN_PROFILE_ID])
  const others = list.filter((p) => !seen.has(p.id) && (seen.add(p.id), true))
  return [main, ...others]
}

function saveProfiles(list: Profile[]): void { lsSet(LS_LIST, JSON.stringify(list)) }

/** Id du profil enregistré comme actif (repli sur le principal si inconnu). */
export function storedActiveId(): string {
  const id = lsGet(LS_ACTIVE)
  return id && listProfiles().some((p) => p.id === id) ? id : MAIN_PROFILE_ID
}

/** Profil actif pour toute la durée de la page (figé au chargement). */
let active = storedActiveId()
export const activeProfileId = (): string => active
export const activeProfile = (): Profile => listProfiles().find((p) => p.id === active) ?? defaultMain()
export const hasSeveralProfiles = (): boolean => listProfiles().length > 1
/** Tests uniquement : relit le profil actif. */
export function _reloadActiveForTests(): void { active = storedActiveId() }

export const dbNameFor = (id: string): string => id === MAIN_PROFILE_ID ? 'ptcgp' : `ptcgp-p-${id}`
export const syncFileNameFor = (id: string): string => id === MAIN_PROFILE_ID ? 'ptcgp-sync.json' : `ptcgp-sync-${id}.json`
/** Id du profil d'un nom de fichier Drive `ptcgp-sync-<id>.json` (null pour le principal ou un autre nom). */
export function profileIdFromFileName(name: string): string | null {
  const m = /^ptcgp-sync-([a-z0-9]{4,16})\.json$/.exec(name)
  return m ? m[1] : null
}

/** Clé d'état d'appareil propre au profil : `ptcgp.sync.x` → `ptcgp.p.<id>.sync.x` (inchangée pour le principal). */
export function profileDeviceKey(key: string, id = active): string {
  if (id === MAIN_PROFILE_ID || !key.startsWith(DEVICE_PREFIX)) return key
  return `${DEVICE_PREFIX}p.${id}.${key.slice(DEVICE_PREFIX.length)}`
}
/** Nom de préférence propre au profil (pour `usePersisted`/`prefGet`) : inchangé pour le principal. */
export const profilePrefName = (name: string, id = active): string => id === MAIN_PROFILE_ID ? name : `p.${id}.${name}`

const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')
export const cleanName = (s: string): string => s.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)

/** Ajoute un profil (id donné quand il vient de Drive, sinon nouveau). Renvoie le profil créé ou existant. */
export function addProfile(name: string, color: string, id?: string): Profile {
  const list = listProfiles()
  if (id) { const found = list.find((p) => p.id === id); if (found) return found }
  if (list.length >= MAX_PROFILES) throw new Error(`${MAX_PROFILES} profils au plus`)
  const p: Profile = { id: id && ID_RE.test(id) ? id : newId(), name: cleanName(name) || 'Profil', color, createdAt: new Date().toISOString() }
  saveProfiles([...list, p])
  return p
}

export function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'color' | 'icon'>>): void {
  saveProfiles(listProfiles().map((p) => {
    if (p.id !== id) return p
    const next: Profile = { ...p, ...(patch.name !== undefined ? { name: cleanName(patch.name) || p.name } : {}), ...(patch.color ? { color: patch.color } : {}) }
    // icon : '' ou null retire l'icône (retour à l'initiale)
    if (patch.icon !== undefined) { if (patch.icon && ICON_RE.test(patch.icon)) next.icon = patch.icon; else delete next.icon }
    return next
  }))
}

/** Retire un profil du registre et ses clés locales (la base est effacée par l'appelant). Le principal ne se supprime pas. */
export function forgetProfile(id: string): void {
  if (id === MAIN_PROFILE_ID) throw new Error('Le profil principal ne peut pas être supprimé')
  saveProfiles(listProfiles().filter((p) => p.id !== id))
  if (lsGet(LS_ACTIVE) === id) lsRemove(LS_ACTIVE)
  const prefixes = [`${DEVICE_PREFIX}p.${id}.`, `${PREF_PREFIX}p.${id}.`]
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && prefixes.some((x) => k.startsWith(x))) keys.push(k) }
    keys.forEach(lsRemove)
  } catch { /* ignoré */ }
}

/** Enregistre le profil actif ; l'appelant recharge la page pour l'appliquer. */
export function setActiveProfile(id: string): void {
  if (id === MAIN_PROFILE_ID) lsRemove(LS_ACTIVE); else lsSet(LS_ACTIVE, id)
}

/** Initiale affichée dans l'avatar. */
export const initialOf = (name: string): string => (Array.from(name.trim())[0] ?? '?').toUpperCase()
/** Couleur CSS d'un profil (variable du thème). */
export const profileCssColor = (c: string): string => (PROFILE_COLORS as readonly string[]).includes(c) ? `var(--${c})` : 'var(--violet)'
