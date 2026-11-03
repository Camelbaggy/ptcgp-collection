import { useMemo, useState } from 'react';
import {
  RARITY_LABEL, collectionTotals, completionByRarity, completionBySet, luckStats, packEvents,
  packsPerMonth, packsPerSet, tradeableDuplicates, shareableDuplicates,
} from '../../lib/calc';
import { useCalcData } from '../dashboard/useCalcData';
import { num, packsLabel, pct } from '../dashboard/format';
import '../dashboard/dash.css';
import { Columns, HBars, RatioBars } from './charts';

export default function Stats() {
  const d = useCalcData();
  const [showAll, setShowAll] = useState(false);

  const v = useMemo(() => {
    if (d.loading) return null;
    const totals = collectionTotals(d.cards, d.owned);
    const bySet = completionBySet(d.cards, d.owned);
    const byRarity = completionByRarity(d.cards, d.owned);
    const months = packsPerMonth(d.history);
    const boosterSet = (id: string) => d.boosterById.get(id)?.setId ?? id.split('-')[0];
    const perSet = packsPerSet(d.history, boosterSet);
    const luck = luckStats(d.history, d.cards, d.rates);
    return {
      totals, bySet, byRarity, months, perSet, luck,
      nPacks: packEvents(d.history).length,
      trade: tradeableDuplicates(d.cards, d.owned).length,
      share: shareableDuplicates(d.cards, d.owned).length,
    };
  }, [d]);

  if (!v) return <main className="ptc-page"><h1>Statistiques</h1><p>Chargement…</p></main>;

  const setName = (id: string) => d.sets.find((s) => s.id === id)?.name ?? id;
  const setIds = d.sets.map((s) => s.id).filter((id) => v.bySet[id]);
  const rarities = Object.entries(v.byRarity) as [keyof typeof RARITY_LABEL, NonNullable<(typeof v.byRarity)[keyof typeof v.byRarity]>][];
  const boosters = showAll ? [...d.analyses].sort((a, b) => b.legacyNew - a.legacyNew) : [...d.analyses].sort((a, b) => b.legacyNew - a.legacyNew).slice(0, 8);
  const luckRows = v.luck.rows.filter((r) => r.expected > 0 || r.actual > 0);

  return (
    <main className="ptc-page">
      <h1>Statistiques</h1>

      <section className="ptc-tiles" aria-label="Totaux">
        <div className="ptc-tile"><b>{num(v.totals.owned)}</b><span>cartes différentes / {num(v.totals.total)}</span></div>
        <div className="ptc-tile"><b>{num(v.totals.copies)}</b><span>exemplaires au total</span></div>
        <div className="ptc-tile"><b>{num(v.trade)}</b><span>échangeables</span></div>
        <div className="ptc-tile"><b>{num(v.share)}</b><span>partageables</span></div>
      </section>

      <h2>Complétion par extension</h2>
      <p>Barre épaisse : 1ère copie. Trait fin : 2e copie.</p>
      {setIds.length === 0 ? <p className="ptc-empty">Aucune donnée.</p> : (
        <HBars ariaLabel="Complétion par extension" items={setIds.map((id) => ({
          label: id, value: v.bySet[id].owned, value2: v.bySet[id].owned2, max: v.bySet[id].total,
          text: pct(v.bySet[id].pct, 1),
        }))} />
      )}
      <ul className="ptc-list">
        {setIds.map((id) => (
          <li key={id} className="ptc-row">
            <div className="main">{setName(id)}<small>{v.bySet[id].owned} / {v.bySet[id].total} · 2e copie : {pct(v.bySet[id].pct2)}</small></div>
            <div className="val">{pct(v.bySet[id].pct)}</div>
          </li>
        ))}
      </ul>

      <h2>Répartition par rareté</h2>
      <HBars ariaLabel="Complétion par rareté" items={rarities.map(([r, c]) => ({
        label: RARITY_LABEL[r], value: c.owned, value2: c.owned2, max: c.total, text: `${c.owned}/${c.total}`,
      }))} />

      <h2>Probabilités par booster</h2>
      <div className="ptc-scroll">
        <table className="ptc-table">
          <thead><tr><th>Booster</th><th>Compl.</th><th>1ère</th><th>Packs</th><th>2e</th></tr></thead>
          <tbody>
            {boosters.map((a) => (
              <tr key={a.boosterId}>
                <td>{d.boosterById.get(a.boosterId)?.name ?? a.boosterId}</td>
                <td>{pct(a.completion)}</td><td>{pct(a.legacyNew, 2)}</td><td>{packsLabel(a.legacyNew > 0 ? 1 / a.legacyNew : Infinity)}</td><td>{pct(a.legacySecond, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.analyses.length > 8 && (
        <div className="ptc-tabs"><button type="button" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Réduire' : `Tout afficher (${d.analyses.length})`}</button></div>
      )}

      <h2>Packs ouverts</h2>
      <p>{num(v.nPacks)} packs enregistrés{Object.keys(v.perSet).length ? ' : ' + Object.entries(v.perSet).map(([s, n]) => `${s} ${n}`).join(' · ') : ''}.</p>
      {v.months.length === 0 ? <p className="ptc-empty">Aucun pack dans l'historique.</p> : <Columns data={v.months} ariaLabel="Packs ouverts par mois" />}

      <h2>Chance : réel contre attendu</h2>
      {v.luck.packs === 0 || luckRows.length === 0 ? <p className="ptc-empty">Il faut des packs enregistrés et des taux saisis.</p> : (
        <>
          <p>
            Sur {num(v.luck.packs)} packs : {v.luck.rareActual} cartes rares (☆ et plus) obtenues pour {v.luck.rareExpected.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} attendues
            {' '}({(v.luck.ratio * 100).toFixed(0)} % de l'attendu).
          </p>
          <RatioBars ariaLabel="Rapport obtenu sur attendu par rareté" items={luckRows.map((r) => ({
            label: RARITY_LABEL[r.rarity], ratio: r.ratio,
            text: `${r.actual} / ${r.expected.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`,
          }))} />
          <p>Trait pointillé : exactement l'attendu. Plus d'écart-type que ±2 = résultat inhabituel.</p>
        </>
      )}
    </main>
  );
}
