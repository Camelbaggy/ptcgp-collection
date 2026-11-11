// Decides whether the update-sets (every 3 h) workflow must do its job (used by scripts/release-window.mjs).

export interface ReleaseDate { date: string }

/** True when today (UTC) is within [release date, release date + 3 days] of one release. */
export function inReleaseWindow(releases: ReleaseDate[], now: Date): boolean {
  const day = now.toISOString().slice(0, 10)
  return releases.some((r) => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(r?.date ?? '')) return false
    const start = r.date.slice(0, 10)
    const end = new Date(Date.parse(start + 'T00:00:00Z') + 3 * 86400000).toISOString().slice(0, 10)
    return day >= start && day <= end
  })
}

/** Daily run (06:xx UTC: the 06:15 cron may be delayed), manual dispatch, or release window. */
export const shouldRun = (releases: ReleaseDate[], now: Date, always = false): boolean =>
  always || now.getUTCHours() === 6 || inReleaseWindow(releases, now)
