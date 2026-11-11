import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { PzCancelled, type PzHost } from '../pzSync/run'
import { eventsAutoDue } from './autoSync'
import { mergeImports, parsePokemonZoneSchedule } from './pokemonZone'
import { runEventsSync } from './sync'

// Pages synthétiques : même structure que Pokémon-Zone, aucun extrait réel. Liens relatifs, comme dans la page en direct.
const date = (s: string, e: string) => `<span class="banner-date__dates" data-start="${s}" data-end="${e}"></span>`
const icon = (path: string) => `style="--common-item-preview--image-url: url(https://assets.pokemon-zone.com/game-assets/${path}?width=64);"`
const FILL = '<p>' + 'texte de remplissage '.repeat(20) + '</p>'
const schedule = `<!doctype html><html><head><title>Schedule</title></head><body><main>${FILL}
<div class="schedule-listing__group"><h3 id="November_2026_Missions">Missions</h3>
 <div id="missions_1"><div class="fs-3 font-bold">Test Drop Event Missions</div>${date('2026-11-10T06:00:00+0000', '2026-11-20T06:00:00+0000')}
  <div class="mission-list-card mission-list-card--type-X"><span class="common-item-icon"><a class="common-item-icon__link" href="/sets/b3/packs/pulsing-aura/"></a>
   <span class="common-item-preview" ${icon('UI/Textures/System/Pack/PACK_ICON_BN006_0010_00_000.webp')}></span><span class="common-item-icon__amount"> 1 </span></span>
   <div class="mission-list-card__text">Log in (Day 1)</div><div class="progress-bar__text">0/1</div></div>
  <div class="mission-list-card mission-list-card--type-X"><span class="common-item-icon">
   <span class="common-item-preview" ${icon('Asset3d/Supply/PlayMat/Item/PLAYMAT_1_PIKACHU/Thumbnails/PLAYMAT_1_PIKACHU_PlayMat.webp')}></span><span class="common-item-icon__amount"> 1 </span></span>
   <div class="mission-list-card__text">Win 3 battles</div><div class="progress-bar__text">0/3</div></div>
 </div></div><script>window.x=1</script></main></body></html>`
const upcoming = `<!doctype html><html><head><title>Upcoming</title></head><body><main>${FILL}
<div class="schedule-listing__group"><h3 id="December_2026_Events">Events</h3>
 <div id="picks_1"><div class="fs-3 font-bold">Test Wonder Pick Event</div>${date('2026-12-01T06:00:00+0000', '2026-12-08T06:00:00+0000')}
  <a href="/cards/b3/12/foo/"></a></div></div></main></body></html>`
const challenge = '<!doctype html><html><head><title>Just a moment...</title></head><body><div id="challenge-form">x</div></body></html>'

class FakeHost implements PzHost {
  dom: JSDOM | null = null
  visible: boolean[] = []
  opened: { url: string; hidden?: boolean }[] = []
  closed = false
  private ui: ((a: 'continue' | 'cancel') => void) | null = null
  private pages: Record<string, string>
  private challenged: Set<string>
  private current = ''
  constructor(pages: Record<string, string>, challenged: string[] = []) { this.pages = pages; this.challenged = new Set(challenged) }
  private nav(url: string) {
    const path = new URL(url).pathname
    this.current = url
    this.dom?.window.close()
    this.dom = new JSDOM(this.challenged.has(path) ? challenge : this.pages[path] ?? '<html><body>404</body></html>', { url, runScripts: 'outside-only' })
  }
  async open(url: string, _s: string, hidden?: boolean) { this.opened.push({ url, hidden }); this.nav(url) }
  async navigate(url: string) { this.nav(url); return true }
  async eval(js: string) { const v = this.dom!.window.eval(js) as unknown; return v == null ? null : String(v) }
  async setVisible(v: boolean) {
    this.visible.push(v)
    if (v && this.challenged.size) { this.challenged.clear(); this.nav(this.current) }
  }
  onUi(cb: (a: 'continue' | 'cancel') => void) { this.ui = cb; return () => { this.ui = null } }
  press(a: 'continue' | 'cancel') { this.ui?.(a) }
  async close() { this.closed = true }
}
const PAGES = { '/schedule/': schedule, '/schedule/upcoming/': upcoming }
const fast = { poll: 10, readyMax: 3000, settle: 200, pagePause: 0, userMax: 3000 }
const sleep = () => new Promise<void>((r) => setTimeout(r, 2))

describe('synchro des évènements Pokémon-Zone', () => {
  it('lit les deux pages, liens en adresses complètes, et les interprète comme un fichier enregistré', async () => {
    const host = new FakeHost(PAGES)
    const pages = await runEventsSync(host, { silent: true, timing: fast, sleep })
    expect(host.opened).toEqual([{ url: 'https://www.pokemon-zone.com/schedule/', hidden: true }])
    expect(host.closed).toBe(true)
    expect(pages).toHaveLength(2)
    expect(pages[0]).not.toContain('<script')
    const ev = mergeImports(pages.map((h) => parsePokemonZoneSchedule(h, { cardIds: new Set(['B3-12']), setIds: ['B3'] })))
    expect(ev.map((e) => e.name)).toEqual(['Test Drop Event Missions', 'Test Wonder Pick Event'])
    expect(ev[0].missions?.[0].reward).toMatchObject({ item: 'PACK_ICON_BN006_0010_00_000', link: '/sets/b3/packs/pulsing-aura/' })
    expect(ev[0].missions?.[1].reward?.src).toBe('Asset3d/Supply/PlayMat/Item/PLAYMAT_1_PIKACHU/Thumbnails/PLAYMAT_1_PIKACHU_PlayMat.webp')
    expect(ev[1].cardIds).toEqual(['B3-12'])
  }, 15000)
  it('lecture automatique : abandon discret sur vérification de sécurité', async () => {
    const host = new FakeHost(PAGES, ['/schedule/'])
    await expect(runEventsSync(host, { silent: true, timing: fast, sleep })).rejects.toThrow(/vérification/)
    expect(host.visible).not.toContain(true)
    expect(host.closed).toBe(true)
  }, 15000)
  it('à la demande : montre la fenêtre pour la vérification, puis continue', async () => {
    const host = new FakeHost(PAGES, ['/schedule/upcoming/'])
    const pages = await runEventsSync(host, { timing: fast, sleep })
    expect(pages[1]).toContain('Test Wonder Pick Event')
    expect(host.visible).toEqual([false, true, false])
  }, 15000)
  it('s\'annule', async () => {
    const host = new FakeHost(PAGES)
    const p = runEventsSync(host, { timing: fast, sleep: async () => { host.press('cancel'); await sleep() } })
    await expect(p).rejects.toBeInstanceOf(PzCancelled)
  }, 15000)
  it('au plus une fois par heure, un essai toutes les 30 min', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    const H = 3600_000
    expect(eventsAutoDue(undefined, 0, now)).toBe(true)
    expect(eventsAutoDue(new Date(now - 0.5 * H).toISOString(), 0, now)).toBe(false)
    expect(eventsAutoDue(new Date(now - 2 * H).toISOString(), now - 0.2 * H, now)).toBe(false)
    expect(eventsAutoDue(new Date(now - 2 * H).toISOString(), now - 0.6 * H, now)).toBe(true)
  })
})
