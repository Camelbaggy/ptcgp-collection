import { BASE } from './db'
import { ASSET_BASE } from './native/platform'

/** Mirror of scripts/lib/common.mjs emblemFile (ASCII-only file names). */
export const emblemFile = (boosterId: string) =>
  boosterId.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_') + '.webp'

export const logoUrl = (setId: string) => `${BASE}logos/${encodeURIComponent(setId)}.webp`
export const emblemUrl = (boosterId: string) => `${BASE}emblems/${emblemFile(boosterId)}`
// ?v= : à incrémenter quand les images de booster changent (cache CacheFirst `ptcgp-images` sinon figé). v2 = marges rognées.
export const packUrl = (boosterId: string) => `${ASSET_BASE}packs/${emblemFile(boosterId)}?v=2`
