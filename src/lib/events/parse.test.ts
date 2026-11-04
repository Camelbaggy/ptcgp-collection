import { describe, expect, it } from 'vitest'
import { buildEvents, parseDuration, parseEventCards, parseEventList, parseHomeReleases, releaseEvents, type Pages } from './parse'

const raw = import.meta.glob('../../../scripts/fixtures/serebii/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const fx = (n: string) => raw[`../../../scripts/fixtures/serebii/${n}.html`]
const pages: Pages = { events: fx('events'), drop: fx('dropevents'), wonderpick: fx('wonderpickevents'), emblem: fx('emblemevents'), massoutbreak: fx('massoutbreakevents') }
const cutoff = new Date('2026-10-05T00:00:00Z') // today (2026-11-04) - 30 d

describe('parseDuration', () => {
  it('handles shared / explicit years, ordinals and site typos', () => {
    expect(parseDuration('October 15th - October 28th 2026')).toEqual({ start: '2026-10-15T06:00:00.000Z', end: '2026-10-28T06:00:00.000Z' })
    expect(parseDuration('September 5th 2026 - September 12th 2026')?.start).toBe('2026-09-05T06:00:00.000Z')
    expect(parseDuration('March 7h 2026')).toBeNull()
    expect(parseDuration('February 28th 2026 - March 7h 2026')?.end).toBe('2026-03-07T06:00:00.000Z')
    expect(parseDuration('December 28th - January 3rd 2026')).toEqual({ start: '2025-12-28T06:00:00.000Z', end: '2026-01-03T06:00:00.000Z' })
    expect(parseDuration('October 30th 2026 - November 13th 2025')?.end).toBe('2026-11-13T06:00:00.000Z')
    expect(parseDuration('soon')).toBeNull()
  })
})

describe('Serebii fixtures', () => {
  it('parses every row of each list', () => {
    const counts = Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, parseEventList(v).length]))
    expect(counts.events).toBeGreaterThan(100)
    for (const k of ['drop', 'wonderpick', 'emblem', 'massoutbreak']) expect(counts[k]).toBeGreaterThan(3)
    // every row has a parsed date range: row count == number of <tr> rows of the table
    expect(parseEventList(pages.events).length).toBe((pages.events.match(/<tr><td class="cen"/g) ?? []).length)
  })

  it('classifies, filters on the cutoff and gives stable ids', () => {
    const ev = buildEvents(pages, cutoff)
    const by = (t: string) => ev.filter((e) => e.type === t)
    expect(ev.every((e) => Date.parse(e.end) >= cutoff.getTime())).toBe(true)
    expect(new Set(ev.map((e) => e.id)).size).toBe(ev.length)
    const garchomp = ev.find((e) => e.id === 'drop-megagarchompexdropevent')!
    expect(garchomp).toMatchObject({ type: 'drop', name: 'Mega Garchomp ex Drop Event', start: '2026-10-15T06:00:00.000Z', end: '2026-10-25T06:00:00.000Z' })
    expect(garchomp.url).toBe('https://www.serebii.net/tcgpocket/events/megagarchompexdropevent.shtml')
    expect(garchomp.imageSrc).toBe('https://www.serebii.net/tcgpocket/megagarchompexdropevent.jpg')
    expect(by('wonderpick').map((e) => e.name)).toContain('Wonder Pick Event October 2026')
    expect(by('emblem').map((e) => e.name)).toContain('Deluxe Pack Mega Emblem Event')
    expect(by('massoutbreak').map((e) => e.name)).toContain('Parallel Foil Cards Mass Outbreak Event 2026')
    expect(by('special').map((e) => e.name)).toContain('Second Anniversary Celebration Campaign Missions')
    expect(by('special').map((e) => e.name)).not.toContain('Wonder Pick Event October 2026')
    expect(by('drop').map((e) => e.name)).toContain('PROMO Reissue Drop Event 2026')
    // "Team Rocket's" apostrophes survive, ids are filename safe
    expect(ev.every((e) => /^[A-Za-z0-9_-]+$/.test(e.id))).toBe(true)
  })

  it('finds no announced expansion on the home page fixture (manual releases.json is the source)', () => {
    expect(parseHomeReleases(fx('home'), new Date('2026-11-04T00:00:00Z'))).toEqual([])
  })
})

describe('home releases / expansions', () => {
  it('parses a future dated link and ignores past ones', () => {
    const html = '<a href="/tcgpocket/newset/">New Set</a> releases December 16th 2026<br><a href="/tcgpocket/old/">Old</a> released October 1st 2025'
    expect(parseHomeReleases(html, new Date('2026-11-04T00:00:00Z'))).toEqual([{ name: 'New Set', date: '2026-12-16' }])
  })
  it('turns releases into expansion events, dedupes and applies the cutoff', () => {
    const ev = releaseEvents([{ name: 'Prochaine extension', date: '2026-12-16' }, { name: 'X', date: '2026-12-16' }, { name: 'Old', date: '2026-01-01' }, { name: 'S', setId: 'B5', date: '2026-12-16' }], cutoff)
    expect(ev.map((e) => e.id)).toEqual(['expansion-2026-12-16', 'expansion-B5'])
    expect(ev[0]).toMatchObject({ type: 'expansion', start: '2026-12-16T06:00:00.000Z', end: '2026-12-16T06:00:00.000Z' })
  })
})

describe('parseEventCards', () => {
  const sets = [{ id: 'P-A', nameEn: 'Promo-A' }, { id: 'A2', nameEn: 'Space-Time Smackdown' }]
  const ids = new Set(['P-A-12', 'A2-100'])
  it('maps dex links and thumbnails to card ids', () => {
    const html = '<a href="/tcgpocket/dex/promo-a/12.shtml">x</a><img src="/tcgpocket/dex/th/space-timesmackdown/100.jpg"><a href="/tcgpocket/dex/promo-a/99.shtml">unknown</a><a href="/tcgpocket/dex/nothing/1.shtml">'
    expect(parseEventCards(html, sets, ids).sort()).toEqual(['A2-100', 'P-A-12'])
  })
})
