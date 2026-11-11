import { PzCancelled, type PzHost } from '../pzSync/run'
import { POLL_JS, PROBE_JS, RESET_JS, readChunkJs } from '../pzSync/extractors'

/**
 * Lecture des pages « Schedule » de Pokémon-Zone (programme en cours et à venir) dans la fenêtre intégrée de l'appli
 * Android (`PzWebView`, la même que la synchro de collection) : deux pages publiques, ouvertes comme le ferait
 * l'utilisateur, à un rythme humain. Le contenu de `<main>` est rendu tel quel (liens en adresses complètes) et
 * interprété par `parsePokemonZoneSchedule`, comme un fichier .html enregistré à la main.
 *
 * Lecture automatique (`silent`) : la fenêtre reste cachée ; une vérification de sécurité arrête tout sans rien montrer.
 */
export const PZ_SCHEDULE_PAGES: [url: string, label: string][] = [
  ['https://www.pokemon-zone.com/schedule/', 'programme'],
  ['https://www.pokemon-zone.com/schedule/upcoming/', 'à venir'],
]

/** Garde `<main>` (sans scripts, styles, svg), liens et images en adresses complètes, dans `window.__holo.out`. */
export const EV_GRAB_JS = String.raw`(function(){try{
var m=document.querySelector("main");if(!m)return JSON.stringify({ok:false,size:0});
var c=m.cloneNode(true);c.querySelectorAll("script,style,svg,noscript,iframe,ins").forEach(function(e){e.remove()});
var a=m.querySelectorAll("a[href]"),b=c.querySelectorAll("a[href]");
for(var i=0;i<a.length&&i<b.length;i++){b[i].setAttribute("href",a[i].href)}
var n=document.querySelectorAll("[data-start]").length;
window.__holo={state:"done",n:n,out:c.outerHTML};
return JSON.stringify({ok:true,size:window.__holo.out.length,n:n})
}catch(e){return JSON.stringify({ok:false,size:0,error:String(e)})}})()`

/** Nombre d'éléments datés de la page (le programme est affiché quand il y en a). */
const DATED_JS = `(function(){return String(document.querySelectorAll("main [data-start]").length)})()`

const TIMING = { poll: 500, readyMax: 45_000, settle: 8_000, pagePause: 1500, userMax: 600_000 }

export interface EventsSyncOptions {
  onProgress?: (label: string) => void
  /** lecture automatique : fenêtre jamais montrée, abandon sur vérification de sécurité */
  silent?: boolean
  timing?: Partial<typeof TIMING>
  sleep?: (ms: number) => Promise<void>
}

/** Renvoie le HTML (`<main>`) de chaque page lue, dans l'ordre de `PZ_SCHEDULE_PAGES`. */
export async function runEventsSync(host: PzHost, o: EventsSyncOptions = {}): Promise<string[]> {
  const T = { ...TIMING, ...o.timing }
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let cancelled = false
  let forced = false
  const off = host.onUi((a) => { if (a === 'cancel') cancelled = true; else forced = true })
  const check = () => { if (cancelled) throw new PzCancelled() }
  const evalJson = async <X,>(js: string): Promise<X | null> => {
    try { return JSON.parse((await host.eval(js)) ?? 'null') as X } catch { return null }
  }
  const ready = async (label: string) => {
    let t0 = Date.now()
    let last = -1
    for (;;) {
      check()
      const p = await evalJson<{ challenge?: boolean; main?: number }>(PROBE_JS)
      if (p?.challenge) {
        if (o.silent) throw new Error('Pokémon-Zone demande une vérification de sécurité.')
        await host.setVisible(true, 'Pokémon-Zone demande une vérification : fais-la ici, la lecture reprendra seule.')
        forced = false
        const t1 = Date.now()
        while (Date.now() - t1 < T.userMax) {
          check()
          const q = await evalJson<{ challenge?: boolean }>(PROBE_JS)
          if (forced || (q && !q.challenge)) break
          await sleep(T.poll * 3)
        }
        await host.setVisible(false, 'Lecture des évènements…', '')
        t0 = Date.now()
        continue
      }
      const main = p?.main ?? 0
      const dated = Number(await host.eval(DATED_JS)) || 0
      if (main > 200 && (dated > 0 || Date.now() - t0 > T.settle)) {
        if (main === last) return
        last = main
      }
      if (Date.now() - t0 > T.readyMax) throw new Error(`La page « ${label} » de Pokémon-Zone ne s'affiche pas.`)
      await sleep(T.poll)
    }
  }
  const grab = async (): Promise<string> => {
    await host.eval(RESET_JS)
    const g = await evalJson<{ ok?: boolean; size?: number }>(EV_GRAB_JS)
    if (!g?.ok) return ''
    const s = await evalJson<{ size?: number }>(POLL_JS)
    const size = s?.size ?? g.size ?? 0
    let out = ''
    while (out.length < size) {
      const part = await host.eval(readChunkJs(out.length, 120_000))
      if (!part) break
      out += part
    }
    return out
  }

  try {
    const out: string[] = []
    for (let i = 0; i < PZ_SCHEDULE_PAGES.length; i++) {
      const [url, label] = PZ_SCHEDULE_PAGES[i]
      check()
      o.onProgress?.(`Évènements : page « ${label} »…`)
      if (i === 0) {
        await host.open(url, 'Lecture des évènements Pokémon-Zone…', o.silent)
        await host.setVisible(false, 'Lecture des évènements…', '')
      } else {
        await sleep(T.pagePause)
        let ok = await host.navigate(url, 45_000)
        if (!ok) { await sleep(1500); ok = await host.navigate(url, 45_000) }
        if (!ok) throw new Error(`La page « ${label} » de Pokémon-Zone n'a pas pu être chargée.`)
      }
      await ready(label)
      out.push(await grab())
    }
    if (!out.some((h) => h.length > 200)) throw new Error('Rien n\'a pu être lu sur Pokémon-Zone.')
    return out
  } finally {
    off()
    try { await host.close() } catch { /* déjà fermée */ }
  }
}
