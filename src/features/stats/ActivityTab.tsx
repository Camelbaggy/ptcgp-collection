import { useState } from 'react';
import { BoosterEmblem } from '../../components/Brand';
import { RARITY_LABEL, RARITY_ORDER, RARE_RARITIES } from '../../lib/calc';
import { type Lifetime, type Period, bucketLabel, dayKey, dayLabel, luckVerdict } from '../../lib/stats';
import type { Card, Rarity } from '../../lib/types';
import { setIdOf } from '../../lib/setId';
import type { CalcData } from '../dashboard/useCalcData';
import { AreaChart, Columns, Donut, Empty, LuckMeter, Section, Sparkline, axisTicks, nf, nf1, pf } from './charts';
import type { Detail } from './details';
import type { StatsView } from './view';
import { Source, Thumb, hit, plural, rc } from './shared';

interface Props { d: CalcData; v: StatsView; period: Period; periodLabel: string; open: (x: Detail) => void; pick: (c: Card) => void; life: Lifetime | null }

/** Onglet « Activité » : uniquement le journal des saisies de l'appli, sur la période choisie. */
export function ActivityTab({ d, v, period, periodLabel, open, pick, life }: Props) {
  const [showAllBoosters, setShowAllBoosters] = useState(false);
  const tl = v.timeline;
  const nPacks = v.fullPacks.length;
  const unit = v.bucket === 'day' ? 'jour' : v.bucket === 'week' ? 'semaine' : 'mois';
  const bestBucket = v.packBuckets.reduce((m, p) => (p.count > m.count ? p : m), { start: '', count: 0 });
  const rareRows = v.luck.rows.filter((r) => r.expected > 0 || r.actual > 0);
  const pulledSlices = RARITY_ORDER.filter((r) => v.pulled[r]).map((r) => ({ key: r, label: RARITY_LABEL[r], value: v.pulled[r]!, color: rc(r) }));
  const pulledTotal = pulledSlices.reduce((s, x) => s + x.value, 0);
  const rarePulled = RARE_RARITIES.reduce((s, r) => s + (v.pulled[r] ?? 0), 0);
  const bigBoosters = showAllBoosters ? v.boosters : v.boosters.slice(0, 8);
  const maxBoost = v.boosters[0]?.count ?? 1;
  const tickText = (b: { start: string }[]) => (i: number) => bucketLabel(b[i].start, v.bucket).replace('sem. du ', '');
  const bucketTip = (start: string) => bucketLabel(start, v.bucket);
  const toneRatio = v.luck.ratio >= 1 ? 'ok' : 'bad';
  const g = v.gains;
  const gainParts = [
    g.pack && `${nf.format(g.pack)} en packs`, g.trade && `${nf.format(g.trade)} par échange`, g.share && `${nf.format(g.share)} par partage`,
    g.correction && `${nf.format(g.correction)} par mise à jour ou import`,
  ].filter(Boolean) as string[];
  const hasHistory = nPacks + v.shares.length + v.trades.length + g.total > 0;
  const lifePacks = life?.packs ?? null;

  return (
    <>
      <Source>
        {v.coverage.since
          ? <>Journal de l’appli, tenu depuis le {dayLabel(v.coverage.since, true)} : {plural(v.coverage.packs, 'pack saisi', 'packs saisis')}
            {lifePacks ? <>, soit <b>{pf(Math.min(1, v.coverage.packs / lifePacks), 0)}</b> de tes {nf.format(lifePacks)} packs ouverts (Pokémon-Zone).</> : '.'}</>
          : <>Le journal de l’appli est vide : saisis tes packs, échanges et partages pour remplir cet onglet.</>}
      </Source>

      <div className="st-kpis" data-content-start="">
        <div className="st-kpi link">{hit('Packs ouverts', () => open({ k: 'packs' }))}
          <span className="k">Packs ouverts</span>
          <b>{nf.format(nPacks)}</b>
          <Sparkline values={v.packBuckets.map((p) => p.count)} label="Packs ouverts sur la période" color="var(--st-c1)" />
          <span className="sub">{periodLabel} · {nf1.format(nPacks / Math.max(1, v.span))} par jour</span>
        </div>
        <div className="st-kpi link">{hit('Nouvelles cartes', () => open({ k: 'completion' }))}
          <span className="k">Nouvelles cartes</span>
          <b>{nf.format(g.total)}</b>
          <span className="sub">{gainParts.length ? gainParts.join(' · ') : 'aucune sur la période'}</span>
        </div>
        <div className="st-kpi link">{hit('Série en cours', () => open({ k: 'streak' }))}
          <span className="k">Série en cours</span>
          <b>{plural(v.streaks.current, 'jour')}</b>
          <span className="sub">Record : {plural(v.streaks.longest, 'jour')}</span>
          <span className="sub">{plural(v.streaks.activeDays, 'jour actif', 'jours actifs')} au total</span>
        </div>
        <div className="st-kpi link">{hit('Chance', () => open({ k: 'luck' }))}
          <span className="k">Chance</span>
          <b className="word">{v.luck.packs ? luckVerdict(v.luck.percentile) : "–"}</b>
          <span className="sub">{v.luck.packs ? <>{nf.format(v.luck.rareActual)} rares pour {nf1.format(v.luck.rareExpected)} attendues</> : 'pas assez de packs'}</span>
        </div>
        <div className="st-kpi link">{hit('Partages · échanges', () => open({ k: 'social' }))}
          <span className="k">Partages · échanges</span>
          <b>{nf.format(v.shares.length)}<small> · </small>{nf.format(v.trades.length)}</b>
          <Sparkline values={v.shareBuckets.map((p, i) => p.count + (v.tradeBuckets[i]?.count ?? 0))} label="Partages et échanges sur la période" color="var(--st-c3)" />
        </div>
        <div className="st-kpi link">{hit('Meilleurs tirages', () => open({ k: 'best' }))}
          <span className="k">Belles cartes</span>
          <b>{nf.format(v.niceCount)}</b>
          <span className="sub">cartes ☆☆ ou mieux</span>
          <span className="sub">{v.god.length ? plural(v.god.length, 'god pack', 'god packs') : 'aucun god pack'} {periodLabel}</span>
        </div>
      </div>

      <div className="st-grid">
        <Section wide onOpen={() => open({ k: 'completion' })} title="Complétion dans le temps" sub="Cartes différentes possédées, jour après jour"
          insight={tl.length > 1 ? <>
            <b>+{nf.format(g.total)} nouvelles cartes</b> {periodLabel}{gainParts.length > 1 ? ` (${gainParts.join(', ')})` : ''}.
            {v.importDays.length > 0 && <> Les mises à jour du {v.importDays.slice(-3).map((x) => dayLabel(x)).join(', ')} rattrapent d’un coup des cartes obtenues avant : le bond de la courbe ces jours-là n’est pas une ouverture.</>}
          </> : undefined}>
          {tl.length < 2 ? <Empty>Pas assez de données sur cette période.</Empty> : (
            <AreaChart data={tl.map((p) => ({ x: p.day, y: p.owned, label: dayLabel(p.day, true) + (v.importDays.includes(p.day) ? ' · mise à jour' : '') }))}
              yMin={Math.max(0, Math.min(...tl.map((p) => p.owned)) - 1)} yMax={Math.max(...tl.map((p) => p.owned)) + 1}
              ariaLabel={`Cartes possédées de ${nf.format(tl[0].owned)} à ${nf.format(tl[tl.length - 1].owned)} ${periodLabel}`} yFormat={(y) => nf.format(Math.round(y))}
              tipValue={(p) => `${nf.format(p.y)} cartes`} xTicks={axisTicks(tl.length, (i) => dayLabel(tl[i].day))} />
          )}
        </Section>

        <Section wide onOpen={() => open({ k: 'packs' })} title="Packs ouverts" sub={`Par ${unit}`}
          insight={nPacks ? <>{nf.format(nPacks)} packs, soit {nf1.format(nPacks / Math.max(1, v.span))} par jour. Meilleur{v.bucket === 'week' ? 'e semaine' : v.bucket === 'day' ? 'e journée' : ' mois'} : <b>{nf.format(bestBucket.count)}</b> ({bucketTip(bestBucket.start)}).</> : undefined}>
          {!nPacks ? <Empty>Aucun pack enregistré sur cette période.</Empty> : (
            <Columns data={v.packBuckets.map((p) => ({ label: p.start, tipLabel: bucketTip(p.start), values: [p.count] }))} series={[{ name: 'Packs', color: 'var(--st-c1)' }]} unit="packs"
              ariaLabel={`Packs ouverts par ${unit}`} xTicks={axisTicks(v.packBuckets.length, tickText(v.packBuckets))} />
          )}
        </Section>

        <Section onOpen={() => open({ k: 'luck' })} title="Chance" sub="Cartes rares (☆ et plus) tirées contre attendues"
          insight={v.luck.packs ? <>{nf.format(v.luck.rareActual)} cartes rares pour {nf1.format(v.luck.rareExpected)} attendues sur {plural(v.luck.packs, 'pack')} (<b className={toneRatio}>{pf(v.luck.ratio, 0)}</b> de l’attendu){v.luck.skipped ? `. ${plural(v.luck.skipped, 'pack écarté', 'packs écartés')} : nombre de cartes incohérent` : ''}.</> : undefined}>
          {!v.luck.packs ? <Empty>Il faut des packs complets et des taux saisis.</Empty> : (
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

        <Section onOpen={() => open({ k: 'pulled' })} title="Raretés tirées" sub="Toutes les cartes de tes packs, même base que la chance"
          insight={pulledTotal ? <>{pf((v.pulled.D1 ?? 0) / pulledTotal, 0)} de simples ◊, et <b>{nf.format(rarePulled)}</b> cartes rares, soit une tous les {nf1.format(nPacks / Math.max(1, rarePulled))} packs.</> : undefined}>
          {!pulledTotal ? <Empty>Aucune carte tirée sur cette période.</Empty> : (
            <Donut slices={pulledSlices} ariaLabel="Répartition des raretés tirées" centerTop={nf.format(pulledTotal)} centerBottom="cartes tirées" onSelect={(k) => open({ k: 'pulled', rarity: k as Rarity })} />
          )}
        </Section>

        <Section onOpen={() => open({ k: 'packs' })} title="Boosters ouverts" sub="Packs ouverts par booster"
          insight={v.boosters[0] ? <>Booster favori : <b>{d.boosterById.get(v.boosters[0].boosterId)?.name ?? v.boosters[0].boosterId}</b> ({pf(v.boosters[0].count / Math.max(1, nPacks), 0)} des packs).</> : undefined}>
          {!v.boosters.length ? <Empty>Aucun pack sur cette période.</Empty> : (
            <>
              <ul className="st-rows stacked">
                {bigBoosters.map((b) => {
                  const bo = d.boosterById.get(b.boosterId);
                  return (
                    <li key={b.boosterId} className="link" title={`${bo?.name ?? b.boosterId} : ${b.count} packs`}>
                      <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'booster', boosterId: b.boosterId })}><span className="sr-only">{bo?.name ?? b.boosterId} : voir le détail</span></button>
                      <span className="who"><span className="st-emb"><BoosterEmblem boosterId={b.boosterId} small /></span><span className="nm"><small>{bo?.setId ?? setIdOf(b.boosterId)}</small> {bo?.name ?? b.boosterId}</span></span>
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

        <Section onOpen={() => open({ k: 'social' })} title="Partages et échanges" sub={`Par ${unit}`}
          insight={v.shares.length + v.trades.length ? <><b>{nf.format(v.shares.length)}</b> partages et <b>{nf.format(v.trades.length)}</b> échanges {periodLabel}.</> : undefined}>
          {!v.shares.length && !v.trades.length ? <Empty>Aucun partage ni échange sur cette période.</Empty> : (
            <>
              <Columns data={v.shareBuckets.map((p, i) => ({ label: p.start, tipLabel: bucketTip(p.start), values: [p.count, v.tradeBuckets[i]?.count ?? 0] }))}
                series={[{ name: 'Partages', color: 'var(--st-c3)' }, { name: 'Échanges', color: 'var(--st-c2)' }]} ariaLabel="Partages et échanges" xTicks={axisTicks(v.shareBuckets.length, tickText(v.shareBuckets))} />
              <p className="st-note"><i className="st-key" style={{ background: 'var(--st-c3)' }} /> partages <i className="st-key" style={{ background: 'var(--st-c2)' }} /> échanges</p>
            </>
          )}
        </Section>

        <Section wide onOpen={() => open({ k: 'best' })} title="Meilleurs tirages" sub="Tes plus belles cartes, de la plus rare à la plus récente"
          insight={v.god.length ? <><b>{plural(v.god.length, 'god pack', 'god packs')}</b> (toutes les cartes ☆ ou mieux), dernier le {dayLabel(dayKey(v.god[v.god.length - 1].date), true)}.</> : v.best.length ? <>Aucun god pack {periodLabel}.</> : undefined}>
          {!v.best.length ? <Empty>Pas encore de carte ☆☆ ou mieux sur cette période.</Empty> : (
            <ul className="st-best">
              {v.best.map((b, i) => {
                const card = d.cardById.get(b.cardId);
                if (!card) return null;
                return (
                  <li key={b.cardId + b.date + i} title={`${card.name} · ${dayLabel(dayKey(b.date), true)}`}>
                    <button type="button" className="st-thumbbtn" onClick={() => pick(card)} aria-label={`${card.name}, ${card.id}`}><Thumb card={card} /></button>
                    <span className="st-rbadge" style={{ background: rc(b.rarity) }}>{RARITY_LABEL[b.rarity]}</span>
                    <span className="nm">{card.name}</span>
                    <small>{dayLabel(dayKey(b.date))}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {!hasHistory && period !== 'all' && <p className="st-empty">Rien dans le journal sur cette période : essaie « Tout ».</p>}
      <p className="st-foot">
        Un pack = une saisie de 4 cartes ou plus. {v.partial > 0 ? `${plural(v.partial, 'saisie', 'saisies')} de 1 à 3 cartes (promos, ajouts isolés) ${v.partial > 1 ? 'ne sont' : 'n’est'} pas comptée${v.partial > 1 ? 's' : ''} ${periodLabel}. ` : ''}
        Les mises à jour de quantités (imports Pokémon-Zone, vidéo, corrections) comptent dans les nouvelles cartes, pas dans les packs.
      </p>
    </>
  );
}
