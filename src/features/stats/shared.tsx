import { useState } from 'react';
import { cardImageUrl } from '../../lib/db';
import type { Card, Rarity } from '../../lib/types';
import { nf } from './charts';

export const rc = (r: Rarity) => `var(--st-r-${r})`;
export const TYPE_COLOR: Record<string, string> = {
  Plante: 'var(--st-t-plante)', Feu: 'var(--st-t-feu)', Eau: 'var(--st-t-eau)', Électrique: 'var(--st-t-elec)', Psy: 'var(--st-t-psy)',
  Combat: 'var(--st-t-combat)', Obscurité: 'var(--st-t-obs)', Métal: 'var(--st-t-metal)', Dragon: 'var(--st-t-dragon)', Incolore: 'var(--st-t-inc)', Dresseur: 'var(--st-t-dresseur)',
};
export const plural = (n: number, one: string, many = one + 's') => `${nf.format(n)} ${n > 1 ? many : one}`;

/** Bouton invisible qui couvre une tuile pour ouvrir son détail. */
export function hit(label: string, onClick: () => void) {
  return <button type="button" className="st-hit" aria-haspopup="dialog" aria-label={`${label} : voir le détail`} onClick={onClick} />;
}

export function Thumb({ card }: { card: Card }) {
  const [broken, setBroken] = useState(false);
  return broken
    ? <span className="st-thumb fb"><b>{card.name}</b><small>{card.id}</small></span>
    : <img className="st-thumb" src={cardImageUrl(card)} alt={card.name} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

/** Ligne qui dit d'où viennent les chiffres de l'onglet. */
export function Source({ children }: { children: React.ReactNode }) {
  return <p className="st-source"><span className="st-source-k">Source</span>{children}</p>;
}
