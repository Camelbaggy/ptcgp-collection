/** Utilitaires de dates (chaînes ISO locales « AAAA-MM-JJTHH:mm » de l'historique). Tout en UTC pour éviter les décalages d'heure d'été. */

const DAY_MS = 86_400_000;

export const dayKey = (date: string): string => date.slice(0, 10);

export function dayToMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function msToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const addDays = (day: string, n: number): string => msToDay(dayToMs(day) + n * DAY_MS);
export const diffDays = (a: string, b: string): number => Math.round((dayToMs(b) - dayToMs(a)) / DAY_MS);

/** Lundi de la semaine contenant `day`. */
export function weekStart(day: string): string {
  const dow = (new Date(dayToMs(day)).getUTCDay() + 6) % 7; // lundi = 0
  return addDays(day, -dow);
}

export const monthStart = (day: string): string => day.slice(0, 7) + '-01';

/** Aujourd'hui (jour local) au format AAAA-MM-JJ. */
export function todayKey(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export type Period = '7' | '30' | '90' | 'all';
export const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: '7 j' }, { id: '30', label: '30 j' }, { id: '90', label: '90 j' }, { id: 'all', label: 'Tout' },
];

/** Premier jour inclus de la période (null = sans borne). */
export function periodStart(period: Period, today: string): string | null {
  return period === 'all' ? null : addDays(today, -(Number(period) - 1));
}

export type Bucket = 'day' | 'week' | 'month';
/** Granularité adaptée à la période affichée. */
export function bucketFor(spanDays: number): Bucket {
  return spanDays <= 45 ? 'day' : spanDays <= 200 ? 'week' : 'month';
}
export const bucketStart = (day: string, b: Bucket): string => (b === 'day' ? day : b === 'week' ? weekStart(day) : monthStart(day));

export function nextBucket(start: string, b: Bucket): string {
  if (b === 'day') return addDays(start, 1);
  if (b === 'week') return addDays(start, 7);
  const [y, m] = start.split('-').map(Number);
  return msToDay(Date.UTC(y, m, 1));
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function dayLabel(day: string, withYear = false): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export const monthLabelShort = (day: string): string => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(2, 4)}`;
export function bucketLabel(start: string, b: Bucket): string {
  if (b === 'month') return monthLabelShort(start);
  if (b === 'week') return `sem. du ${dayLabel(start)}`;
  return dayLabel(start);
}
