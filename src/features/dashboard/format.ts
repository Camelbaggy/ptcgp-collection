export const pct = (x: number, digits = 1): string =>
  `${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

export const packsLabel = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 1 : 0 }) : '∞';

export const num = (n: number): string => n.toLocaleString('fr-FR');

export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-');
  return `${MONTHS_FR[Number(m) - 1] ?? m} ${y.slice(2)}`;
};

export const dateFr = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
