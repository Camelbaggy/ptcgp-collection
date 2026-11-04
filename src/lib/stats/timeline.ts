import type { Card, HistoryEvent } from '../types';
import { addDays, dayKey, diffDays } from './dates';

export interface TimelinePoint { day: string; owned: number; total: number; pct: number; }

/** Delta de quantité appliqué par un événement (positif = gain). */
export function effects(e: HistoryEvent): [string, number][] {
  switch (e.kind) {
    case 'pack': return e.cardIds.map((id) => [id, 1]);
    case 'share': return [[e.cardId, e.direction === 'received' ? 1 : -1]];
    case 'trade': return [[e.given, -1], [e.received, 1]];
    case 'correction': return e.changes.map((c) => [c.cardId, c.to - c.from]);
  }
}

/**
 * Cartes différentes possédées, jour par jour. On part de l'état ACTUEL et on remonte l'historique
 * (plus fiable qu'un rejeu depuis zéro : l'inventaire initial n'est pas dans l'historique).
 * Renvoie un point par jour de `from` (ou du premier événement) jusqu'à `today`.
 */
export function completionTimeline(
  cards: Card[],
  owned: Map<string, number>,
  history: HistoryEvent[],
  today: string,
  opts: { setId?: string | null; from?: string | null } = {},
): TimelinePoint[] {
  const scoped = opts.setId ? cards.filter((c) => c.setId === opts.setId) : cards;
  const ids = new Set(scoped.map((c) => c.id));
  const total = scoped.length;
  const qty = new Map<string, number>();
  let count = 0;
  for (const c of scoped) { const q = owned.get(c.id) ?? 0; qty.set(c.id, q); if (q > 0) count++; }

  const evs = history.filter((e) => !e.deleted).sort((a, b) => b.date.localeCompare(a.date)); // récents d'abord
  const first = evs.length ? dayKey(evs[evs.length - 1].date) : today;
  const start = opts.from && opts.from > first ? opts.from : first;
  if (start > today) return [];

  const days = diffDays(start, today);
  const out: TimelinePoint[] = new Array(days + 1);
  let i = 0;
  // Jours de today vers start : l'état « fin de journée d » = état courant moins les événements après d.
  for (let k = days; k >= 0; k--) {
    const day = addDays(start, k);
    while (i < evs.length && dayKey(evs[i].date) > day) {
      for (const [id, d] of effects(evs[i])) {
        if (!ids.has(id)) continue;
        const before = qty.get(id) ?? 0, after = before - d;
        qty.set(id, after);
        if (before > 0 && after <= 0) count--; else if (before <= 0 && after > 0) count++;
      }
      i++;
    }
    out[k] = { day, owned: count, total, pct: total ? count / total : 0 };
  }
  return out;
}
