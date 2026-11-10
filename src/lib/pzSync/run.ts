import { parsePzHome } from '../pzProfile/parse'
import { GRAB_MAIN_JS, GRAB_SET_JS, POLL_JS, PROBE_JS, RESET_JS, readChunkJs, setCodesJs } from './extractors'

/**
 * Synchro Pokémon-Zone depuis l'appli Android : la fenêtre intégrée (un vrai navigateur, celui du
 * téléphone) ouvre le profil de l'utilisateur ; il règle à la main une éventuelle vérification de
 * sécurité ou connexion, puis la fenêtre se cache et l'appli ne montre qu'une barre de progression.
 * Pages lues : celles des profils Pokémon-Zone (accueil, stats, collections à thème, souhaits et
 * extensions), une à la fois, à un rythme humain. Résultat : le même JSON v3 que le favori.
 *
 * Tout passe par `PzHost`, pour tester sans téléphone.
 */
export interface PzHost {
  open(url: string, status: string): Promise<void>
  navigate(url: string, timeoutMs?: number): Promise<boolean>
  /** Évalue un script de `extractors.ts` dans la page affichée (null si rien). */
  eval(js: string): Promise<string | null>
  setVisible(visible: boolean, status?: string, button?: string): Promise<void>
  /** Appuis sur les boutons de la fenêtre (« Continuer », « Annuler »). */
  onUi(cb: (action: 'continue' | 'cancel') => void): () => void
  close(): Promise<void>
}

export type PzSyncMode = 'all' | 'quick'
export interface PzProgress { phase: 'check' | 'run' | 'done'; label: string; done: number; total: number }

export class PzCancelled extends Error {
  constructor() { super('Synchronisation annulée.') }
}

export interface PzSyncOptions {
  /** identifiant du profil (nombres) */
  player: string
  mode: PzSyncMode
  /** codes d'extension connus (repli si la liste du profil est illisible) */
  knownSets: string[]
  onProgress?: (p: PzProgress) => void
  /** durées en ms ; réduites dans les tests */
  timing?: Partial<typeof TIMING>
  sleep?: (ms: number) => Promise<void>
}

const TIMING = { poll: 1500, detectMax: 600_000, readyMax: 45_000, setMax: 240_000, setPause: 1500, pagePause: 1200, userMax: 600_000, continueAfter: 20_000 }

const SUBS: Record<PzSyncMode, [string, string, string][]> = {
  all: [['home', '', 'accueil'], ['stats', 'stats/', 'statistiques'], ['themed', 'themed-collections/', 'collections à thème'], ['wishlist', 'wishlist/', 'souhaits']],
  quick: [['home', '', 'accueil'], ['wishlist', 'wishlist/', 'souhaits']],
}

interface Probe { host?: string; challenge?: boolean; main?: number; cards?: number; more?: boolean; error?: string }

export async function runPzSync(host: PzHost, o: PzSyncOptions): Promise<string> {
  const T = { ...TIMING, ...o.timing }
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const player = o.player.replace(/[^0-9]/g, '')
  if (!player) throw new Error('Identifiant de profil Pokémon-Zone inconnu.')
  const base = `https://www.pokemon-zone.com/players/${player}/`

  let cancelled = false
  let forced = false
  const off = host.onUi((a) => { if (a === 'cancel') cancelled = true; else forced = true })
  const check = () => { if (cancelled) throw new PzCancelled() }
  const progress = (phase: PzProgress['phase'], label: string, done = 0, total = 0) => o.onProgress?.({ phase, label, done, total })

  const probe = async (): Promise<Probe> => {
    try { return JSON.parse((await host.eval(PROBE_JS)) ?? '{}') as Probe } catch { return {} }
  }
  /** Montre la fenêtre tant que `ok()` est faux (vérification, connexion), puis la recache. */
  const askUser = async (status: string, ok: () => Promise<boolean>, button?: string) => {
    await host.setVisible(true, status, button)
    forced = false
    const t0 = Date.now()
    while (Date.now() - t0 < T.userMax) {
      check()
      if (forced || await ok()) { await host.setVisible(false, 'Synchronisation en cours…'); return }
      await sleep(T.poll)
    }
    throw new Error('Délai dépassé : la page Pokémon-Zone ne s\'affiche pas.')
  }
  /** Attend le contenu de la page ; la fenêtre revient au premier plan si une vérification s'affiche. */
  const ready = async (what: string, wantCards = false) => {
    let t0 = Date.now()
    let last = -1
    let stable = 0
    for (;;) {
      check()
      const p = await probe()
      if (p.challenge) {
        await askUser('Pokémon-Zone demande une vérification : fais-la ici, la synchro reprendra seule.', async () => !(await probe()).challenge)
        t0 = Date.now()
        continue
      }
      const main = p.main ?? 0
      if (main > 200 && (!wantCards || (p.cards ?? 0) > 0 || Date.now() - t0 > 8000)) {
        stable = main === last ? stable + 1 : 0
        if (stable >= 1) return p
      }
      last = main
      if (Date.now() - t0 > T.readyMax) throw new Error(`La page « ${what} » ne s'affiche pas.`)
      await sleep(500)
    }
  }
  const load = async (path: string, what: string, wantCards = false) => {
    const url = base + path
    let ok = await host.navigate(url, 45_000)
    if (!ok) { await sleep(1500); ok = await host.navigate(url, 45_000) }
    if (!ok) throw new Error(`La page « ${what} » n'a pas pu être chargée.`)
    return ready(what, wantCards)
  }
  const readOut = async (size: number): Promise<string> => {
    let out = ''
    while (out.length < size) {
      const part = await host.eval(readChunkJs(out.length, 120_000))
      if (!part) break
      out += part
    }
    return out
  }

  try {
    // 1. contrôle visible : profil affiché, pas de vérification de sécurité
    progress('check', 'Ouverture de Pokémon-Zone…')
    await host.open(base, 'Vérifie que ton profil s\'affiche. La synchro démarre toute seule.')
    const t0 = Date.now()
    let button: string | undefined
    for (;;) {
      check()
      const p = await probe()
      if (!p.challenge && (p.main ?? 0) > 200) {
        const grabbed = JSON.parse((await host.eval(GRAB_MAIN_JS)) ?? '{}') as { ok?: boolean; size?: number }
        const html = grabbed.ok ? await readOut(grabbed.size ?? 0) : ''
        if (html && parsePzHome(html).name) break
        if (forced) break
      } else if (forced) break
      if (!button && Date.now() - t0 > T.continueAfter) {
        button = 'Continuer'
        await host.setVisible(true, 'Profil non reconnu. Connecte-toi si besoin, puis touche Continuer.', button)
      }
      if (Date.now() - t0 > T.detectMax) throw new Error('Le profil Pokémon-Zone ne s\'affiche pas.')
      await sleep(T.poll)
    }
    await host.setVisible(false, 'Synchronisation en cours…', '')

    // 2. liste des pages à lire
    const subs = SUBS[o.mode]
    let codes: string[] = []
    if (o.mode === 'all') {
      progress('run', 'Liste des extensions…')
      await load('sets/', 'extensions')
      try { codes = (JSON.parse((await host.eval(setCodesJs(player))) ?? '[]') as string[]).filter((c) => /^[A-Za-z0-9-]+$/.test(c)) } catch { codes = [] }
      if (!codes.length) codes = o.knownSets
    }
    const total = subs.length + codes.length
    let done = 0
    const html: Record<string, string> = {}
    const pages: { set: string; more: boolean; rows: unknown[] }[] = []

    // 3. accueil, stats, collections à thème, souhaits
    for (const [kind, path, label] of subs) {
      check()
      progress('run', label[0].toUpperCase() + label.slice(1), done, total)
      await load(path, label)
      await host.eval(RESET_JS)
      const g = JSON.parse((await host.eval(GRAB_MAIN_JS)) ?? '{}') as { ok?: boolean; size?: number }
      if (g.ok) html[kind] = await readOut(g.size ?? 0)
      done++
      await sleep(T.pagePause)
    }

    // 4. extensions, une par une
    for (const code of codes) {
      check()
      progress('run', `Extension ${code}`, done, total)
      try {
        await load(`sets/${code}/`, `extension ${code}`, true)
        await host.eval(GRAB_SET_JS)
        const t1 = Date.now()
        for (;;) {
          check()
          const s = JSON.parse((await host.eval(POLL_JS)) ?? '{}') as { state?: string; n?: number; size?: number; more?: boolean }
          if (s.state === 'done') {
            const rows = JSON.parse(await readOut(s.size ?? 0) || '[]') as unknown[]
            if (rows.length) pages.push({ set: code, more: !!s.more, rows })
            break
          }
          if (s.state === 'error' || Date.now() - t1 > T.setMax) break
          progress('run', `Extension ${code} · ${s.n ?? 0} cartes`, done, total)
          await sleep(500)
        }
      } catch (e) {
        if (e instanceof PzCancelled) throw e
        // une extension illisible n'arrête pas les autres
      }
      done++
      await sleep(T.setPause)
    }

    if (!pages.length && !Object.keys(html).length) throw new Error('Rien n\'a pu être lu sur Pokémon-Zone.')
    progress('done', 'Terminé', total, total)
    return JSON.stringify({ v: 3, player, pages, html })
  } finally {
    off()
    try { await host.close() } catch { /* fenêtre déjà fermée */ }
  }
}
