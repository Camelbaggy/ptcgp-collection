import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { inflatePzPayload, parsePzPayload, pzPayloadHtml } from '../importers/pzCollection'
import { PzCancelled, runPzSync, type PzHost, type PzProgress } from './run'

// Pages synthétiques : même structure que Pokémon-Zone, aucun extrait réel.
const FILL = '<p>' + 'texte de remplissage '.repeat(20) + '</p>'
const page = (inner: string, extraHead = '') => `<!doctype html><html><head><title>Profil</title></head><body><main>${extraHead}${inner}${FILL}<script>window.x=1</script></main></body></html>`
const homePage = page('<div class="player-detail-header"><div class="player-detail-header__name">Tester</div><div class="player-detail-header__level">Lv. 12</div></div>')
const plain = (t: string) => page(`<h2>${t}</h2>`)
const card = (n: number, count: number, rar: string) =>
  `<div class="player-expansion-collection-card"><a href="/cards/c1/${n}/x/"><img class="game-card-image__img" src="https://assets/cPK_10_0217${n}0_00_X_${rar}.webp"></a>` +
  `<div class="player-expansion-collection-card__count">${count}</div><div class="player-expansion-collection-card__name-text">Carte ${n}</div><span class="rarity-icon rarity-icon--rarity-${rar}"></span></div>`
const setPage = page(
  `<div class="cards">${card(1, 3, 'C')}${card(2, 1, 'U')}</div><div class="data-infinite-scroller__more"><button>Load More</button></div>` +
  `<script>document.querySelector('.data-infinite-scroller__more button').addEventListener('click',function(){document.querySelector('.cards').insertAdjacentHTML('beforeend',${JSON.stringify(card(3, 0, 'R'))});document.querySelector('.data-infinite-scroller__more').classList.add('d-none')})</script>`,
)
const setsList = page('<a href="/players/123/sets/C1/">C1</a><a href="/players/123/sets/PROMO-A/">P</a><a href="/players/123/sets/C1/">C1 bis</a><a href="/players/999/sets/ZZ/">autre</a>')
const challengePage = '<!doctype html><html><head><title>Just a moment...</title></head><body><div id="challenge-form">vérification</div></body></html>'

const PAGES: Record<string, string> = {
  '/players/123/': homePage,
  '/players/123/stats/': plain('Stats'),
  '/players/123/themed-collections/': plain('Collections'),
  '/players/123/wishlist/': plain('Souhaits'),
  '/players/123/sets/': setsList,
  '/players/123/sets/C1/': setPage,
  '/players/123/sets/PROMO-A/': page('<h2>vide</h2>'),
}

class FakeHost implements PzHost {
  dom: JSDOM | null = null
  visible: boolean[] = []
  statuses: string[] = []
  closed = false
  visited: string[] = []
  private ui: ((a: 'continue' | 'cancel') => void) | null = null
  private challengePaths: Set<string>
  private current = ''
  private pages: Record<string, string>
  private onVisit?: (path: string) => void
  constructor(pages: Record<string, string>, challengePaths: string[] = [], onVisit?: (path: string) => void) {
    this.pages = pages
    this.onVisit = onVisit
    this.challengePaths = new Set(challengePaths)
  }
  private nav(url: string) {
    const path = new URL(url).pathname
    this.visited.push(path)
    this.current = url
    this.dom?.window.close()
    const html = this.challengePaths.has(path) ? challengePage : this.pages[path] ?? '<html><body>404</body></html>'
    this.dom = new JSDOM(html, { url, runScripts: 'dangerously' })
    this.onVisit?.(path)
  }
  async open(url: string) { this.nav(url) }
  async navigate(url: string) { this.nav(url); return true }
  async eval(js: string) {
    if (!this.dom) throw new Error('fermé')
    const v = this.dom.window.eval(js) as unknown
    return v == null ? null : String(v)
  }
  async setVisible(visible: boolean, status?: string) {
    this.visible.push(visible)
    if (status) this.statuses.push(status)
    if (visible && this.challengePaths.size) { // l'utilisateur fait la vérification
      this.challengePaths.clear()
      this.nav(this.current)
    }
  }
  onUi(cb: (a: 'continue' | 'cancel') => void) { this.ui = cb; return () => { this.ui = null } }
  press(a: 'continue' | 'cancel') { this.ui?.(a) }
  async close() { this.closed = true; this.dom?.window.close() }
}

const fast = { poll: 20, readyMax: 5000, setPause: 0, pagePause: 0, detectMax: 4000, userMax: 4000, continueAfter: 150 }
const sleep = () => new Promise<void>((r) => setTimeout(r, 5))

describe('runPzSync', () => {
  it('lit tout : profil, pages de profil et extensions (Load More compris)', async () => {
    const host = new FakeHost(PAGES)
    const progress: PzProgress[] = []
    const json = await runPzSync(host, { player: '123', mode: 'all', knownSets: ['A1'], timing: fast, sleep, onProgress: (p) => progress.push(p) })
    const pages = parsePzPayload(json)!
    expect(pages.map((p) => [p.setSlug, p.rows.length, p.hasMore, p.playerId])).toEqual([['c1', 3, false, '123']])
    expect(pages[0].rows.map((r) => [r.number, r.count])).toEqual([[1, 3], [2, 1], [3, 0]])
    const html = pzPayloadHtml(json)
    expect(Object.keys(html).sort()).toEqual(['home', 'stats', 'themed', 'wishlist'])
    expect(html.home).toContain('Tester')
    expect(html.home).not.toContain('<script')
    expect(host.visited).toEqual(['/players/123/', '/players/123/sets/', '/players/123/', '/players/123/stats/', '/players/123/themed-collections/', '/players/123/wishlist/', '/players/123/sets/C1/', '/players/123/sets/PROMO-A/'])
    // fenêtre visible au départ seulement, cachée dès que le profil est reconnu
    expect(host.visible).toEqual([false])
    expect(host.closed).toBe(true)
    expect(progress.at(-1)).toMatchObject({ phase: 'done' })
    const totals = progress.filter((p) => p.phase === 'run').map((p) => p.done)
    expect(totals).toEqual([...totals].sort((a, b) => a - b))
  }, 20000)

  it('mise à jour rapide : accueil et souhaits seulement', async () => {
    const host = new FakeHost(PAGES)
    const json = await runPzSync(host, { player: '123', mode: 'quick', knownSets: [], timing: fast, sleep })
    expect(parsePzPayload(json)).toEqual([])
    expect(Object.keys(pzPayloadHtml(json)).sort()).toEqual(['home', 'wishlist'])
    expect(host.visited.filter((p) => p.includes('sets'))).toEqual([])
  }, 20000)

  it('remet la fenêtre au premier plan pour une vérification de sécurité, puis la recache', async () => {
    const host = new FakeHost(PAGES, ['/players/123/stats/'])
    const json = await runPzSync(host, { player: '123', mode: 'all', knownSets: [], timing: fast, sleep })
    expect(Object.keys(pzPayloadHtml(json))).toContain('stats')
    expect(host.visible).toEqual([false, true, false])
    expect(host.statuses.some((s) => /vérification/i.test(s))).toBe(true)
  }, 20000)

  it('attend que le profil s\'affiche (vérification au départ), puis démarre seule', async () => {
    const host = new FakeHost(PAGES, ['/players/123/'])
    // la vérification du départ n'est « réglée » que par l'utilisateur : ici, quand il voit la fenêtre
    const json = await runPzSync(host, { player: '123', mode: 'quick', knownSets: [], timing: { ...fast, continueAfter: 60 }, sleep })
    expect(Object.keys(pzPayloadHtml(json))).toContain('home')
  }, 20000)

  it('s\'annule proprement', async () => {
    const host = new FakeHost(PAGES, [], (path) => { if (path === '/players/123/stats/') host.press('cancel') })
    await expect(runPzSync(host, { player: '123', mode: 'all', knownSets: [], timing: fast, sleep })).rejects.toBeInstanceOf(PzCancelled)
    expect(host.closed).toBe(true)
  }, 20000)

  it('échoue clairement si rien n\'est lisible et refuse un identifiant vide', async () => {
    const host = new FakeHost({ '/players/123/': homePage })
    await expect(runPzSync(host, { player: '123', mode: 'quick', knownSets: [], timing: { ...fast, readyMax: 300 }, sleep })).rejects.toThrow()
    await expect(runPzSync(new FakeHost(PAGES), { player: 'x', mode: 'quick', knownSets: [] })).rejects.toThrow(/identifiant/i)
  }, 20000)

  it('le JSON passe aussi compressé comme celui du favori', async () => {
    const json = await runPzSync(new FakeHost(PAGES), { player: '123', mode: 'quick', knownSets: [], timing: fast, sleep })
    const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    const b64 = btoa(String.fromCharCode(...z)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await inflatePzPayload(b64)).toBe(json)
  }, 20000)
})
