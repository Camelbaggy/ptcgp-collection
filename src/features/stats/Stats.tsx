import { useMemo, useState } from 'react';
import { BoosterEmblem, SetLogo } from '../../components/Brand';
import { RARITY_LABEL, RARITY_ORDER, RARE_RARITIES, collectionTotals, completionByRarity, completionBySet } from '../../lib/calc';
import { cardImageUrl } from '../../lib/db';
import {
  PACK_POINTS_PER_PACK, PERIODS, type Period, bestPulls, bucketFor, bucketLabel, completionTimeline, countByBucket, dayKey, dayLabel, diffDays,
  duplicateStock, findGodPacks, isFullPack, luckSummary, luckVerdict, onlyPacks, packDays, packStreaks, packsByBooster, periodStart, pulledByRarity,
  scopeEvents, sharesOf, todayKey, tradesOf, typeDistribution,
} from '../../lib/stats';
import type { Card, Rarity } from '../../lib/types';
import { isSpecialSetId, usePersisted } from '../../lib/useData';
import { useCalcData } from '../dashboard/useCalcData';
import { AreaChart, Columns, Donut, Empty, LuckMeter, Ring, Section, Sparkline, StackBar, nf, nf1, pf } from './charts';
import './stats.css';

const rc = (r: Rarity) => `var(--st-r-${r})`;
const TYPE_COLOR: Record<string, string> = {
  Plante: 'var(--st-t-plante)', Feu: 'var(--st-t-feu)', Eau: 'var(--st-t-eau)', Électrique: 'var(--st-t-elec)', Psy: 'var(--st-t-psy)',
  Combat: 'var(--st-t-combat)', Obscurité: 'var(--st-t-obs)', Métal: 'var(--st-t-metal)', Dragon: 'var(--st-t-dragon)', Incolore: 'var(--st-t-inc)', Dresseur: 'var(--st-t-dresseur)',
};

const plural = (n: number, one: string, many = one + 's') => `${nf.format(n)} ${n > 1 ? many : one}`;
/** ~5 repères d'axe répartis sur n points. */
function xTicks(n: number, text: (i: number) => string): { i: number; text: string }[] {
  if (n <= 0) return [];
  const k = Math.min(n, n < 8 ? n : 5);
  const idx = [...new Set(Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / Math.max(1, k - 1))))];
  return idx.map((i) => ({ i, text: text(i) }));
}

function Thumb({ card }: { card: Card }) {
  const [broken, setBroken] = useState(false);
  return broken
    ? <span className="st-thumb fb"><b>{card.name}</b><small>{card.id}</small></span>
    : <img className="st-thumb" src={cardImageUrl(card)} alt={card.name} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

export default function Stats() {
  const d = useCalcData();
  const [period, setPeriod] = usePersisted<Period>('stats.period', '30');
  const [setId, setSetId] = usePersisted<string>('stats.set', '');
  const [showAllBoosters, setShowAllBoosters] = useState(false);
  const today = todayKey();

  const v = useMemo(() => {
    if (d.loading) return null;
    const sid = setId && d.sets.some((s) => s.id === setId) ? setId : null;
    const boosterSet = (id: string) => d.boosterById.get(id)?.setId ?? id.split('-')[0];
    const lk = { cardById: d.cardById, boosterSet };
    const cards = sid ? d.cards.filter((c) => c.setId === sid) : d.cards;
    const evAll = scopeEvents(d.history, { from: null, setId: sid }, lk);
    const firstDay = evAll.length ? dayKey(evAll.reduce((m, e) => (e.date < m ? e.date : m), evAll[0].date)) : today;
    const pStart = periodStart(period, today);
    const from = pStart ?? firstDay;
    const span = Math.max(1, diffDays(from, today) + 1);
    const bucket = bucketFor(span);
    const evs = scopeEvents(d.history, { from: pStart, setId: sid }, lk);
    const packs = onlyPacks(evs);
    const fullPacks = packs.filter(isFullPack);
    const shares = sharesOf(evs), trades = tradesOf(evs);

    const timeline = completionTimeline(d.cards, d.owned, d.history, today, { setId: sid, from });
    const packBuckets = countByBucket(packDays(packs), bucket, from, today);
    const shareBuckets = countByBucket(shares.map((e) => dayKey(e.date)), bucket, from, today);
    const tradeBuckets = countByBucket(trades.map((e) => dayKey(e.date)), bucket, from, today);
    const streaks = packStreaks(packDays(onlyPacks(scopeEvents(d.history, { from: null, setId: sid }, lk))), today);
    const luck = luckSummary(packs, d.cardById, d.rates);
    const pulled = pulledByRarity(packs, d.cardById);
    const owned = d.owned;
    return {
      sid, cards, from, bucket, span, packs, fullPacks, shares, trades, timeline, packBuckets, shareBuckets, tradeBuckets, streaks, luck, pulled,
      totals: collectionTotals(cards, owned),
      byRarity: completionByRarity(cards, owned),
      bySet: completionBySet(d.cards, owned),
      boosters: packsByBooster(packs),
      best: bestPulls(packs, d.cardById, 14),
      god: findGodPacks(packs, d.cardById),
      stock: duplicateStock(cards, owned),
      types: typeDistribution(cards, owned),
    };
  }, [d, period, setId, today]);

  if (!v) return <main className="st"><div className="st-wrap"><h1>Statistiques</h1><p className="st-empty">Chargement…</p></div></main>;

  const setName = (id: string) => d.sets.find((s) => s.id === id)?.name ?? id;
  const periodLabel = period === 'all' ? 'depuis le début' : `sur ${period} jours`;
  const scopeLabel = v.sid ? ` · ${v.sid}` : '';
  const tl = v.timeline;
  const gain = tl.length > 1 ? tl[tl.length - 1].owned - tl[0].owned : 0;
  const pctGain = tl.length > 1 ? (tl[tl.length - 1].pct - tl[0].pct) * 100 : 0;
  const nPacks = v.packs.length;
  const points = v.fullPacks.length * PACK_POINTS_PER_PACK;
  const missingByRarity = RARITY_ORDER.map((r) => ({ r, miss: (v.byRarity[r]?.total ?? 0) - (v.byRarity[r]?.owned ?? 0) })).filter((x) => x.miss > 0);
  const bestBucket = v.packBuckets.reduce((m, p) => (p.count > m.count ? p : m), { start: '', count: 0 });
  const rareRows = v.luck.rows.filter((r) => r.expected > 0 || r.actual > 0);
  const pulledSlices = RARITY_ORDER.filter((r) => v.pulled[r]).map((r) => ({ key: r, label: RARITY_LABEL[r], value: v.pulled[r]!, color: rc(r) }));
  const pulledTotal = pulledSlices.reduce((s, x) => s + x.value, 0);
  const setIds = d.sets.map((s) => s.id).filter((id) => v.bySet[id]);
  const bigBoosters = showAllBoosters ? v.boosters : v.boosters.slice(0, 8);
  const maxBoost = v.boosters[0]?.count ?? 1;
  const typeSlices = v.types.filter((t) => t.owned > 0).map((t) => ({ key: t.type, label: t.type, value: t.owned, color: TYPE_COLOR[t.type] ?? 'var(--st-t-inc)', extra: `/ ${nf.format(t.total)}` }));
  const stockRows = v.stock.filter((s) => s.spare > 0);
  const spareTotal = stockRows.reduce((s, r) => s + r.spare, 0);
  const maxSpare = Math.max(1, ...stockRows.map((r) => r.spare));
  const tradeTotal = stockRows.reduce((s, r) => s + r.tradeable, 0);
  const hasHistory = nPacks + v.shares.length + v.trades.length > 0;
  const tickText = (b: { start: string }[]) => (i: number) => bucketLabel(b[i].start, v.bucket).replace('sem. du ', '');
  const bucketTip = (start: string) => bucketLabel(start, v.bucket);
  const toneRatio = v.luck.ratio >= 1 ? 'ok' : 'bad';

  return (
    <main className="st">
      <div className="st-wrap">
        <div className="st-head">
          <div><h1>Statistiques</h1><p className="st-lead">{nf.format(v.totals.owned)} cartes sur {nf.format(v.totals.total)}{v.sid ? ` dans ${setName(v.sid)}` : ''}, {periodLabel}.</p></div>
          <div className="st-filters">
            <div className="st-seg" role="group" aria-label="Période">
              {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
            </div>
            <label className="st-select">
              <span className="sr-only">Extension</span>
              <select value={v.sid ?? ''} onChange={(e) => setSetId(e.target.value)} aria-label="Extension">
                <option value="">Toutes les extensions</option>
                {d.sets.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* ----- KPI ----- */}
        <div className="st-kpis">
          <div className="st-kpi hero">
            <Ring value={v.totals.pct} label="Complétion" sub="complété" />
            <div className="meta">
              <span className="k">Collection{scopeLabel}</span>
              <b>{nf.format(v.totals.owned)}<small> / {nf.format(v.totals.total)}</small></b>
              <span className={'delta ' + (gain >= 0 ? 'up' : 'down')}>{gain >= 0 ? '+' : ''}{nf.format(gain)} {periodLabel}</span>
              <span className="sub">{nf.format(v.totals.copies)} exemplaires · {pf(v.totals.pct2, 0)} en double</span>
            </div>
          </div>
          <div className="st-kpi">
            <span className="k">Packs ouverts</span>
            <b>{nf.format(nPacks)}</b>
            <Sparkline values={v.packBuckets.map((p) => p.count)} label="Packs ouverts sur la période" color="var(--st-c1)" />
            <span className="sub">≈ {nf.format(points)} points de pack</span>
          </div>
          <div className="st-kpi">
            <span className="k">Série en cours</span>
            <b>{plural(v.streaks.current, 'jour')}</b>
            <span className="sub">Record : {plural(v.streaks.longest, 'jour')}</span>
            <span className="sub">{plural(v.streaks.activeDays, 'jour actif', 'jours actifs')}</span>
          </div>
          <div className="st-kpi">
            <span className="k">Partages · échanges</span>
            <b>{nf.format(v.shares.length)}<small> · </small>{nf.format(v.trades.length)}</b>
            <Sparkline values={v.shareBuckets.map((p, i) => p.count + (v.tradeBuckets[i]?.count ?? 0))} label="Partages et échanges sur la période" color="var(--st-c3)" />
            <span className="sub">{plural(v.shares.length + v.trades.length, 'mouvement')} {periodLabel}</span>
          </div>
          <div className="st-kpi">
            <span className="k">Doubles échangeables</span>
            <b>{nf.format(tradeTotal)}</b>
            <span className="sub">sur {nf.format(spareTotal)} exemplaires en trop</span>
            <span className="sub">{nf.format(stockRows.length)} raretés concernées</span>
          </div>
          <div className="st-kpi miss">
            <span className="k">Cartes manquantes par rareté</span>
            <div className="st-chips">
              {missingByRarity.length === 0 ? <span className="sub">Rien ne manque.</span> : missingByRarity.map(({ r, miss }) => (
                <span key={r} className="st-chip" title={`${nf.format(miss)} manquantes`}><i className="st-dot" style={{ background: rc(r) }} />{RARITY_LABEL[r]}<b>{nf.format(miss)}</b></span>
              ))}
            </div>
          </div>
        </div>

        {/* ----- Sections ----- */}
        <div className="st-grid">
          <Section wide title="Complétion dans le temps" sub="Cartes différentes possédées, jour après jour"
            insight={tl.length > 1 ? <><b>{gain >= 0 ? '+' : ''}{nf.format(gain)} cartes</b> ({pctGain >= 0 ? '+' : ''}{nf1.format(pctGain)} pt) {periodLabel} ; il en manque encore {nf.format(v.totals.total - v.totals.owned)}.</> : undefined}>
            {tl.length < 2 ? <Empty>Pas assez de données sur cette période.</Empty> : (
              <AreaChart data={tl.map((p) => ({ x: p.day, y: p.owned, label: dayLabel(p.day, true) }))} yMin={Math.max(0, Math.min(...tl.map((p) => p.owned)) - 1)} yMax={Math.max(...tl.map((p) => p.owned)) + 1}
                ariaLabel={`Cartes possédées de ${nf.format(tl[0].owned)} à ${nf.format(tl[tl.length - 1].owned)} ${periodLabel}`} yFormat={(y) => nf.format(Math.round(y))}
                tipValue={(p) => `${nf.format(p.y)} cartes`} xTicks={xTicks(tl.length, (i) => dayLabel(tl[i].day))} />
            )}
          </Section>

          <Section wide title="Packs ouverts" sub={`Par ${v.bucket === 'day' ? 'jour' : v.bucket === 'week' ? 'semaine' : 'mois'}`}
            insight={nPacks ? <>{nf.format(nPacks)} packs, soit {nf1.format(nPacks / Math.max(1, v.span))} par jour. Meilleure {v.bucket === 'day' ? 'journée' : v.bucket === 'week' ? 'semaine' : 'période'} : <b>{nf.format(bestBucket.count)}</b> ({bucketTip(bestBucket.start)}). Série record : <b>{plural(v.streaks.longest, 'jour')}</b> d'affilée.</> : undefined}>
            {!nPacks ? <Empty>Aucun pack enregistré sur cette période.</Empty> : (
              <Columns data={v.packBuckets.map((p) => ({ label: p.start, tipLabel: bucketTip(p.start), values: [p.count] }))} series={[{ name: 'Packs', color: 'var(--st-c1)' }]} unit="packs"
                ariaLabel={`Packs ouverts par ${v.bucket}`} xTicks={xTicks(v.packBuckets.length, tickText(v.packBuckets))} />
            )}
          </Section>

          <Section title="Chance" sub="Cartes rares (☆ et plus) tirées contre attendues"
            insight={v.luck.packs ? <>{nf.format(v.luck.rareActual)} cartes rares pour {nf1.format(v.luck.rareExpected)} attendues sur {plural(v.luck.packs, 'pack')} complets (<b className={toneRatio}>{pf(v.luck.ratio, 0)}</b> de l'attendu).</> : undefined}>
            {!v.luck.packs ? <Empty>Il faut des packs complets (4 cartes ou plus) et des taux saisis.</Empty> : (
              <>
                <LuckMeter percentile={v.luck.percentile} verdict={luckVerdict(v.luck.percentile)} />
                <ul className="st-vs">
                  {rareRows.map((r) => {
                    const m = Math.max(r.actual, r.expected, 1);
                    return (
                      <li key={r.rarity} title={`${RARITY_LABEL[r.rarity]} : ${r.actual} tirées, ${nf1.format(r.expected)} attendues`}>
                        <span className="l">{RARITY_LABEL[r.rarity]}</span>
                        <span className="bars">
                          <i className="a st-grow-x" style={{ width: `${(r.actual / m) * 100}%`, background: rc(r.rarity) }} />
                          <i className="e" style={{ width: `${(r.expected / m) * 100}%` }} />
                        </span>
                        <span className="v"><b>{nf.format(r.actual)}</b> / {nf1.format(r.expected)}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="st-note"><i className="st-key a" /> tirées <i className="st-key e" /> attendues (taux du jeu)</p>
              </>
            )}
          </Section>

          <Section title="Raretés tirées" sub="Répartition de toutes les cartes de vos packs"
            insight={pulledTotal ? <>{pf((v.pulled.D1 ?? 0) / pulledTotal, 0)} de simples ◊, et <b>{nf.format(RARE_RARITIES.reduce((s, r) => s + (v.pulled[r] ?? 0), 0))}</b> cartes rares.</> : undefined}>
            {!pulledTotal ? <Empty>Aucune carte tirée sur cette période.</Empty> : (
              <Donut slices={pulledSlices} ariaLabel="Répartition des raretés tirées" centerTop={nf.format(pulledTotal)} centerBottom="cartes tirées" />
            )}
          </Section>

          <Section wide title="Complétion par extension" sub="Part des cartes possédées au moins une fois"
            insight={(() => { const best = setIds.filter((id) => !isSpecialSetId(id) && v.bySet[id].total > 0).sort((a, b) => v.bySet[b].pct - v.bySet[a].pct); const b = best[0]; return b && best.length > 1 ? <>Plus avancée : <b>{setName(b)}</b> ({pf(v.bySet[b].pct, 0)}). Moins avancée : <b>{setName(best[best.length - 1])}</b> ({pf(v.bySet[best[best.length - 1]].pct, 0)}).</> : undefined; })()}>
            {setIds.length === 0 ? <Empty>Aucune extension.</Empty> : (
              <ul className="st-rows stacked">
                {setIds.map((id) => {
                  const c = v.bySet[id];
                  return (
                    <li key={id} className={v.sid && v.sid !== id ? 'dim' : ''} title={`${setName(id)} : ${c.owned} / ${c.total}`}>
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

          <Section title="Complétion par rareté" sub="Possédées et manquantes"
            insight={missingByRarity[0] ? <>Il manque surtout des <b>{RARITY_LABEL[[...missingByRarity].sort((a, b) => b.miss - a.miss)[0].r]}</b> ({nf.format([...missingByRarity].sort((a, b) => b.miss - a.miss)[0].miss)}).</> : undefined}>
            <ul className="st-rows tight">
              {RARITY_ORDER.filter((r) => v.byRarity[r]).map((r) => {
                const c = v.byRarity[r]!;
                return (
                  <li key={r} title={`${RARITY_LABEL[r]} : ${c.owned} / ${c.total}`}>
                    <span className="who rar"><i className="st-dot" style={{ background: rc(r) }} />{RARITY_LABEL[r]}</span>
                    <StackBar total={c.total} parts={[{ label: 'Possédées', value: c.owned, color: rc(r) }, { label: 'Manquantes', value: c.total - c.owned, color: 'var(--st-track)' }]} />
                    <span className="v"><b>{pf(c.pct, 0)}</b><small>{nf.format(c.total - c.owned)} manq.</small></span>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Boosters ouverts" sub="Packs ouverts par booster"
            insight={v.boosters[0] ? <>Booster favori : <b>{d.boosterById.get(v.boosters[0].boosterId)?.name ?? v.boosters[0].boosterId}</b> ({pf(v.boosters[0].count / Math.max(1, nPacks), 0)} des packs).</> : undefined}>
            {!v.boosters.length ? <Empty>Aucun pack sur cette période.</Empty> : (
              <>
                <ul className="st-rows stacked">
                  {bigBoosters.map((b) => {
                    const bo = d.boosterById.get(b.boosterId);
                    return (
                      <li key={b.boosterId} title={`${bo?.name ?? b.boosterId} : ${b.count} packs`}>
                        <span className="who"><span className="st-emb"><BoosterEmblem boosterId={b.boosterId} small /></span><span className="nm"><small>{bo?.setId ?? b.boosterId.split('-')[0]}</small> {bo?.name ?? b.boosterId}</span></span>
                        <span className="bar thin"><i className="st-grow-x" style={{ width: `${(b.count / maxBoost) * 100}%`, background: 'var(--st-c1)' }} /></span>
                        <span className="v"><b>{nf.format(b.count)}</b></span>
                      </li>
                    );
                  })}
                </ul>
                {v.boosters.length > 8 && <button type="button" className="st-more" onClick={() => setShowAllBoosters(!showAllBoosters)}>{showAllBoosters ? 'Réduire' : `Voir les ${v.boosters.length} boosters`}</button>}
              </>
            )}
          </Section>

          <Section wide title="Meilleurs tirages" sub="Vos plus belles cartes, de la plus rare à la plus récente"
            insight={v.god.length ? <><b>{plural(v.god.length, 'pack rare', 'packs rares')}</b> détecté{v.god.length > 1 ? 's' : ''} (toutes les cartes rares)
              {v.god[0] ? <>, dernier le {dayLabel(dayKey(v.god[v.god.length - 1].date), true)}</> : null}.</> : v.best.length ? <>Aucun pack entièrement rare (« god pack ») détecté.</> : undefined}>
            {!v.best.length ? <Empty>Pas encore de carte ☆☆ ou mieux sur cette période.</Empty> : (
              <ul className="st-best">
                {v.best.map((b, i) => {
                  const card = d.cardById.get(b.cardId);
                  if (!card) return null;
                  return (
                    <li key={b.cardId + b.date + i} title={`${card.name} · ${dayLabel(dayKey(b.date), true)}`}>
                      <Thumb card={card} />
                      <span className="st-rbadge" style={{ background: rc(b.rarity) }}>{RARITY_LABEL[b.rarity]}</span>
                      <span className="nm">{card.name}</span>
                      <small>{dayLabel(dayKey(b.date))}</small>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Doubles en stock" sub="Exemplaires en trop par rareté"
            insight={spareTotal ? <><b>{nf.format(tradeTotal)}</b> des {nf.format(spareTotal)} doubles sont échangeables selon les règles du jeu.</> : undefined}>
            {!spareTotal ? <Empty>Aucun double.</Empty> : (
              <>
                <ul className="st-rows tight">
                  {stockRows.map((r) => (
                    <li key={r.rarity} title={`${RARITY_LABEL[r.rarity]} : ${nf.format(r.spare)} doubles, dont ${nf.format(r.tradeable)} échangeables`}>
                      <span className="who rar"><i className="st-dot" style={{ background: rc(r.rarity) }} />{RARITY_LABEL[r.rarity]}</span>
                      <StackBar total={maxSpare} parts={[{ label: 'Échangeables', value: r.tradeable, color: 'var(--st-c3)' }, { label: 'Non échangeables', value: r.spare - r.tradeable, color: 'var(--st-c5)' }]} />
                      <span className="v"><b>{nf.format(r.spare)}</b></span>
                    </li>
                  ))}
                </ul>
                <p className="st-note"><i className="st-key" style={{ background: 'var(--st-c3)' }} /> échangeables <i className="st-key" style={{ background: 'var(--st-c5)' }} /> non échangeables</p>
              </>
            )}
          </Section>

          <Section title="Partages et échanges" sub={`Par ${v.bucket === 'day' ? 'jour' : v.bucket === 'week' ? 'semaine' : 'mois'}`}
            insight={v.shares.length + v.trades.length ? <><b>{nf.format(v.shares.length)}</b> partages et <b>{nf.format(v.trades.length)}</b> échanges {periodLabel}.</> : undefined}>
            {!v.shares.length && !v.trades.length ? <Empty>Aucun partage ni échange sur cette période.</Empty> : (
              <>
                <Columns data={v.shareBuckets.map((p, i) => ({ label: p.start, tipLabel: bucketTip(p.start), values: [p.count, v.tradeBuckets[i]?.count ?? 0] }))}
                  series={[{ name: 'Partages', color: 'var(--st-c3)' }, { name: 'Échanges', color: 'var(--st-c2)' }]} ariaLabel="Partages et échanges" xTicks={xTicks(v.shareBuckets.length, tickText(v.shareBuckets))} />
                <p className="st-note"><i className="st-key" style={{ background: 'var(--st-c3)' }} /> partages <i className="st-key" style={{ background: 'var(--st-c2)' }} /> échanges</p>
              </>
            )}
          </Section>

          <Section wide title="Types de Pokémon" sub="Cartes différentes possédées par type"
            insight={typeSlices[0] ? <>Type le plus présent : <b>{typeSlices[0].label}</b> ({nf.format(typeSlices[0].value)} cartes).</> : undefined}>
            {!typeSlices.length ? <Empty>Aucune carte avec un type.</Empty> : <Donut slices={typeSlices} size={200} ariaLabel="Répartition des types" centerTop={nf.format(typeSlices.reduce((s, x) => s + x.value, 0))} centerBottom="cartes" />}
          </Section>
        </div>

        {!hasHistory && period !== 'all' && <p className="st-empty">Rien dans l'historique sur cette période : essayez « Tout ».</p>}
        <p className="st-foot">Les saisies de 1 à 3 cartes comptent comme des packs pour les volumes, mais pas pour la chance ni les packs rares. Points de pack estimés à {PACK_POINTS_PER_PACK} par pack complet.</p>
      </div>
    </main>
  );
}
