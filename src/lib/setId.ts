/** Set id from a card or booster id when the row is not at hand: "A1-12" → "A1", "A4-Ho-Oh" → "A4",
 *  "P-B-Promo" / "P-B-12" → "P-B" (promo set ids contain a dash), "SP1-Unique" → "SP1". */
export const setIdOf = (id: string): string => /^(P-[A-Za-z]+|[^-]+)/.exec(id)?.[1] ?? id
