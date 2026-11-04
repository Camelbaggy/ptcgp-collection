import type { Card, HistoryEvent } from '../types';
import { dayKey } from './dates';

export interface Scope {
  /** Premier jour inclus (null = tout). */
  from: string | null;
  /** Extension (null = toutes). */
  setId: string | null;
}

export interface Lookups {
  cardById: Map<string, Card>;
  boosterSet: (boosterId: string) => string;
}

/** Une carte appartient-elle à l'extension filtrée ? */
export const inSet = (card: Card | undefined, setId: string | null): boolean => !setId || card?.setId === setId;

/** Événements actifs (non supprimés) dans la période et l'extension. Les corrections ne sont jamais incluses (voir timeline). */
export function scopeEvents(history: HistoryEvent[], scope: Scope, lk: Lookups): HistoryEvent[] {
  return history.filter((e) => {
    if (e.deleted || e.kind === 'correction') return false;
    if (scope.from && dayKey(e.date) < scope.from) return false;
    if (!scope.setId) return true;
    if (e.kind === 'pack') return lk.boosterSet(e.boosterId) === scope.setId;
    if (e.kind === 'share') return inSet(lk.cardById.get(e.cardId), scope.setId);
    return inSet(lk.cardById.get(e.given), scope.setId) || inSet(lk.cardById.get(e.received), scope.setId);
  });
}
