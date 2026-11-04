import { BASE } from './db'

/** Mirror of scripts/lib/common.mjs emblemFile (ASCII-only file names). */
export const emblemFile = (boosterId: string) =>
  boosterId.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_') + '.webp'

export const logoUrl = (setId: string) => `${BASE}logos/${encodeURIComponent(setId)}.webp`
export const emblemUrl = (boosterId: string) => `${BASE}emblems/${emblemFile(boosterId)}`
export const packUrl = (boosterId: string) => `${BASE}packs/${emblemFile(boosterId)}`
