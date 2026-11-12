import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { CardThumb } from '../../components/CardTile';
import { SetLogo } from '../../components/Brand';
import { RARITY_LABEL } from '../../lib/useData';
import type { OfferEntry } from '../../lib/calc';
import type { Rarity } from '../../lib/types';
import { num } from './format';

export type OfferKind = 'trade' | 'share';

const HINT: Record<OfferKind, string> = {
  trade: "Raretés ◊ : à partir du 3e exemplaire (2e pour les brillantes des boosters de luxe). Raretés ☆ et ✦ : à partir du 2e. Les raretés déjà complètes, ☆☆☆ et ♛ ne sont pas comptées.",
  share: 'Raretés ◊ seulement : à partir du 3e exemplaire (2e pour les brillantes des boosters de luxe).',
};

/** Tuile listant les cartes échangeables ou partageables, groupées par rareté décroissante. */
export function OfferSheet({ kind, list, onClose }: { kind: OfferKind; list: OfferEntry[]; onClose: () => void }) {
  const groups: { rarity: Rarity; items: OfferEntry[] }[] = [];
  for (const e of list) {
    const g = groups[groups.length - 1];
    if (g && g.rarity === e.card.rarity) g.items.push(e);
    else groups.push({ rarity: e.card.rarity, items: [e] });
  }
  const copies = list.reduce((s, e) => s + e.spare, 0);
  return (
    <Sheet title={kind === 'trade' ? 'Cartes échangeables' : 'Cartes partageables'} full onClose={onClose}>
      <p className="bs-hint"><b>{num(list.length)} carte{list.length > 1 ? 's' : ''}</b>, {num(copies)} exemplaire{copies > 1 ? 's' : ''} disponible{copies > 1 ? 's' : ''}. {HINT[kind]}</p>
      {list.length === 0 ? <p className="ptc-empty">Aucune carte pour le moment.</p> : groups.map((g) => (
        <section key={g.rarity} className="of-group">
          <h3>{RARITY_LABEL[g.rarity]}<small>{num(g.items.length)} carte{g.items.length > 1 ? 's' : ''}</small></h3>
          <ul className="bs-cards">
            {g.items.map(({ card, quantity, spare }) => (
              <li key={card.id} className="bs-card">
                <CardThumb card={card} />
                <span className="bs-main">
                  <b className="bs-cn">{card.name}</b>
                  <small className="of-sub"><SetLogo setId={card.setId} small fallback={<span>{card.setId}</span>} /> n° {card.number}{card.finish === 'Brillante' ? ' · brillante' : ''}</small>
                </span>
                <span className="bs-val of-val"><b>×{num(quantity)}</b><small>{num(spare)} dispo</small></span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link className="btn of-go" to={kind === 'trade' ? '/echange-partage?onglet=echange' : '/echange-partage?onglet=partage'}>{kind === 'trade' ? 'Noter un échange' : 'Noter un partage'}</Link>
    </Sheet>
  );
}
