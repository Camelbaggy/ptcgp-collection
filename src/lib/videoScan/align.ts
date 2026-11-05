/**
 * Alignement ordonné des cartes lues dans la vidéo (tuiles, dans l'ordre d'affichage)
 * avec les cartes de l'extension (ordre des numéros). Le jeu peut omettre quelques cartes
 * de l'écran d'échange : on autorise donc à sauter des cartes (pénalité `skipCard`),
 * et plus rarement des tuiles (`skipTile`).
 * `cost(i, j)` : coût d'associer la tuile i à la carte j (0 = identiques).
 * Retour : pour chaque tuile, l'indice de la carte associée ou -1.
 */
export function alignOrdered(n: number, m: number, cost: (i: number, j: number) => number,
  skipCard = 0.35, skipTile = 1.2): number[] {
  const W = m + 1
  const D = new Float64Array((n + 1) * W)
  const B = new Uint8Array((n + 1) * W) // 1 = associer, 2 = sauter la tuile, 3 = sauter la carte
  for (let j = 1; j <= m; j++) { D[j] = j * skipCard; B[j] = 3 }
  for (let i = 1; i <= n; i++) {
    D[i * W] = i * skipTile; B[i * W] = 2
    for (let j = 1; j <= m; j++) {
      const a = D[(i - 1) * W + j - 1] + cost(i - 1, j - 1)
      const b = D[(i - 1) * W + j] + skipTile
      const c = D[i * W + j - 1] + skipCard
      if (a <= b && a <= c) { D[i * W + j] = a; B[i * W + j] = 1 }
      else if (b <= c) { D[i * W + j] = b; B[i * W + j] = 2 }
      else { D[i * W + j] = c; B[i * W + j] = 3 }
    }
  }
  const out = new Array<number>(n).fill(-1)
  let i = n, j = m
  while (i > 0 || j > 0) {
    const op = B[i * W + j]
    if (op === 1) { out[i - 1] = j - 1; i--; j-- }
    else if (op === 2) i--
    else j--
  }
  return out
}
