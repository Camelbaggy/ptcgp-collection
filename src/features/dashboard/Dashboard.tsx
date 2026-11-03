import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  RARITY_LABEL, collectionTotals, packEvents, rankBoostersForWishlist,
  shareableDuplicates, targetCardOptions, tradeableDuplicates,
} from '../../lib/calc';
import { useCalcData } from './useCalcData';
import { dateFr, num, packsLabel, pct } from './format';
import './dash.css';

export default function Dashboard() {
  const d = useCalcData();

  const view = useMemo(() => {
    if (d.loading) return null;
    const totals = collectionTotals(d.cards, d.owned);
    const topNew = [...d.analyses].sort((a, b) => b.legacyNew - a.legacyNew).filter((a) => a.legacyNew > 0).slice(0, 3);
    const wishIds = new Set(d.wishlist.map((w) => w.cardId));
    const topWish = rankBoostersForWishlist(d.boosters.map((b) => b.id), d.cards, d.rates, d.owned, wishIds).slice(0, 3);
    const targets = [...d.wishlist]
      .sort((a, b) => a.priority - b.priority)
      .map((w) => d.cardById.get(w.cardId))
      .filter((c): c is NonNullable<typeof c> => !!c && (d.owned.get(c.id) ?? 0) === 0)
      .slice(0, 6)
      .map((card) => ({ card, best: targetCardOptions(card, d.cards, d.rates)[0] }));
    const trade = tradeableDuplicates(d.cards, d.owned);
    const share = shareableDuplicates(d.cards, d.owned);
    const packs = packEvents(d.history).length;
    const recent = [...d.history].reverse().slice(0, 8);
    return { totals, topNew, topWish, targets, trade, share, packs, recent };
  }, [d]);

  const bName = (id: string) => d.boosterById.get(id)?.name ?? id;
  const cName = (id: string) => d.cardById.get(id)?.name ?? id;

  if (!view) return <main className="ptc-page"><h1>Accueil</h1><p>Chargement…</p></main>;
  const { totals, topNew, topWish, targets, trade, share, packs, recent } = view;

  return (
    <main className="ptc-page">
      <h1>Accueil</h1>

      <section className="ptc-tiles" aria-label="Chiffres clés">
        <div className="ptc-tile"><b>{pct(totals.pct)}</b><span>Complétion (1ères)</span></div>
        <div className="ptc-tile"><b>{num(totals.owned)} / {num(totals.total)}</b><span>Cartes différentes</span></div>
        <div className="ptc-tile"><b>{pct(totals.pct2)}</b><span>Avec 2e copie</span></div>
        <div className="ptc-tile"><b>{num(packs)}</b><span>Packs enregistrés</span></div>
      </section>

      <h2>Meilleurs boosters à ouvrir</h2>
      {topNew.length === 0 ? <p className="ptc-empty">Aucun booster avec des cartes manquantes (ou taux non saisis).</p> : (
        <ul className="ptc-list">
          {topNew.map((a) => (
            <li key={a.boosterId} className="ptc-row">
              <div className="main">{bName(a.boosterId)}<small>{pct(a.completion)} complété · {a.total - a.owned} manquantes</small></div>
              <div className="val">{pct(a.legacyNew, 2)}<small>≈ {packsLabel(1 / a.legacyNew)} packs / nouvelle</small></div>
            </li>
          ))}
        </ul>
      )}

      <h2>Meilleurs boosters pour mes cartes visées</h2>
      {topWish.length === 0 ? <p className="ptc-empty">Aucune carte visée manquante.</p> : (
        <ul className="ptc-list">
          {topWish.map((s) => (
            <li key={s.boosterId} className="ptc-row">
              <div className="main">{bName(s.boosterId)}<small>{s.targets} carte{s.targets > 1 ? 's' : ''} visée{s.targets > 1 ? 's' : ''}</small></div>
              <div className="val">{pct(s.p)}<small>≈ {packsLabel(s.packs)} packs</small></div>
            </li>
          ))}
        </ul>
      )}

      <h2>Cartes visées</h2>
      {targets.length === 0 ? <p className="ptc-empty">Rien à viser. Ajoute des cartes à la liste de souhaits.</p> : (
        <ul className="ptc-list">
          {targets.map(({ card, best }) => (
            <li key={card.id} className="ptc-row">
              <div className="main">{card.name} <span aria-hidden>{RARITY_LABEL[card.rarity]}</span><small>{card.id}{best ? ` · mieux dans ${bName(best.boosterId)}` : ' · non disponible en booster'}</small></div>
              <div className="val">{best ? pct(best.p, 2) : '—'}<small>{best ? `≈ ${packsLabel(best.packs)} packs` : ''}</small></div>
            </li>
          ))}
        </ul>
      )}

      <h2>Doubles</h2>
      <div className="ptc-links">
        <Link className="ptc-link" to="/echange"><b>{num(trade.length)}</b><span>cartes échangeables</span></Link>
        <Link className="ptc-link" to="/partage"><b>{num(share.length)}</b><span>cartes partageables</span></Link>
      </div>

      <h2>Activité récente</h2>
      {recent.length === 0 ? <p className="ptc-empty">Aucune activité.</p> : (
        <ul className="ptc-list">
          {recent.map((e) => (
            <li key={e.id} className="ptc-row">
              <div className="main">
                {e.kind === 'pack' && <>Pack {bName(e.boosterId)}<small>{e.cardIds.length} cartes</small></>}
                {e.kind === 'share' && <>{e.direction === 'given' ? 'Donné' : 'Reçu'} : {cName(e.cardId)}<small>Partage{e.friend ? ` · ${e.friend}` : ''}</small></>}
                {e.kind === 'trade' && <>{cName(e.given)} → {cName(e.received)}<small>Échange{e.friend ? ` · ${e.friend}` : ''}</small></>}
              </div>
              <div className="val">{dateFr(e.date)}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
