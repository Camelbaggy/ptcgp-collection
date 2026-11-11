// Pure checks used by scripts/pipeline-check.mjs (unit-tested in src/lib/pipelineHealth.test.ts).

/** meta.json older than maxHours (or unreadable) is a silent failure of update-meta.yml. */
export function checkMetaAge(generatedAt, nowMs, maxHours = 24) {
  const t = Date.parse(generatedAt ?? '')
  if (!Number.isFinite(t)) return ['meta.json illisible ou sans date `generatedAt`.']
  const hours = (nowMs - t) / 3600000
  return hours > maxHours ? [`meta.json date de ${Math.round(hours)} h (limite ${maxHours} h) : update-meta ne publie plus.`] : []
}

/** counts = {cards, logos, ...}; expected = same keys; a count below ratio*expected is reported. */
export function checkCounts(counts, expected, ratio = 0.95) {
  const out = []
  for (const [k, exp] of Object.entries(expected)) {
    const n = counts[k] ?? 0
    if (n < exp * ratio) out.push(`${k} : ${n} fichier(s) pour ${exp} attendu(s) (seuil ${Math.floor(exp * ratio)}).`)
  }
  return out
}
