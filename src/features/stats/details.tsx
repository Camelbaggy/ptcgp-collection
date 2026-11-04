import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { BoosterEmblem, BoosterPackImage, SetLogo } from '../../components/Brand';
import { RARITY_LABEL, RARITY_ORDER, RARE_RARITIES, TRADE_RULES, completionByRarity, targetCardOptions } from '../../lib/calc';
import { cardImageUrl } from '../../lib/db';
import {
  type PackEv, addDays, bestPulls, byCardOrder, calendarWeeks, dayKey, dayLabel, diffDays, duplicateCards, findGodPacks, friendStats, luckSeries, luckSummary, luckVerdict,
  missingCards, newCardEvents, pulledByRarity, pulledCards, streakRuns, typeDistribution, typeFamily, weekdayHourGrid,
} from '../../lib/stats';
import type { Card, HistoryEvent, Rarity } from '../../lib/types';
import type { CalcData } from '../dashboard/useCalcData';
import { AreaChart, Empty, axisTicks, nf, nf1, pf } from './charts';

/** Ce que chaque tuile / section ouvre. */
export type Detail =
  | { k: 'completion' }
  | { k: 'packs' }
  | { k: 'streak' }
  | { k: 'social'; filter?: 'share' | 'trade' }
  | { k: 'stock'; filter?: 'trade' | 'share' | 'all' }
  | { k: 'missing'; rarity?: Rarity; setId?: string }
  | { k: 'luck' }
  | { k: 'pulled'; rarity?: Rarity }
  | { k: 'types'; type?: string }
  | { k: 'set'; setId: string }
  | { k: 'booster'; boosterId: string }
  | { k: 'best' };

/** Données déjà calculées par l'écran Stats (période et extension appliquées). */
export interface DetailCtx {
  d: CalcData;
  today: string;
  from: string;
  period: string;
  periodLabel: string;
  sid: string | null;
  cards: Card[];
  packs: PackEv[];
  fullPacks: PackEv[];
  shares: Extract<HistoryEvent, { kind: 'share' }>[];
  trades: Extract<HistoryEvent, { kind: 'trade' }>[];
  /** Jours d'ouverture (packs complets) sur tout l'historique de l'extension. */
  allPackDays: string[];
  /** Calendrier : premier jour affiché. */
  setName: (id: string) => string;
  boosterName: (id: string) => string;
}

export function detailTitle(x: Detail, c: DetailCtx): string {
  switch (x.k) {
    case 'completion': return 'Complétion';
    case 'packs': return 'Packs ouverts';
    case 'streak': return 'Série et régularité';
    case 'social': return x.filter === 'share' ? 'Partages' : x.filter === 'trade' ? 'Échanges' : 'Partages et échanges';
    case 'stock': return 'Doubles en stock';
    case 'missing': return x.rarity ? `Manquantes · ${RARITY_LABEL[x.rarity]}` : 'Cartes manquantes';
    case 'luck': return 'Chance';
    case 'pulled': return x.rarity ? `Tirées · ${RARITY_LABEL[x.rarity]}` : 'Raretés tirées';
    case 'types': return x.type ? `Type ${x.type}` : 'Types de Pokémon';
    case 'set': return c.setName(x.setId);
    case 'booster': return c.boosterName(x.boosterId);
    case 'best': return 'Meilleurs tirages';
  }
}

const rc = (r: Rarity) => `var(--st-r-${r})`;
const TYPE_COLOR: Record<string, string> = {
  Plante: 'var(--st-t-plante)', Feu: 'var(--st-t-feu)', Eau: 'var(--st-t-eau)', Électrique: 'var(--st-t-elec)', Psy: 'var(--st-t-psy)',
  Combat: 'var(--st-t-combat)', Obscurité: 'var(--st-t-obs)', Métal: 'var(--st-t-metal)', Dragon: 'var(--st-t-dragon)', Incolore: 'var(--st-t-inc)', Dresseur: 'var(--st-t-dresseur)',
};
const plural = (n: number, one: string, many = one + 's') => `${nf.format(n)} ${n > 1 ? many : one}`;
const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const timeLabel = (date: string) => `${dayLabel(dayKey(date), true)}${date.length >= 16 ? ' · ' + date.slice(11, 16) : ''}`;

/* ---------- briques ---------- */
interface PickProps { pick: (c: Card) => void }

function Mini({ card, badge, sub, dim, onPick, tone }: { card: Card; badge?: string; sub?: ReactNode; dim?: boolean; tone?: Rarity; onPick: (c: Card) => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" className={'sd-mini' + (dim ? ' dim' : '')} onClick={() => onPick(card)} aria-label={`${card.name}, ${card.id}${badge ? ', ' + badge : ''}`} title={`${card.name} · ${card.id}`}>
      {broken
        ? <span className="st-thumb fb"><b>{card.name}</b><small>{card.id}</small></span>
        : <img className="st-thumb" src={cardImageUrl(card)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />}
      {badge && <span className="sd-badge">{badge}</span>}
      {tone && <i className="sd-tone" style={{ background: rc(tone) }} />}
      {sub && <small className="sd-sub">{sub}</small>}
    </button>
  );
}

function Grid({ children, small }: { children: ReactNode; small?: boolean }) {
  return <div className={'sd-grid' + (small ? ' small' : '')}>{children}</div>;
}

/** Liste paginée : affiche `step` éléments puis « Voir plus ». */
function More<T>({ items, step = 30, render, wrap }: { items: T[]; step?: number; render: (x: T, i: number) => ReactNode; wrap?: (kids: ReactNode) => ReactNode }) {
  const [n, setN] = useState(step);
  const kids = items.slice(0, n).map(render);
  return (
    <>
      {wrap ? wrap(kids) : kids}
      {items.length > n && <button type="button" className="st-more" onClick={() => setN(n + step * 2)}>Voir plus ({nf.format(items.length - n)} restantes)</button>}
    </>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="sd-block"><h3>{title}</h3>{hint && <p className="sd-hint">{hint}</p>}{children}</section>;
}

function Facts({ items }: { items: { k: string; v: ReactNode; sub?: string }[] }) {
  return <dl className="sd-facts">{items.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}{f.sub && <small>{f.sub}</small>}</dd></div>)}</dl>;
}

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; n?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="sd-chips" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}{o.n !== undefined && <b>{nf.format(o.n)}</b>}</button>)}
    </div>
  );
}

/** Ligne cliquable avec barre : sert aux tableaux qui mènent à une autre fiche. */
function Row({ label, lead, value, sub, frac, color, onClick, aria }: { label: ReactNode; lead?: ReactNode; value: ReactNode; sub?: ReactNode; frac?: number; color?: string; onClick?: () => void; aria?: string }) {
  const inner = (
    <>
      <span className="who">{lead}<span className="nm">{label}</span></span>
      {frac !== undefined && <span className="bar"><i style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color ?? 'var(--st-accent)' }} /></span>}
      <span className="v"><b>{value}</b>{sub && <small>{sub}</small>}</span>
      {onClick && <Icon name="chev" className="chev" />}
    </>
  );
  return onClick
    ? <li><button type="button" className="sd-row" onClick={onClick} aria-haspopup="dialog" aria-label={aria}>{inner}</button></li>
    : <li><div className="sd-row">{inner}</div></li>;
}

function Heat({ level, title, className }: { level: number; title: string; className?: string }) {
  return <i className={'sd-cell l' + level + (className ? ' ' + className : '')} role="img" aria-label={title} title={title} />;
}
const levelOf = (n: number, max: number) => (n <= 0 ? 0 : max <= 1 ? 4 : Math.min(4, 1 + Math.floor((n / max) * 3.999)));

/* ---------- contenu ---------- */
interface BodyProps { x: Detail; c: DetailCtx; open: (x: Detail) => void; pick: (c: Card) => void }

export function DetailBody({ x, c, open, pick }: BodyProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.closest('.sheet-body')?.scrollTo?.(0, 0); }, [x]);
  return (
    <div ref={ref} className="sd" key={JSON.stringify(x)}>
      {x.k === 'completion' && <CompletionDetail c={c} open={open} pick={pick} />}
      {x.k === 'packs' && <PacksDetail c={c} open={open} pick={pick} />}
      {x.k === 'streak' && <StreakDetail c={c} />}
      {x.k === 'social' && <SocialDetail c={c} pick={pick} init={x.filter} />}
      {x.k === 'stock' && <StockDetail c={c} pick={pick} init={x.filter} />}
      {x.k === 'missing' && <MissingDetail c={c} pick={pick} init={x.rarity} setId={x.setId} />}
      {x.k === 'luck' && <LuckDetail c={c} open={open} />}
      {x.k === 'pulled' && <PulledDetail c={c} open={open} pick={pick} rarity={x.rarity} />}
      {x.k === 'types' && <TypesDetail c={c} open={open} pick={pick} type={x.type} />}
      {x.k === 'set' && <SetDetail c={c} open={open} pick={pick} setId={x.setId} />}
      {x.k === 'booster' && <BoosterDetail c={c} pick={pick} boosterId={x.boosterId} />}
      {x.k === 'best' && <BestDetail c={c} pick={pick} />}
    </div>
  );
}

function ScopeNote({ c, state }: { c: DetailCtx; state?: boolean }) {
  return <p className="sd-scope">{state ? 'État actuel de la collection' : `Période : ${c.periodLabel}`}{c.sid ? ` · extension ${c.sid}` : ''}</p>;
}

function CompletionDetail({ c, open, pick }: PickProps & { c: DetailCtx; open: (x: Detail) => void }) {
  const { d, cards } = c;
  const owned = d.owned;
  const total = cards.length, have = cards.filter((x) => (owned.get(x.id) ?? 0) > 0).length;
  const byRarity = useMemo(() => completionByRarity(cards, owned), [cards, owned]);
  const bySet = useMemo(() => d.sets.map((s) => ({ s, cs: cards.filter((x) => x.setId === s.id) })).filter((x) => x.cs.length).map(({ s, cs }) => {
    const o = cs.filter((x) => (owned.get(x.id) ?? 0) > 0).length;
    return { id: s.id, owned: o, total: cs.length, pct: o / cs.length };
  }), [d.sets, cards, owned]);
  const fresh = useMemo(() => newCardEvents(owned, d.history, { from: c.period === 'all' ? null : c.from, ids: new Set(cards.map((x) => x.id)) }), [owned, d.history, c.from, c.period, cards]);
  const missing = total - have;
  return (
    <>
      <ScopeNote c={c} state />
      <Facts items={[{ k: 'Possédées', v: nf.format(have), sub: `sur ${nf.format(total)}` }, { k: 'Complétion', v: pf(total ? have / total : 0, 1) }, { k: 'Manquantes', v: nf.format(missing) }, { k: `Nouvelles ${c.periodLabel}`, v: nf.format(fresh.length) }]} />
      {missing > 0 && <button type="button" className="st-more primary" onClick={() => open({ k: 'missing' })}>Voir les {nf.format(missing)} cartes manquantes<Icon name="chev" /></button>}
      {!c.sid && (
        <Block title="Par extension" hint="Touchez une extension pour son détail.">
          <ul className="sd-rows">
            {bySet.map((s) => <Row key={s.id} onClick={() => open({ k: 'set', setId: s.id })} aria={`${c.setName(s.id)}, voir le détail`}
              lead={<span className="st-logo"><SetLogo setId={s.id} name={c.setName(s.id)} small fallback={<b>{s.id}</b>} /></span>} label={c.setName(s.id)}
              value={pf(s.pct, 0)} sub={`${nf.format(s.owned)}/${nf.format(s.total)}`} frac={s.pct} color={s.pct >= 1 ? 'var(--st-good)' : undefined} />)}
          </ul>
        </Block>
      )}
      <Block title="Par rareté" hint="Touchez une rareté pour voir ses cartes manquantes.">
        <ul className="sd-rows">
          {RARITY_ORDER.filter((r) => byRarity[r]).map((r) => {
            const x = byRarity[r]!;
            return <Row key={r} onClick={x.total > x.owned ? () => open({ k: 'missing', rarity: r }) : undefined} aria={`${RARITY_LABEL[r]}, manquantes`}
              lead={<i className="st-dot" style={{ background: rc(r) }} />} label={RARITY_LABEL[r]} value={pf(x.pct, 0)} sub={`${nf.format(x.owned)}/${nf.format(x.total)}`} frac={x.pct} color={rc(r)} />;
          })}
        </ul>
      </Block>
      <Block title="Dernières nouvelles cartes" hint={`Première copie obtenue ${c.periodLabel}.`}>
        {!fresh.length ? <Empty>Aucune nouvelle carte sur cette période.</Empty> : (
          <More items={fresh} step={24} wrap={(k) => <Grid small>{k}</Grid>} render={(n, i) => {
            const card = d.cardById.get(n.cardId);
            return card ? <Mini key={n.cardId + i} card={card} onPick={pick} tone={card.rarity} sub={dayLabel(dayKey(n.date))} /> : null;
          }} />
        )}
      </Block>
    </>
  );
}

function PacksDetail({ c, open, pick }: PickProps & { c: DetailCtx; open: (x: Detail) => void }) {
  const { d, fullPacks } = c;
  const hm = useMemo(() => weekdayHourGrid(fullPacks.map((e) => e.date)), [fullPacks]);
  const byBooster = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of fullPacks) m.set(e.boosterId, (m.get(e.boosterId) ?? 0) + 1);
    return [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }, [fullPacks]);
  const hist = useMemo(() => [...fullPacks].sort((a, b) => b.date.localeCompare(a.date)), [fullPacks]);
  const maxDay = Math.max(1, ...hm.byWeekday);
  const topDay = hm.byWeekday.indexOf(Math.max(...hm.byWeekday));
  const topHour = hm.byHour.indexOf(Math.max(...hm.byHour));
  const perDay = fullPacks.length / Math.max(1, diffDays(c.from, c.today) + 1);
  const hours = [0, 6, 12, 18];
  return (
    <>
      <ScopeNote c={c} />
      <Facts items={[{ k: 'Packs complets', v: nf.format(fullPacks.length) }, { k: 'Par jour', v: nf1.format(perDay) }, { k: 'Boosters', v: nf.format(byBooster.length) }, { k: 'Cartes tirées', v: nf.format(fullPacks.reduce((s, e) => s + e.cardIds.length, 0)) }]} />
      {!fullPacks.length && <Empty>Aucun pack complet sur cette période.</Empty>}
      {fullPacks.length > 0 && (
        <>
          <Block title="Par booster" hint="Touchez un booster pour ses statistiques.">
            <ul className="sd-rows">
              {byBooster.map((b) => <Row key={b.id} onClick={() => open({ k: 'booster', boosterId: b.id })} aria={`${c.boosterName(b.id)}, voir le détail`}
                lead={<span className="st-emb"><BoosterEmblem boosterId={b.id} small /></span>} label={c.boosterName(b.id)} value={nf.format(b.n)} sub={pf(b.n / fullPacks.length, 0)} frac={b.n / byBooster[0].n} color="var(--st-c1)" />)}
            </ul>
          </Block>
          <Block title="Quand ouvrez-vous vos packs ?" hint={hm.withTime < hm.total ? `Heure connue pour ${nf.format(hm.withTime)} packs sur ${nf.format(hm.total)}.` : undefined}>
            <p className="sd-lead">Vous ouvrez surtout le <b>{WEEKDAYS[topDay]}</b>{hm.withTime > 0 && <> vers <b>{topHour} h</b></>}.</p>
            {hm.withTime > 0 && (
              <div className="sd-heat" role="group" aria-label="Packs ouverts par jour de la semaine et par heure">
                <span />
                {Array.from({ length: 24 }, (_, h) => <span key={h} className="hl">{hours.includes(h) ? h : ''}</span>)}
                {hm.grid.map((row, wd) => (
                  <div key={wd} className="sd-heat-row">
                    <span className="wl">{WEEKDAYS[wd].slice(0, 3)}.</span>
                    {row.map((n, h) => <Heat key={h} level={levelOf(n, hm.max)} title={`${WEEKDAYS[wd]} ${h} h : ${plural(n, 'pack')}`} />)}
                  </div>
                ))}
              </div>
            )}
            <ul className="sd-rows tight" aria-label="Packs par jour de la semaine">
              {WEEKDAYS.map((w, i) => <Row key={w} label={w[0].toUpperCase() + w.slice(1)} value={nf.format(hm.byWeekday[i])} frac={hm.byWeekday[i] / maxDay} color="var(--st-c1)" />)}
            </ul>
          </Block>
          <Block title="Historique des packs" hint="Du plus récent au plus ancien. Touchez une carte pour la voir.">
            <More items={hist} step={15} wrap={(k) => <ul className="sd-hist">{k}</ul>} render={(e) => (
              <li key={e.id}>
                <div className="sd-hist-h"><span className="st-emb"><BoosterEmblem boosterId={e.boosterId} small /></span><b>{c.boosterName(e.boosterId)}</b><small>{timeLabel(e.date)}</small></div>
                <div className="sd-strip">{e.cardIds.map((id, i) => { const card = d.cardById.get(id); return card ? <Mini key={id + i} card={card} onPick={pick} tone={card.rarity} /> : null; })}</div>
              </li>
            )} />
          </Block>
        </>
      )}
    </>
  );
}

function StreakDetail({ c }: { c: DetailCtx }) {
  const days = c.allPackDays;
  const runs = useMemo(() => streakRuns(days), [days]);
  const stats = useMemo(() => {
    const set = new Set(days);
    let cur = 0, d = set.has(c.today) ? c.today : addDays(c.today, -1);
    while (set.has(d)) { cur++; d = addDays(d, -1); }
    return { cur, longest: runs[0]?.length ?? 0, active: set.size };
  }, [days, runs, c.today]);
  const span = c.period === 'all' ? 365 : Math.max(91, diffDays(c.from, c.today) + 1);
  const calFrom = addDays(c.today, -(Math.min(span, 53 * 7) - 1));
  const weeks = useMemo(() => calendarWeeks(days, calFrom, c.today), [days, calFrom, c.today]);
  const max = Math.max(1, ...weeks.flat().map((x) => x.count));
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [weeks]);
  const inPeriodActive = new Set(days.filter((x) => x >= c.from)).size;
  const monthLabel = (i: number) => {
    const first = weeks[i][0].day;
    return i === 0 || first.slice(5, 7) !== weeks[i - 1][0].day.slice(5, 7) ? dayLabel(first).split(' ')[1] : '';
  };
  return (
    <>
      <p className="sd-scope">Séries calculées sur tout l'historique{c.sid ? ` · extension ${c.sid}` : ''} (packs complets)</p>
      <Facts items={[{ k: 'Série en cours', v: plural(stats.cur, 'jour') }, { k: 'Record', v: plural(stats.longest, 'jour') }, { k: 'Jours actifs', v: nf.format(stats.active), sub: 'au total' }, { k: `Actifs ${c.periodLabel}`, v: nf.format(inPeriodActive) }]} />
      <Block title="Calendrier d'activité" hint={`Chaque case est un jour ; plus elle est foncée, plus vous avez ouvert de packs (jusqu'à ${nf.format(max)}).`}>
        {!days.length ? <Empty>Aucune ouverture enregistrée.</Empty> : (
          <div className="sd-cal-wrap" ref={scroller}>
            <div className="sd-cal" role="group" aria-label="Calendrier des jours d'ouverture de packs">
              <div className="sd-cal-wd" aria-hidden><span />{['L', '', 'M', '', 'V', '', 'D'].map((l, i) => <span key={i}>{l}</span>)}</div>
              {weeks.map((w, i) => (
                <div key={w[0].day} className="sd-cal-col">
                  <span className="ml" aria-hidden>{monthLabel(i)}</span>
                  {w.map((x) => <Heat key={x.day} level={levelOf(x.count, max)} className={x.inRange ? '' : 'off'} title={`${dayLabel(x.day, true)} : ${x.inRange ? plural(x.count, 'pack') : 'hors période'}`} />)}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="st-note">Moins <Heat level={0} title="0" /><Heat level={1} title="peu" /><Heat level={2} title="moyen" /><Heat level={3} title="beaucoup" /><Heat level={4} title="max" /> Plus</p>
      </Block>
      <Block title="Plus longues séries">
        {!runs.length ? <Empty>Aucune série.</Empty> : (
          <ol className="sd-runs">
            {runs.slice(0, 6).map((r) => (
              <li key={r.start}><b>{plural(r.length, 'jour')}</b><span>{r.length === 1 ? dayLabel(r.start, true) : `${dayLabel(r.start)} → ${dayLabel(r.end, true)}`}</span>{(r.end === c.today || r.end === addDays(c.today, -1)) && <em>en cours</em>}</li>
            ))}
          </ol>
        )}
      </Block>
    </>
  );
}

function CardsOf({ ids, c, pick }: { ids: string[]; c: DetailCtx } & PickProps) {
  return <div className="sd-strip">{ids.map((id, i) => { const card = c.d.cardById.get(id); return card ? <Mini key={id + i} card={card} onPick={pick} tone={card.rarity} /> : <span key={i} className="sd-gone">{id}</span>; })}</div>;
}

function SocialDetail({ c, pick, init }: PickProps & { c: DetailCtx; init?: 'share' | 'trade' }) {
  const [f, setF] = useState<'all' | 'share' | 'trade'>(init ?? 'all');
  const evs = useMemo(() => [...(f === 'trade' ? [] : c.shares), ...(f === 'share' ? [] : c.trades)].sort((a, b) => b.date.localeCompare(a.date)), [c.shares, c.trades, f]);
  const friends = useMemo(() => friendStats([...c.shares, ...c.trades]), [c.shares, c.trades]);
  const given = c.shares.filter((e) => e.direction === 'given').length;
  return (
    <>
      <ScopeNote c={c} />
      <Facts items={[{ k: 'Partages', v: nf.format(c.shares.length), sub: `${nf.format(given)} donnés · ${nf.format(c.shares.length - given)} reçus` }, { k: 'Échanges', v: nf.format(c.trades.length) }, { k: 'Amis', v: nf.format(friends.length) }]} />
      <Chips label="Filtrer" value={f} onChange={setF} options={[{ id: 'all', label: 'Tout', n: c.shares.length + c.trades.length }, { id: 'share', label: 'Partages', n: c.shares.length }, { id: 'trade', label: 'Échanges', n: c.trades.length }]} />
      <Block title="Amis les plus actifs">
        {!friends.length ? <Empty>Aucun ami renseigné sur ces saisies. Indiquez l'ami en saisissant un partage ou un échange.</Empty> : (
          <ul className="sd-rows">{friends.slice(0, 8).map((x) => <Row key={x.friend} label={x.friend} value={nf.format(x.total)} sub={`${x.shares} part. · ${x.trades} éch.`} frac={x.total / friends[0].total} color="var(--st-c3)" />)}</ul>
        )}
      </Block>
      <Block title="Mouvements" hint="Du plus récent au plus ancien.">
        {!evs.length ? <Empty>Aucun mouvement sur cette période.</Empty> : (
          <More items={evs} step={15} wrap={(k) => <ul className="sd-hist">{k}</ul>} render={(e) => (
            <li key={e.id}>
              <div className="sd-hist-h">
                <b>{e.kind === 'share' ? (e.direction === 'given' ? 'Partage donné' : 'Partage reçu') : 'Échange'}</b>
                {e.friend && <span className="sd-friend">avec {e.friend}</span>}
                <small>{timeLabel(e.date)}</small>
              </div>
              {e.kind === 'share' ? <CardsOf ids={[e.cardId]} c={c} pick={pick} /> : (
                <div className="sd-trade"><CardsOf ids={[e.given]} c={c} pick={pick} /><span aria-label="contre"><Icon name="swap" /></span><CardsOf ids={[e.received]} c={c} pick={pick} /></div>
              )}
            </li>
          )} />
        )}
      </Block>
    </>
  );
}

function StockDetail({ c, pick, init }: PickProps & { c: DetailCtx; init?: 'trade' | 'share' | 'all' }) {
  const [f, setF] = useState<'trade' | 'share' | 'all'>(init ?? 'trade');
  const all = useMemo(() => duplicateCards(c.cards, c.d.owned), [c.cards, c.d.owned]);
  const rows = useMemo(() => all.filter((x) => f === 'all' || (f === 'trade' ? x.tradeable : x.shareable)), [all, f]);
  const groups = useMemo(() => RARITY_ORDER.map((r) => ({ r, items: rows.filter((x) => x.card.rarity === r) })).filter((g) => g.items.length), [rows]);
  const spare = (xs: typeof all) => xs.reduce((s, x) => s + x.spare, 0);
  const lab = (rs: Rarity[]) => rs.map((r) => RARITY_LABEL[r]).join(', ');
  return (
    <>
      <ScopeNote c={c} state />
      <Facts items={[{ k: 'Doubles', v: nf.format(spare(all)), sub: `${nf.format(all.length)} cartes` }, { k: 'Échangeables', v: nf.format(spare(all.filter((x) => x.tradeable))) }, { k: 'Partageables', v: nf.format(spare(all.filter((x) => x.shareable))) }]} />
      <Chips label="Filtrer" value={f} onChange={setF} options={[
        { id: 'trade', label: 'Échangeables', n: all.filter((x) => x.tradeable).length }, { id: 'share', label: 'Partageables', n: all.filter((x) => x.shareable).length }, { id: 'all', label: 'Tous', n: all.length }]} />
      <p className="sd-hint">Échangeable : {lab(TRADE_RULES.tradableRarities)} avec au moins {TRADE_RULES.minQuantityToOffer} exemplaires. Partageable : {TRADE_RULES.shareableRarities === 'all' ? 'toutes les raretés' : lab(TRADE_RULES.shareableRarities)}. Le badge indique la quantité possédée.</p>
      {!groups.length ? <Empty>Aucune carte dans cette catégorie.</Empty> : groups.map((g) => (
        <Block key={g.r} title={`${RARITY_LABEL[g.r]} · ${plural(spare(g.items), 'double')}`}>
          <Grid small>{g.items.map((x) => <Mini key={x.card.id} card={x.card} badge={`×${x.qty}`} onPick={pick} sub={`+${x.spare}`} />)}</Grid>
        </Block>
      ))}
    </>
  );
}

function MissingDetail({ c, pick, init, setId }: PickProps & { c: DetailCtx; init?: Rarity; setId?: string }) {
  const { d } = c;
  const pool = useMemo(() => (setId ? c.cards.filter((x) => x.setId === setId) : c.cards), [c.cards, setId]);
  const miss = useMemo(() => missingCards(pool, d.owned).sort((a, b) => Number(a.boosterIds.length === 0) - Number(b.boosterIds.length === 0) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || byCardOrder(a, b)), [pool, d.owned]);
  const counts = useMemo(() => RARITY_ORDER.map((r) => ({ r, n: miss.filter((x) => x.rarity === r).length })).filter((x) => x.n), [miss]);
  const [sel, setSel] = useState<Rarity | 'all'>(init ?? 'all');
  const list = sel === 'all' ? miss : miss.filter((x) => x.rarity === sel);
  const [n, setN] = useState(24);
  const shown = list.slice(0, n);
  // Meilleur booster calculé seulement pour les cartes affichées.
  const best = useMemo(() => shown.map((card) => ({ card, o: targetCardOptions(card, d.cards, d.rates)[0] })), [shown, d.cards, d.rates]);
  return (
    <>
      <ScopeNote c={c} state />
      {setId && <p className="sd-lead">{c.setName(setId)}</p>}
      {!miss.length ? <Empty>Rien ne manque. Bravo !</Empty> : (
        <>
          <Chips label="Rareté" value={sel} onChange={(v) => { setSel(v); setN(24); }} options={[{ id: 'all', label: 'Toutes', n: miss.length }, ...counts.map((x) => ({ id: x.r, label: RARITY_LABEL[x.r], n: x.n }))]} />
          <p className="sd-hint">Pour chaque carte : le booster où elle sort le plus souvent, la chance par pack et le nombre de packs attendu pour la première copie.</p>
          <ul className="sd-miss">
            {best.map(({ card, o }) => (
              <li key={card.id}>
                <Mini card={card} onPick={pick} tone={card.rarity} />
                <div className="info">
                  <b>{card.name}</b>
                  <small>{card.id} · {RARITY_LABEL[card.rarity]}</small>
                  {o ? <span className="bst"><span className="st-emb"><BoosterEmblem boosterId={o.boosterId} small /></span>{c.boosterName(o.boosterId)}</span> : <span className="bst none">Aucun booster connu</span>}
                  {o && <small>{o.p >= 0.001 ? pf(o.p, o.p < 0.1 ? 1 : 0) : '< 0,1 %'} par pack · ≈ {nf.format(Math.round(o.packs))} packs</small>}
                </div>
              </li>
            ))}
          </ul>
          {list.length > n && <button type="button" className="st-more" onClick={() => setN(n + 48)}>Voir plus ({nf.format(list.length - n)} restantes)</button>}
        </>
      )}
    </>
  );
}

function LuckDetail({ c, open }: { c: DetailCtx; open: (x: Detail) => void }) {
  const { d, fullPacks } = c;
  const lk = useMemo(() => luckSummary(fullPacks, d.cardById, d.rates), [fullPacks, d.cardById, d.rates]);
  const series = useMemo(() => luckSeries(fullPacks, d.cardById, d.rates), [fullPacks, d.cardById, d.rates]);
  const perBooster = useMemo(() => {
    const ids = [...new Set(fullPacks.map((e) => e.boosterId))];
    return ids.map((id) => { const s = luckSummary(fullPacks.filter((e) => e.boosterId === id), d.cardById, d.rates); return { id, s }; }).filter((x) => x.s.packs > 0).sort((a, b) => b.s.packs - a.s.packs);
  }, [fullPacks, d.cardById, d.rates]);
  if (!lk.packs) return <Empty>Il faut des packs complets (4 cartes ou plus) et des taux saisis sur cette période.</Empty>;
  const ratioTone = (r: number) => (r >= 1 ? 'ok' : 'bad');
  return (
    <>
      <ScopeNote c={c} />
      <Facts items={[{ k: 'Verdict', v: luckVerdict(lk.percentile), sub: `mieux que ${nf.format(Math.round(lk.percentile))} % des joueurs` }, { k: 'Rares tirées', v: nf.format(lk.rareActual), sub: `${nf1.format(lk.rareExpected)} attendues` }, { k: 'Packs analysés', v: nf.format(lk.packs) }, { k: 'Écart', v: <span className={ratioTone(lk.ratio)}>{pf(lk.ratio, 0)}</span>, sub: 'de l\'attendu' }]} />
      <Block title="Tirées contre attendues" hint="Pour chaque rareté rare : combien vous en avez tirées, combien le jeu en donne en moyenne sur autant de packs.">
        <div className="sd-table" role="table" aria-label="Raretés tirées contre attendues">
          <div className="th" role="row"><span role="columnheader">Rareté</span><span role="columnheader">Tirées</span><span role="columnheader">Attendues</span><span role="columnheader">Réel / attendu</span></div>
          {lk.rows.filter((r) => r.expected > 0 || r.actual > 0).map((r) => (
            <div key={r.rarity} className="tr" role="row">
              <span role="cell"><i className="st-dot" style={{ background: rc(r.rarity) }} /> {RARITY_LABEL[r.rarity]}</span>
              <span role="cell"><b>{nf.format(r.actual)}</b></span><span role="cell">{nf1.format(r.expected)}</span>
              <span role="cell" className={r.expected ? ratioTone(r.ratio) : ''}><b>{r.expected ? pf(r.ratio, 0) : '–'}</b></span>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Chance au fil des packs" hint="Percentile cumulé : 50 = dans la moyenne, plus haut = plus de chance.">
        {series.length < 2 ? <Empty>Pas assez de packs pour tracer la courbe.</Empty> : (
          <AreaChart data={series.map((p) => ({ x: p.date, y: p.percentile, label: `Pack ${p.packs} · ${dayLabel(dayKey(p.date), true)}` }))} yMin={0} yMax={100}
            ariaLabel={`Percentile de chance cumulé, de ${nf.format(Math.round(series[0].percentile))} à ${nf.format(Math.round(series[series.length - 1].percentile))}`} yFormat={(y) => nf.format(Math.round(y))}
            tipValue={(p) => `${nf.format(Math.round(p.y))}e percentile`} xTicks={axisTicks(series.length, (i) => dayLabel(dayKey(series[i].date)))} height={180} />
        )}
      </Block>
      {perBooster.length > 1 && (
        <Block title="Par booster" hint="Touchez un booster pour son détail.">
          <ul className="sd-rows">
            {perBooster.map(({ id, s }) => <Row key={id} onClick={() => open({ k: 'booster', boosterId: id })} aria={`${c.boosterName(id)}, voir le détail`} lead={<span className="st-emb"><BoosterEmblem boosterId={id} small /></span>}
              label={c.boosterName(id)} value={pf(s.ratio, 0)} sub={`${nf.format(s.packs)} packs`} frac={Math.min(1, s.ratio / 2)} color={s.ratio >= 1 ? 'var(--st-good)' : 'var(--st-bad)'} />)}
          </ul>
        </Block>
      )}
      <Block title="Méthode">
        <p className="sd-prose">Pour chaque pack complet (4 cartes ou plus) d'un booster dont les taux sont saisis, on additionne le nombre attendu de cartes de chaque rareté rare ({RARE_RARITIES.map((r) => RARITY_LABEL[r]).join(', ')}) et sa variance, d'après la répartition par emplacement. On compare ensuite au réel : l'écart, ramené à l'écart-type, donne un score z que l'on convertit en percentile (loi normale). C'est une approximation : peu de packs, ou des taux manquants, rendent le résultat fragile. Les saisies de moins de 4 cartes sont ignorées.</p>
      </Block>
    </>
  );
}

function PulledDetail({ c, open, pick, rarity }: PickProps & { c: DetailCtx; open: (x: Detail) => void; rarity?: Rarity }) {
  const { d, packs } = c;
  const pulled = useMemo(() => pulledByRarity(packs, d.cardById), [packs, d.cardById]);
  const total = Object.values(pulled).reduce((s, n) => s + (n ?? 0), 0);
  const list = useMemo(() => pulledCards(packs, d.cardById, (x) => !rarity || x.rarity === rarity), [packs, d.cardById, rarity]);
  const copies = list.reduce((s, x) => s + x.count, 0);
  return (
    <>
      <ScopeNote c={c} />
      {!rarity ? (
        <>
          <Facts items={[{ k: 'Cartes tirées', v: nf.format(total) }, { k: 'Différentes', v: nf.format(list.length) }, { k: 'Packs', v: nf.format(packs.length) }]} />
          <Block title="Par rareté" hint="Touchez une rareté pour voir les cartes tirées.">
            <ul className="sd-rows">
              {RARITY_ORDER.filter((r) => pulled[r]).map((r) => <Row key={r} onClick={() => open({ k: 'pulled', rarity: r })} aria={`${RARITY_LABEL[r]}, voir les cartes`} lead={<i className="st-dot" style={{ background: rc(r) }} />}
                label={RARITY_LABEL[r]} value={nf.format(pulled[r]!)} sub={pf(pulled[r]! / Math.max(1, total), 1)} frac={pulled[r]! / Math.max(1, ...Object.values(pulled).map((n) => n ?? 0))} color={rc(r)} />)}
            </ul>
          </Block>
          <Block title="Cartes les plus tirées">
            {!list.length ? <Empty>Aucune carte tirée.</Empty> : <Grid small>{list.slice(0, 12).map((x) => <Mini key={x.card.id} card={x.card} badge={`×${x.count}`} onPick={pick} tone={x.card.rarity} />)}</Grid>}
          </Block>
        </>
      ) : (
        <>
          <Facts items={[{ k: 'Tirages', v: nf.format(copies) }, { k: 'Cartes différentes', v: nf.format(list.length) }, { k: 'Part des tirages', v: pf(copies / Math.max(1, total), 1) }]} />
          {!list.length ? <Empty>Aucune carte de cette rareté sur la période.</Empty> : (
            <More items={list} step={30} wrap={(k) => <Grid small>{k}</Grid>} render={(x) => <Mini key={x.card.id} card={x.card} badge={`×${x.count}`} sub={dayLabel(dayKey(x.last))} onPick={pick} />} />
          )}
          <p className="sd-hint">Le badge indique combien de fois la carte est sortie, la date est le dernier tirage.</p>
        </>
      )}
    </>
  );
}

function TypesDetail({ c, open, pick, type }: PickProps & { c: DetailCtx; open: (x: Detail) => void; type?: string }) {
  const { d } = c;
  const dist = useMemo(() => typeDistribution(c.cards, d.owned), [c.cards, d.owned]);
  const [f, setF] = useState<'all' | 'have' | 'miss'>('all');
  const cs = useMemo(() => (type ? c.cards.filter((x) => typeFamily(x.type) === type).sort(byCardOrder) : []), [c.cards, type]);
  const rows = cs.filter((x) => f === 'all' || ((d.owned.get(x.id) ?? 0) > 0) === (f === 'have'));
  if (!type) {
    return (
      <>
        <ScopeNote c={c} state />
        <Block title="Par type" hint="Touchez un type pour ses cartes, possédées ou non.">
          <ul className="sd-rows">
            {dist.map((t) => <Row key={t.type} onClick={() => open({ k: 'types', type: t.type })} aria={`${t.type}, voir les cartes`} lead={<i className="st-dot" style={{ background: TYPE_COLOR[t.type] ?? 'var(--st-t-inc)' }} />}
              label={t.type} value={nf.format(t.owned)} sub={`/ ${nf.format(t.total)} · ${pf(t.total ? t.owned / t.total : 0, 0)}`} frac={t.total ? t.owned / t.total : 0} color={TYPE_COLOR[t.type]} />)}
          </ul>
        </Block>
      </>
    );
  }
  const have = cs.filter((x) => (d.owned.get(x.id) ?? 0) > 0).length;
  return (
    <>
      <ScopeNote c={c} state />
      <Facts items={[{ k: 'Possédées', v: nf.format(have), sub: `sur ${nf.format(cs.length)}` }, { k: 'Complétion', v: pf(cs.length ? have / cs.length : 0, 0) }, { k: 'Manquantes', v: nf.format(cs.length - have) }]} />
      <Chips label="Filtrer" value={f} onChange={setF} options={[{ id: 'all', label: 'Toutes', n: cs.length }, { id: 'have', label: 'Possédées', n: have }, { id: 'miss', label: 'Manquantes', n: cs.length - have }]} />
      {!rows.length ? <Empty>Aucune carte.</Empty> : <More items={rows} step={36} wrap={(k) => <Grid small>{k}</Grid>} render={(x) => { const q = d.owned.get(x.id) ?? 0; return <Mini key={x.id} card={x} dim={q <= 0} badge={q > 1 ? `×${q}` : undefined} onPick={pick} tone={x.rarity} />; }} />}
      <p className="sd-hint">Les cartes grisées sont celles que vous n'avez pas encore.</p>
    </>
  );
}

function SetDetail({ c, open, pick, setId }: PickProps & { c: DetailCtx; open: (x: Detail) => void; setId: string }) {
  const { d } = c;
  const cs = useMemo(() => d.cards.filter((x) => x.setId === setId), [d.cards, setId]);
  const byR = useMemo(() => completionByRarity(cs, d.owned), [cs, d.owned]);
  const have = cs.filter((x) => (d.owned.get(x.id) ?? 0) > 0).length;
  const have2 = cs.filter((x) => (d.owned.get(x.id) ?? 0) > 1).length;
  const miss = useMemo(() => missingCards(cs, d.owned), [cs, d.owned]);
  const boosters = d.boosters.filter((b) => b.setId === setId && !b.entryOnly);
  const nPacks = c.fullPacks.filter((e) => (d.boosterById.get(e.boosterId)?.setId ?? e.boosterId.split('-')[0]) === setId).length;
  return (
    <>
      <p className="sd-scope">État actuel · packs {c.periodLabel}</p>
      <Facts items={[{ k: 'Possédées', v: nf.format(have), sub: `sur ${nf.format(cs.length)}` }, { k: 'Complétion', v: pf(cs.length ? have / cs.length : 0, 1) }, { k: '2 exemplaires ou +', v: pf(cs.length ? have2 / cs.length : 0, 0) }, { k: 'Packs ouverts', v: nf.format(nPacks) }]} />
      <Block title="Par rareté" hint="Touchez une rareté pour ses cartes manquantes dans cette extension.">
        <ul className="sd-rows">
          {RARITY_ORDER.filter((r) => byR[r]).map((r) => { const x = byR[r]!; return (
            <Row key={r} onClick={x.total > x.owned ? () => open({ k: 'missing', rarity: r, setId }) : undefined} aria={`${RARITY_LABEL[r]}, manquantes`} lead={<i className="st-dot" style={{ background: rc(r) }} />}
              label={RARITY_LABEL[r]} value={pf(x.pct, 0)} sub={`${nf.format(x.owned)}/${nf.format(x.total)}`} frac={x.pct} color={rc(r)} />); })}
        </ul>
      </Block>
      {boosters.length > 0 && (
        <Block title="Boosters de l'extension">
          <ul className="sd-rows">
            {boosters.map((b) => <Row key={b.id} onClick={() => open({ k: 'booster', boosterId: b.id })} aria={`${b.name}, voir le détail`} lead={<span className="st-emb"><BoosterEmblem boosterId={b.id} small /></span>} label={b.name}
              value={nf.format(c.fullPacks.filter((e) => e.boosterId === b.id).length)} sub="packs" />)}
          </ul>
        </Block>
      )}
      <Block title={`Cartes manquantes (${nf.format(miss.length)})`}>
        {!miss.length ? <Empty>Extension complète !</Empty> : (
          <>
            <More items={miss} step={24} wrap={(k) => <Grid small>{k}</Grid>} render={(x) => <Mini key={x.id} card={x} onPick={pick} tone={x.rarity} />} />
            <button type="button" className="st-more" onClick={() => open({ k: 'missing', setId })}>Meilleurs boosters pour ces cartes<Icon name="chev" /></button>
          </>
        )}
      </Block>
    </>
  );
}

function BoosterDetail({ c, pick, boosterId }: PickProps & { c: DetailCtx; boosterId: string }) {
  const { d } = c;
  const bo = d.boosterById.get(boosterId);
  const packs = useMemo(() => c.fullPacks.filter((e) => e.boosterId === boosterId), [c.fullPacks, boosterId]);
  const pulled = useMemo(() => pulledByRarity(packs, d.cardById), [packs, d.cardById]);
  const lk = useMemo(() => luckSummary(packs, d.cardById, d.rates), [packs, d.cardById, d.rates]);
  const an = d.analyses.find((a) => a.boosterId === boosterId);
  const miss = useMemo(() => missingCards(d.cards, d.owned, { boosterId }), [d.cards, d.owned, boosterId]);
  const total = Object.values(pulled).reduce((s, n) => s + (n ?? 0), 0);
  const last = packs.reduce((m, e) => (e.date > m ? e.date : m), '');
  const setId = bo?.setId ?? boosterId.split('-')[0];
  const expectedBy = new Map(lk.rows.map((r) => [r.rarity, r]));
  return (
    <>
      <ScopeNote c={c} />
      <p className="sd-lead"><BoosterPackImage boosterId={boosterId} className="lead" /><span className="st-emb"><BoosterEmblem boosterId={boosterId} small /></span> {c.setName(setId)}</p>
      <Facts items={[{ k: 'Packs complets', v: nf.format(packs.length), sub: c.fullPacks.length ? pf(packs.length / c.fullPacks.length, 0) + ' des packs' : undefined }, { k: 'Cartes tirées', v: nf.format(total) },
        { k: 'Dernier pack', v: last ? dayLabel(dayKey(last), true) : '–' }, ...(an ? [{ k: 'Nouvelle carte / pack', v: pf(an.pNew, 0), sub: `≈ ${nf1.format(an.packsNew)} packs pour une nouvelle` }] : [])]} />
      {an && <Facts items={[{ k: 'Complétion du booster', v: pf(an.completion, 1), sub: `${nf.format(an.owned)}/${nf.format(an.total)} cartes` }, { k: '2 exemplaires ou +', v: pf(an.completion2, 0) }]} />}
      <Block title="Tirées par rareté" hint={lk.packs ? 'Les raretés rares montrent aussi l\'attendu d\'après les taux saisis.' : 'Pas de taux saisis pour comparer à l\'attendu.'}>
        {!total ? <Empty>Aucun pack complet de ce booster sur la période.</Empty> : (
          <ul className="sd-rows">
            {RARITY_ORDER.filter((r) => pulled[r]).map((r) => {
              const e = expectedBy.get(r);
              return <Row key={r} lead={<i className="st-dot" style={{ background: rc(r) }} />} label={RARITY_LABEL[r]}
                value={nf.format(pulled[r]!)} sub={e && e.expected > 0 ? `attendu ${nf1.format(e.expected)}` : pf(pulled[r]! / total, 0)} frac={pulled[r]! / Math.max(1, ...Object.values(pulled).map((n) => n ?? 0))} color={rc(r)} />;
            })}
          </ul>
        )}
      </Block>
      {lk.packs > 0 && <p className="sd-lead">Chance sur ce booster : <b>{luckVerdict(lk.percentile)}</b> ({pf(lk.ratio, 0)} de l'attendu en cartes rares).</p>}
      <Block title={`Cartes manquantes dans ce booster (${nf.format(miss.length)})`}>
        {!miss.length ? <Empty>Vous avez toutes les cartes de ce booster.</Empty> : (
          <More items={miss} step={24} wrap={(k) => <Grid small>{k}</Grid>} render={(x) => <Mini key={x.id} card={x} onPick={pick} tone={x.rarity} />} />
        )}
      </Block>
    </>
  );
}

function BestDetail({ c, pick }: PickProps & { c: DetailCtx }) {
  const { d, packs } = c;
  const best = useMemo(() => bestPulls(packs, d.cardById, 500), [packs, d.cardById]);
  const god = useMemo(() => findGodPacks(c.fullPacks, d.cardById).reverse(), [c.fullPacks, d.cardById]);
  return (
    <>
      <ScopeNote c={c} />
      <Facts items={[{ k: 'Belles cartes', v: nf.format(best.length), sub: '☆☆ et mieux' }, { k: 'Packs rares', v: nf.format(god.length), sub: 'toutes cartes rares' }]} />
      <Block title="Toutes les belles cartes" hint="De la plus rare à la plus récente.">
        {!best.length ? <Empty>Pas encore de carte ☆☆ ou mieux sur cette période.</Empty> : (
          <More items={best} step={30} wrap={(k) => <Grid small>{k}</Grid>} render={(b, i) => { const card = d.cardById.get(b.cardId); return card ? <Mini key={b.cardId + b.date + i} card={card} tone={b.rarity} sub={dayLabel(dayKey(b.date))} onPick={pick} /> : null; }} />
        )}
      </Block>
      {god.length > 0 && (
        <Block title="Packs entièrement rares">
          <ul className="sd-hist">
            {god.map((g) => <li key={g.id}><div className="sd-hist-h"><span className="st-emb"><BoosterEmblem boosterId={g.boosterId} small /></span><b>{c.boosterName(g.boosterId)}</b><small>{timeLabel(g.date)}</small></div><CardsOf ids={g.cardIds} c={c} pick={pick} /></li>)}
          </ul>
        </Block>
      )}
    </>
  );
}
