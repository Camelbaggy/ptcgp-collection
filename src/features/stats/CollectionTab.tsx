import { SetLogo } from '../../components/Brand';
import { RARITY_LABEL, RARITY_ORDER } from '../../lib/calc';
import type { PzHome } from '../../lib/pzProfile/types';
import type { Rarity } from '../../lib/types';
import { isSpecialSetId } from '../../lib/useData';
import type { CalcData } from '../dashboard/useCalcData';
import { Donut, Empty, Ring, Section, StackBar, nf, pf } from './charts';
import type { Detail } from './details';
import type { StatsView } from './view';
import { TYPE_COLOR, hit, rc } from './shared';

interface Props { d: CalcData; v: StatsView; open: (x: Detail) => void; setName: (id: string) => string; pzHome: PzHome | null }

/** Onglet « Collection » : état actuel, exact, indépendant de la période. */
export function CollectionTab({ d, v, open, setName, pzHome }: Props) {
  const scopeLabel = v.sid ? ` · ${v.sid}` : '';
  const missingByRarity = RARITY_ORDER.map((r) => ({ r, miss: (v.byRarity[r]?.total ?? 0) - (v.byRarity[r]?.owned ?? 0) })).filter((x) => x.miss > 0);
  const topMissing = [...missingByRarity].sort((a, b) => b.miss - a.miss)[0];
  const setIds = d.sets.map((s) => s.id).filter((id) => v.bySet[id]);
  const stockRows = v.stock.filter((s) => s.spare > 0);
  const spareTotal = stockRows.reduce((s, r) => s + r.spare, 0);
  const maxSpare = Math.max(1, ...stockRows.map((r) => r.spare));
  const tradeCards = stockRows.reduce((s, r) => s + r.tradeCards, 0), tradeCopies = stockRows.reduce((s, r) => s + r.tradeable, 0);
  const shareCards = stockRows.reduce((s, r) => s + r.shareCards, 0), shareCopies = stockRows.reduce((s, r) => s + r.shareable, 0);
  const typeSlices = v.types.filter((t) => t.owned > 0).map((t) => ({ key: t.type, label: t.type, value: t.owned, color: TYPE_COLOR[t.type] ?? 'var(--st-t-inc)', extra: `/ ${nf.format(t.total)}` }));
  const ranked = setIds.filter((id) => !isSpecialSetId(id) && v.bySet[id].total > 0).sort((a, b) => v.bySet[b].pct - v.bySet[a].pct);
  // Pokémon-Zone compte à part les réimpressions des boosters de luxe : ses totaux par rareté sont plus grands.
  const pzTotal = !v.sid && pzHome?.rarityProgress.length ? pzHome.rarityProgress.reduce((s, r) => s + r.total, 0) : 0;

  return (
    <>
      <div className="st-kpis" data-content-start="">
        <div className="st-kpi hero link">{hit('Complétion', () => open({ k: 'completion' }))}
          <Ring value={v.totals.pct} label="Complétion" sub="complété" />
          <div className="meta">
            <span className="k">Collection{scopeLabel}</span>
            <b>{nf.format(v.totals.owned)}<small> / {nf.format(v.totals.total)}</small></b>
            <span className="sub">{nf.format(v.totals.total - v.totals.owned)} manquantes · {pf(v.totals.pct2, 0)} avec 2e copie</span>
            <span className="sub">{nf.format(v.totals.copies)} exemplaires au total</span>
          </div>
        </div>
        <div className="st-kpi link">{hit('Échangeables', () => open({ k: 'stock', filter: 'trade' }))}
          <span className="k">Échangeables</span>
          <b>{nf.format(tradeCards)}</b>
          <span className="sub">{nf.format(tradeCopies)} exemplaires à proposer</span>
          <span className="sub">mêmes règles que l’accueil</span>
        </div>
        <div className="st-kpi link">{hit('Partageables', () => open({ k: 'stock', filter: 'share' }))}
          <span className="k">Partageables</span>
          <b>{nf.format(shareCards)}</b>
          <span className="sub">{nf.format(shareCopies)} exemplaires à proposer</span>
        </div>
        <div className="st-kpi miss link">{hit('Cartes manquantes par rareté', () => open({ k: 'missing' }))}
          <span className="k">Manquantes par rareté</span>
          <div className="st-chips">
            {missingByRarity.length === 0 ? <span className="sub">Rien ne manque.</span> : missingByRarity.map(({ r, miss }) => (
              <button type="button" key={r} className="st-chip" title={`${nf.format(miss)} manquantes`} aria-haspopup="dialog" onClick={() => open({ k: 'missing', rarity: r })}><i className="st-dot" style={{ background: rc(r) }} />{RARITY_LABEL[r]}<b>{nf.format(miss)}</b></button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-grid">
        <Section wide onOpen={() => open({ k: 'completion' })} title="Complétion par extension" sub="Part des cartes possédées au moins une fois"
          insight={ranked.length > 1 ? <>Plus avancée : <b>{setName(ranked[0])}</b> ({pf(v.bySet[ranked[0]].pct, 0)}). Moins avancée : <b>{setName(ranked[ranked.length - 1])}</b> ({pf(v.bySet[ranked[ranked.length - 1]].pct, 0)}).</> : undefined}>
          {setIds.length === 0 ? <Empty>Aucune extension.</Empty> : (
            <ul className="st-rows stacked">
              {setIds.map((id) => {
                const c = v.bySet[id];
                return (
                  <li key={id} className={'link' + (v.sid && v.sid !== id ? ' dim' : '')} title={`${setName(id)} : ${c.owned} / ${c.total}`}>
                    <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'set', setId: id })}><span className="sr-only">{setName(id)} : voir le détail</span></button>
                    <span className="who"><span className="st-logo"><SetLogo setId={id} name={setName(id)} small fallback={<b>{id}</b>} /></span><span className="nm">{setName(id)}</span></span>
                    <span className="bar"><i className="st-grow-x" style={{ width: `${c.pct * 100}%`, background: c.pct >= 1 ? 'var(--st-good)' : 'var(--st-accent)' }} /><i className="two" style={{ width: `${c.pct2 * 100}%` }} /></span>
                    <span className="v"><b>{pf(c.pct, 0)}</b><small>{nf.format(c.owned)}/{nf.format(c.total)}</small></span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="st-note"><i className="st-key a" /> 1 exemplaire <i className="st-key two" /> 2 exemplaires ou plus</p>
        </Section>

        <Section onOpen={() => open({ k: 'missing' })} title="Complétion par rareté" sub="Possédées et manquantes"
          insight={topMissing ? <>Il manque surtout des <b>{RARITY_LABEL[topMissing.r]}</b> ({nf.format(topMissing.miss)}).</> : undefined}>
          <ul className="st-rows tight">
            {RARITY_ORDER.filter((r) => v.byRarity[r]).map((r: Rarity) => {
              const c = v.byRarity[r]!;
              return (
                <li key={r} className="link" title={`${RARITY_LABEL[r]} : ${c.owned} / ${c.total}`}>
                  <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'missing', rarity: r })}><span className="sr-only">{RARITY_LABEL[r]} : cartes manquantes</span></button>
                  <span className="who rar"><i className="st-dot" style={{ background: rc(r) }} />{RARITY_LABEL[r]}</span>
                  <StackBar total={c.total} parts={[{ label: 'Possédées', value: c.owned, color: rc(r) }, { label: 'Manquantes', value: c.total - c.owned, color: 'var(--st-track)' }]} />
                  <span className="v"><b>{pf(c.pct, 0)}</b><small>{nf.format(c.total - c.owned)} manq.</small></span>
                </li>
              );
            })}
          </ul>
          {pzTotal > 0 && pzTotal !== v.totals.total && (
            <p className="st-note">Pokémon-Zone affiche {nf.format(pzTotal)} cartes au lieu de {nf.format(v.totals.total)} : il compte à part les réimpressions des boosters de luxe et ignore les promos. Ici, une réimpression est la carte d’origine.</p>
          )}
        </Section>

        <Section onOpen={() => open({ k: 'stock', filter: 'all' })} title="Doubles en stock" sub="Exemplaires en trop par rareté"
          insight={spareTotal ? <><b>{nf.format(tradeCopies)}</b> des {nf.format(spareTotal)} exemplaires en trop sont à proposer à l’échange, d’après tes règles (2 exemplaires gardés pour les ◊, 1 au-delà).</> : undefined}>
          {!spareTotal ? <Empty>Aucun double.</Empty> : (
            <>
              <ul className="st-rows tight">
                {stockRows.map((r) => (
                  <li key={r.rarity} className="link" title={`${RARITY_LABEL[r.rarity]} : ${nf.format(r.spare)} en trop, dont ${nf.format(r.tradeable)} échangeables`}>
                    <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'stock', filter: 'all' })}><span className="sr-only">{RARITY_LABEL[r.rarity]} : voir les doubles</span></button>
                    <span className="who rar"><i className="st-dot" style={{ background: rc(r.rarity) }} />{RARITY_LABEL[r.rarity]}</span>
                    <StackBar total={maxSpare} parts={[
                      { label: 'Échangeables', value: r.tradeable, color: 'var(--st-c3)' },
                      { label: 'Gardés ou non échangeables', value: r.spare - r.tradeable, color: 'var(--st-c5)' },
                    ]} />
                    <span className="v"><b>{nf.format(r.spare)}</b></span>
                  </li>
                ))}
              </ul>
              <p className="st-note"><i className="st-key" style={{ background: 'var(--st-c3)' }} /> à échanger <i className="st-key" style={{ background: 'var(--st-c5)' }} /> gardés ou non échangeables</p>
            </>
          )}
        </Section>

        <Section onOpen={() => open({ k: 'types' })} title="Types de Pokémon" sub="Cartes différentes possédées par type"
          insight={typeSlices[0] ? <>Type le plus présent : <b>{typeSlices[0].label}</b> ({nf.format(typeSlices[0].value)} cartes).</> : undefined}>
          {!typeSlices.length ? <Empty>Aucune carte avec un type.</Empty> : <Donut slices={typeSlices} size={200} ariaLabel="Répartition des types" centerTop={nf.format(typeSlices.reduce((s, x) => s + x.value, 0))} centerBottom="cartes" onSelect={(k) => open({ k: 'types', type: k })} />}
        </Section>
      </div>
    </>
  );
}
