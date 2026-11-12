// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PM_CORE, PM_GRAB_JS, PM_PROBE_JS } from './extract'
import { parsePmRaw } from './parse'
import { runPmSync } from './sync'
import type { PzHost } from '../pzSync/run'
import type { PmRaw } from './types'

/** Copie simplifiée de la structure de la page (aucun contenu PocketMads réel). */
const deckHtml = (id: string, name: string, score: string, delta: string, shift = false) => `
<div class="block rounded-2xl"><a href="https://app.pocketmads.com/meta-game/${id}?range=7d" class="block">
<div><span class="archetype-sprites"></span></div>
<div class="mt-3"><h3 title="${name}">${name}</h3>
<div class="mt-2 flex"><span>24h</span><span title="Score change over about 24 hours"><span aria-hidden="true">${delta[0]}</span>${delta.slice(1)}</span>${shift ? '<span>Tier shift</span>' : ''}</div>
<div class="mt-2 grid grid-cols-4"><div><div>Score</div><div>${score}</div></div><div><div>Win rate</div><div>55.0%</div></div><div><div>Games</div><div>1 204</div></div><div><div>Metashare</div><div>2.5%</div></div></div>
</div></a><button type="button">View 7-day trend →</button></div>`
const section = (label: string, sub: string, count: number, open: boolean, body: string) => `
<section><button type="button" aria-expanded="${open}"><img alt="${label} ribbon"><span class="flex-1"><span class="block font-bold">${label}</span><span class="block text-sm">${sub}</span></span><span class="rounded-full">${count}</span></button>${open ? `<div class="p-4"><div class="grid">${body}</div></div>` : ''}</section>`

function page() {
  document.body.innerHTML = `<main><h1>Competitive Deck Tier List</h1><span>Updated 10 nov. 2026, 18:00</span>
${section('Tier 0', 'Format-defining', 0, false, '')}
${section('Tier 1', 'Top contenders', 1, true, deckHtml('magnezone-b1a-miraidon-ex-b3a', 'Magnezone Miraidon ex', '71.7', '▼-0.2'))}
${section('Tier 3', 'Established decks', 1, false, '')}
${section('Sleepers', 'Promising, lower-play decks', 1, false, '')}</main>`
  // comme la page : ouvrir un tier affiche ses decks
  const later: Record<string, string> = {
    'Tier 3': deckHtml('giratina-ex-a2b-dragonair-a1', 'Giratina ex Dragonair', '34.3', '▼1.5'),
    Sleepers: deckHtml('pawmot-a2-raikou-ex-b3', 'Pawmot Raikou ex', '69.9', '▲+38.9', true),
  }
  document.querySelectorAll('section > button').forEach((b) => b.addEventListener('click', () => {
    const label = b.querySelector('.font-bold')!.textContent!
    b.setAttribute('aria-expanded', 'true')
    setTimeout(() => b.insertAdjacentHTML('afterend', `<div class="p-4"><div class="grid">${later[label] ?? ''}</div></div>`), 50)
  }))
}

describe('PocketMads : lecture de la page', () => {
  it('ouvre les tiers repliés puis relève les decks', async () => {
    page()
    const raw = await new Function(`${PM_CORE}; return pmExpand(document).then(function(){return pmRead(document)})`)() as PmRaw
    expect(raw.tiers.map((t) => [t.label, t.decks.length])).toEqual([['Tier 0', 0], ['Tier 1', 1], ['Tier 3', 1], ['Sleepers', 1]])
    expect(raw.updated).toBe('10 nov. 2026, 18:00')
    const t = parsePmRaw(raw, '2026-11-10T19:00:00Z')
    expect(t.range).toBe('7d')
    expect(t.tiers.map((x) => x.key)).toEqual(['0', '1', '3', 'S'])
    expect(t.tiers[1].decks[0]).toEqual({ name: 'Magnezone Miraidon ex', id: 'magnezone-b1a-miraidon-ex-b3a', score: 71.7, winRate: 0.55, games: 1204, share: 0.025, delta: -0.2, shift: false })
    expect(t.tiers[2].decks[0].delta).toBe(-1.5) // ▼ sans signe
    expect(t.tiers[3].decks[0]).toMatchObject({ delta: 38.9, shift: true })
  }, 15_000)

  it('refuse une page sans deck', () => {
    expect(() => parsePmRaw({ v: 1, tiers: [{ label: 'Tier 1', decks: [] }] })).toThrow(/Aucun deck/)
  })

  it('synchro par la fenêtre intégrée (hôte simulé)', async () => {
    page()
    const calls: string[] = []
    const host: PzHost = {
      open: async (url) => { calls.push('open ' + url) },
      navigate: async () => true,
      eval: async (js) => {
        if (js === PM_PROBE_JS || js === PM_GRAB_JS) calls.push(js === PM_PROBE_JS ? 'probe' : 'grab')
        // oxlint-disable-next-line no-eval -- exécute le script de lecture sur une page de test
        return String((0, eval)(js))
      },
      setVisible: async () => {},
      onUi: () => () => {},
      close: async () => { calls.push('close') },
    }
    const t = await runPmSync(host, { timing: { poll: 50 } })
    expect(t.tiers.flatMap((x) => x.decks.map((d) => d.name))).toEqual(['Magnezone Miraidon ex', 'Giratina ex Dragonair', 'Pawmot Raikou ex'])
    expect(calls[0]).toBe('open https://app.pocketmads.com/tier-list')
    expect(calls.at(-1)).toBe('close')
  }, 15_000)
})
