/** Téléchargement des images pour le hors-ligne : parties pures + glue Cache Storage. */

/** Nom du cache Workbox runtime (doit correspondre à vite.config.ts). */
export const IMAGE_CACHE = 'ptcgp-images'

export interface Progress { done: number; total: number; bytes: number; failed: number }

export const progressPercent = (p: Pick<Progress, 'done' | 'total'>) =>
  p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} Ko`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
  return `${(n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} Go`
}

/** Exécute `worker` sur chaque élément avec au plus `limit` tâches simultanées. */
export async function runQueue<T>(
  items: T[], limit: number, worker: (item: T) => Promise<void>, signal?: { aborted: boolean },
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (!signal?.aborted) {
      const i = next++
      if (i >= items.length) return
      await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane))
}

export const cacheSupported = () => typeof caches !== 'undefined'

export async function countCached(): Promise<number> {
  if (!cacheSupported()) return 0
  try { return (await (await caches.open(IMAGE_CACHE)).keys()).length } catch { return 0 }
}

/** Télécharge les URLs manquantes dans le cache ; renvoie la progression via onProgress. */
export async function downloadAll(
  urls: string[], onProgress: (p: Progress) => void, signal: { aborted: boolean }, concurrency = 6,
): Promise<Progress> {
  const cache = await caches.open(IMAGE_CACHE)
  const p: Progress = { done: 0, total: urls.length, bytes: 0, failed: 0 }
  await runQueue(urls, concurrency, async (url) => {
    try {
      if (!(await cache.match(url))) {
        const res = await fetch(url)
        if (res.ok) {
          const copy = res.clone()
          await cache.put(url, res)
          p.bytes += Number(copy.headers.get('content-length')) || (await copy.blob()).size
        } else p.failed++
      }
    } catch { p.failed++ }
    p.done++
    onProgress({ ...p })
  }, signal)
  return p
}
