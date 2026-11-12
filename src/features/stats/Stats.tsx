import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PERIODS, type Period, computeLifetime, dayLabel, todayKey } from '../../lib/stats';
import { buildStatsView } from './view';
import type { Card } from '../../lib/types';
import { usePersisted } from '../../lib/useData';
import { useCalcData } from '../dashboard/useCalcData';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { CardDetail } from '../../components/CardDetail';
import { nf } from './charts';
import { type Detail, type DetailCtx, DetailBody, detailTitle } from './details';
import { CollectionTab } from './CollectionTab';
import { ActivityTab } from './ActivityTab';
import { LifetimeTab } from './LifetimeTab';
import './stats.css';
import { usePzSnapshot } from '../../lib/pzProfile/store';

export type StatsTab = 'collection' | 'activite' | 'vie';
const TABS: { id: StatsTab; label: string; icon: 'cards' | 'chart' | 'trophy' }[] = [
  { id: 'collection', label: 'Collection', icon: 'cards' },
  { id: 'activite', label: 'Activité', icon: 'chart' },
  { id: 'vie', label: 'À vie', icon: 'trophy' },
];

export default function Stats() {
  const d = useCalcData();
  const [savedTab, setSavedTab] = usePersisted<StatsTab>('stats.tab', 'collection');
  const [params, setParams] = useSearchParams();
  const asked = params.get('onglet');
  // `?onglet=vie` (lien depuis Réglages › Profil, le guide Pokémon-Zone…) l'emporte sur l'onglet mémorisé
  const tab: StatsTab = TABS.some((t) => t.id === asked) ? asked as StatsTab : savedTab;
  const setTab = (t: StatsTab) => {
    setSavedTab(t);
    if (asked) setParams((p) => { const n = new URLSearchParams(p); n.delete('onglet'); return n; }, { replace: true });
  };
  const [period, setPeriod] = usePersisted<Period>('stats.period', '30');
  const [setId, setSetId] = usePersisted<string>('stats.set', '');
  // Pile de fiches de détail (la dernière est affichée) et carte ouverte par-dessus.
  const [stack, setStack] = useState<Detail[]>([]);
  const [cardOpen, setCardOpen] = useState<Card | null>(null);
  const today = todayKey();
  const pzStats = usePzSnapshot('stats');
  const pzHome = usePzSnapshot('home');

  const v = useMemo(() => (d.loading ? null : buildStatsView(d, period, setId, today)), [d, period, setId, today]);

  const life = useMemo(() => (pzStats && !d.loading
    ? computeLifetime({ fetchedAt: pzStats.fetchedAt, stats: pzStats.data, history: d.history, cards: d.cards, cardById: d.cardById, sets: d.sets, boosters: d.boosters })
    : null), [pzStats, d]);

  if (!v) return <main className="st" data-section="violet"><div className="st-wrap"><PageHeader icon="chart" title="Statistiques" /><p className="st-empty">Chargement…</p></div></main>;

  const setName = (id: string) => d.sets.find((s) => s.id === id)?.name ?? id;
  const boosterName = (id: string) => d.boosterById.get(id)?.name ?? id;
  const since = v.coverage.since;
  const periodLabel = period === 'all' ? (since ? `depuis le ${dayLabel(since, true)}` : 'depuis le début') : `sur ${period} jours`;
  const open = (x: Detail) => setStack((st) => [...st, x]);
  const ctx: DetailCtx = {
    d, today, from: v.from, period, periodLabel, sid: v.sid, cards: v.cards, packs: v.fullPacks, fullPacks: v.fullPacks, shares: v.shares, trades: v.trades,
    allPackDays: v.allPackDays, setName, boosterName,
  };
  const top = stack[stack.length - 1];
  const sub = tab === 'collection'
    ? <>État actuel : {nf.format(v.totals.owned)} cartes sur {nf.format(v.totals.total)}{v.sid ? ` dans ${setName(v.sid)}` : ''}.</>
    : tab === 'activite'
      ? <>Ce que tu as saisi dans l’appli, {periodLabel}{v.sid ? ` · ${setName(v.sid)}` : ''}.</>
      : <>Tout ton parcours, d’après Pokémon-Zone et l’appli.</>;

  return (
    <main className="st" data-section="violet">
      <div className="st-wrap">
        <div className="st-head">
          <PageHeader icon="chart" title="Statistiques" sub={sub} />
          <div className="st-tabs" role="tablist" aria-label="Vue">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}><Icon name={t.icon} />{t.label}</button>
            ))}
          </div>
          {tab !== 'vie' && (
            <div className="st-filters">
              {tab === 'activite' && (
                <div className="st-seg" role="group" aria-label="Période">
                  {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
                </div>
              )}
              <label className="st-select">
                <span className="sr-only">Extension</span>
                <select value={v.sid ?? ''} onChange={(e) => setSetId(e.target.value)} aria-label="Extension">
                  <option value="">Toutes les extensions</option>
                  {d.sets.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {tab === 'collection' && <CollectionTab d={d} v={v} open={open} setName={setName} pzHome={pzHome?.data ?? null} />}
        {tab === 'activite' && <ActivityTab d={d} v={v} period={period} periodLabel={periodLabel} open={open} pick={setCardOpen} life={life} />}
        {tab === 'vie' && <LifetimeTab d={d} life={life} home={pzHome?.data ?? null} coverage={v.coverage} open={open} setName={setName} />}
      </div>
      {top && (
        <Sheet title={detailTitle(top, ctx)} full onClose={() => { if (!cardOpen) setStack([]); }}>
          {stack.length > 1 && <button type="button" className="btn ghost st-back" onClick={() => setStack((st) => st.slice(0, -1))}><Icon name="chevl" />Retour</button>}
          <DetailBody x={top} c={ctx} open={open} pick={setCardOpen} />
        </Sheet>
      )}
      {cardOpen && <CardDetail card={d.cardById.get(cardOpen.id) ?? cardOpen} qty={d.owned.get(cardOpen.id) ?? 0} onClose={() => setCardOpen(null)} />}
    </main>
  );
}

