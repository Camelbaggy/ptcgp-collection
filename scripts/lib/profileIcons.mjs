// Icônes de profil du jeu : logique pure de scripts/fetch-profile-icons.mjs et check-profile-icons.mjs
// (testée dans src/lib/profileIcons/serebii.test.ts). Source : Serebii (page « Profile Icons », robots.txt l'autorise),
// qui ne liste que les icônes récentes : la liste déjà publiée est donc gardée et complétée, jamais remplacée.
// Les noms restent en anglais ici ; l'appli les traduit (src/lib/profileIcons/catalog.ts).

const unent = (s) => s.replace(/&amp;/g, '&').replace(/&eacute;/g, 'é').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, '').trim()

/** Identifiant stable d'une icône Serebii : nom de fichier en minuscules sans ponctuation, préfixé `s-`. */
export function serebiiIconId(file) {
  let f = file
  try { f = decodeURIComponent(file) } catch { /* nom brut */ }
  const slug = f.replace(/\.png$/i, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
  return slug ? `s-${slug}` : null
}

/** Page Serebii → [{id, nameEn, method, src}] dans l'ordre de la page (les plus récentes d'abord). */
export function parseSerebiiIcons(html, pageUrl) {
  const out = []
  const seen = new Set()
  // Lignes de 4 : noms, images, puis « Method » ; images et méthodes sont dans le même ordre.
  const imgs = [...html.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]*\/tcgpocket\/icon\/([^"/]+?\.png))"|'([^']*\/tcgpocket\/icon\/([^'/]+?\.png))')[^>]*>/gi)]
    .map((m) => Object.assign([m[0], m[1] ?? m[3], m[2] ?? m[4]], { index: m.index }))
  const methods = [...html.matchAll(/<b>\s*Method\s*<\/b>\s*<br\s*\/?>([\s\S]*?)<\/td>/gi)].map((m) => unent(m[1]))
  imgs.forEach((m, i) => {
    const id = serebiiIconId(m[2])
    if (!id || seen.has(id)) return
    seen.add(id)
    const alt = /\balt=(?:"([^"]*)"|'([^']*)')/i.exec(m[0])?.slice(1).find((x) => x != null)
    out.push({ id, nameEn: unent(alt ?? m[2].replace(/\.png$/i, '')), method: methods.length === imgs.length ? methods[i] : '', src: new URL(m[1], pageUrl).href })
  })
  return out
}

/**
 * Fusionne la liste déjà publiée avec ce que montre la page : les icônes connues sont gardées (Serebii retire les
 * anciennes de sa page), les nouvelles arrivent en tête avec la date du jour. Renvoie aussi les ids nouveaux.
 */
export function mergeIconLists(prev, fresh, today) {
  const known = new Map((prev ?? []).map((i) => [i.id, i]))
  const added = []
  const freshIcons = fresh.map((f) => {
    const old = known.get(f.id)
    if (!old) added.push(f.id)
    return { ...old, ...f, added: old?.added ?? today }
  })
  const freshIds = new Set(fresh.map((f) => f.id))
  const all = [...freshIcons, ...(prev ?? []).filter((i) => !freshIds.has(i.id))]
  const order = new Map(all.map((i, n) => [i.id, n]))
  all.sort((a, b) => (b.added ?? '').localeCompare(a.added ?? '') || order.get(a.id) - order.get(b.id))
  return { icons: all, added }
}
