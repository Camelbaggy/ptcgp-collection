import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dismissNewSetNotices } from '../../lib/db';
import { estimatedBoosterIds, useNewSetNotices } from '../../lib/useData';
import {
  collectionTotals, packEvents,
  shareOffers, targetCardOptions, tradeOffers,
} from '../../lib/calc';
import { RARITY_LABEL } from '../../lib/useData';
import { OfferSheet, type OfferKind } from './OfferSheet';
import { BoosterBadge, BoosterEmblem, BoosterPackImage, SetBadge, SetLogo } from '../../components/Brand';
import { Icon } from '../../components/Icon';
import { CardDetail } from '../../components/CardDetail';
const EventDetail = lazy(() => import('../events/EventDetail'));
import { cardImageUrl } from '../../lib/db';
import type { Card } from '../../lib/types';
import { useEvents, useNow } from '../events/useEvents';
import { daysUntil, phase } from '../events/format';
import type { GameEvent } from '../../lib/events/parse';
import { useCalcData } from './useCalcData';
import { MONTHS_FR, num, packsLabel, pct } from './format';
import './dash.css';
import { isFullPack } from '../../lib/stats/packs';
import { usePzSnapshot } from '../../lib/pzProfile/store';
import { packsAfter } from '../../lib/pzProfile/baseline';
import { Welcome } from './Welcome';
import { BoosterSheets, type BoosterView } from './BoosterSheets';
import { useOpenSearch } from '../../components/globalSearchContext'
import { setIdOf } from '../../lib/setId'

export default function Dashboard() {
  const d = useCalcData();
  const notices = useNewSetNotices();
  const est = useMemo(() => estimatedBoosterIds(d.boosters, d.rates), [d.boosters, d.rates]);
  const [sheets, setSheets] = useState<BoosterView[]>([]);
  const [offerSheet, setOfferSheet] = useState<OfferKind | null>(null);
  const [cardOpen, setCardOpen] = useState<Card | null>(null);
  const openBooster = (boosterId: string) => setSheets([{ k: 'booster', boosterId }]);
  const pzStats = usePzSnapshot('stats');
  const openSearch = useOpenSearch();

  const view = useMemo(() => {
    if (d.loading) return null;
    const totals = collectionTotals(d.cards, d.owned);
    const topNew = [...d.analyses].sort((a, b) => b.legacyNew - a.legacyNew).filter((a) => a.legacyNew > 0).slice(0, 3);
    const targets = [...d.wishlist]
      .sort((a, b) => a.priority - b.priority)
      .map((w) => d.cardById.get(w.cardId))
      .filter((c): c is NonNullable<typeof c> => !!c && (d.owned.get(c.id) ?? 0) === 0)
      .slice(0, 8)
      .map((card) => ({ card, best: targetCardOptions(card, d.cards, d.rates)[0] }));
    const trade = tradeOffers(d.cards, d.owned);
    const share = shareOffers(d.cards, d.owned);
    // Avec un profil Pokémon-Zone importé : packs à vie (comme Stats › À vie), sinon packs saisis dans l'appli.
    const pzPacks = pzStats?.data.counters.find((c) => c.key === 'packs-opened')?.value;
    const packs = pzPacks != null && pzStats ? pzPacks + packsAfter(d.history, pzStats.fetchedAt).length : packEvents(d.history).filter(isFullPack).length;
    return { totals, topNew, targets, trade, share, packs, wishTotal: d.wishlist.length };
  }, [d, pzStats]);

  const bSet = (id: string) => d.boosterById.get(id)?.setId ?? setIdOf(id);
  const bName = (id: string) => {
    const b = d.boosterById.get(id);
    return b ? `${b.setId} · ${b.name}` : id;
  };

  if (!view) return <main className="ptc-page"><h1>Accueil</h1><p>Chargement…</p></main>;
  const { totals, topNew, targets, trade, share, packs, wishTotal } = view;
  const best = topNew[0];
  const alts = topNew.slice(1);
  // oxlint-disable-next-line react/purity -- date du jour affichée, recalculée à chaque rendu
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const missing = totals.total - totals.owned;
  const pctInt = (totals.pct * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <main className="ptc-page db">
      <header className="db-top">
        <h1>Bonjour&nbsp;!</h1>
        <p>{today}</p>
      </header>

      <button type="button" className="search-launch" onClick={openSearch}>
        <Icon name="search" />Rechercher une carte<kbd>Ctrl K</kbd>
      </button>

      <Welcome owned={totals.owned} />

      {notices.map((id) => {
        const set = d.sets.find((x) => x.id === id);
        if (!set) return null;
        const needCheck = d.boosters.some((b) => b.setId === id && est.has(b.id));
        return (
          <aside key={id} className="ptc-notice" role="status">
            <SetBadge setId={set.id} name={set.name} text={set.id} />
            <div className="main">
              <b>Nouvelle extension disponible : {set.name}</b>
              <small>{needCheck ? 'Taux estimés — à vérifier avec ceux du jeu.' : 'Taux d\'obtention livrés.'}</small>
            </div>
            <Link className="btn primary" to={`/extension/${encodeURIComponent(id)}/taux`}>{needCheck ? 'Vérifier les taux' : 'Voir les taux'}</Link>
            <button type="button" className="btn" onClick={() => { void dismissNewSetNotices([id]); }} aria-label="Masquer"><Icon name="close" /></button>
          </aside>
        );
      })}

      <div className="db-grid">
        <Link className="db-card db-hero" to="/collection" aria-label={`Ma collection : ${pctInt} %, ouvrir la collection`}>
          <div className="k">Ma collection<Icon name="chev" /></div>
          <div className="n">{pctInt}<small> %</small></div>
          <p>{num(totals.owned)} cartes sur {num(totals.total)}{missing > 0 ? ` — plus que ${num(missing)} à trouver !` : ' — collection complète !'}</p>
          <div className="track" role="progressbar" aria-label="Complétion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(totals.pct * 1000) / 10}><i style={{ width: `${Math.min(100, totals.pct * 100)}%` }} /></div>
          <div className="hs"><span>{pct(totals.pct2)} avec 2e copie</span><span>{num(packs)} packs ouverts</span></div>
        </Link>

        <Link className="db-card db-add" to="/ajout">
          <span className="bi"><Icon name="plus" /></span>
          <span><b>Ajouter un pack</b><span>Note tes dernières cartes</span></span>
        </Link>

        <section className="db-card db-next" style={{ '--c': 'var(--blue)' } as React.CSSProperties}>
          <h2><span className="tile-ic"><Icon name="pack" /></span>À ouvrir en premier</h2>
          {!best ? <p className="ptc-empty">Aucun booster avec des cartes manquantes (ou taux non saisis).</p> : (
            <>
              <button type="button" className="nb" onClick={() => openBooster(best.boosterId)} aria-label={`${d.boosterById.get(best.boosterId)?.name ?? best.boosterId} : voir les cartes manquantes`}>
                <span className="pk"><BoosterPackImage boosterId={best.boosterId} fallback={<span className="pk-ph"><SetLogo setId={bSet(best.boosterId)} fallback={<span>{bSet(best.boosterId)}</span>} /></span>} /></span>
                <span className="nb-main">
                  <b><BoosterBadge boosterId={best.boosterId} setId={bSet(best.boosterId)} estimated={est.has(best.boosterId)} text={d.boosterById.get(best.boosterId)?.name ?? best.boosterId} /></b>
                  <span>{best.total - best.owned} cartes manquantes · {pct(best.completion)} complété</span>
                  <span className="pctpill">{pct(best.legacyNew, 2)} de nouvelle carte</span>
                  <span className="sub">≈ {packsLabel(1 / best.legacyNew)} packs par nouvelle carte</span>
                </span>
              </button>
              {alts.length > 0 && (
                <div className="alts">
                  {alts.map((a) => (
                    <button type="button" key={a.boosterId} onClick={() => openBooster(a.boosterId)} aria-label={`${bName(a.boosterId)}, ${pct(a.legacyNew, 2)} : voir les cartes manquantes`}><BoosterPackImage boosterId={a.boosterId} className="sm" /><BoosterEmblem boosterId={a.boosterId} small /> <span className="alt-n">{bName(a.boosterId)}</span> <b>{pct(a.legacyNew, 2)}</b></button>
                  ))}
                </div>
              )}
            </>
          )}
          {d.analyses.length > 0 && <button type="button" className="more db-seemore" onClick={() => setSheets([{ k: 'list' }])}>Voir plus...<Icon name="chev" /></button>}
        </section>

        <section className="db-card db-wish" style={{ '--c': 'var(--pink)' } as React.CSSProperties}>
          <h2><span className="tile-ic"><Icon name="heart" /></span>Mes cartes visées<Link className="more" to="/souhaits">Tout voir<Icon name="chev" /></Link></h2>
          {targets.length === 0 ? (
            <p className="ptc-empty">{wishTotal > 0 ? 'Toutes tes cartes visées sont déjà dans la collection.' : 'Rien à viser pour le moment.'} <Link to="/souhaits">Ajouter des souhaits</Link></p>
          ) : (
            <ul className="strip">
              {targets.map(({ card, best: b }) => (
                <li key={card.id}>
                  <button type="button" className="wc" onClick={() => setCardOpen(card)} aria-haspopup="dialog" aria-label={`${card.name} ${card.id} : voir la carte`}>
                    <WishImg card={card} />
                    <b>{card.name}</b>
                    <small>{b ? <>meilleur booster : <BoosterBadge boosterId={b.boosterId} setId={bSet(b.boosterId)} logo={false} text={d.boosterById.get(b.boosterId)?.name ?? b.boosterId} /> {pct(b.p, 2)}</> : 'non disponible en booster'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <EventCard />

        <section className="db-card db-dup" style={{ '--c': 'var(--orange)' } as React.CSSProperties}>
          <h2><span className="tile-ic"><Icon name="swap" /></span>Échange/Partage</h2>
          <div className="dd">
            <button type="button" onClick={() => setOfferSheet('trade')} aria-haspopup="dialog"><b>{num(trade.length)}</b><span>échangeable{trade.length > 1 ? 's' : ''}</span></button>
            <button type="button" onClick={() => setOfferSheet('share')} aria-haspopup="dialog"><b>{num(share.length)}</b><span>partageable{share.length > 1 ? 's' : ''}</span></button>
          </div>
          {trade.length > 0 && (
            <>
              <h3 className="dd-k">Les plus rares à échanger</h3>
              <ul className="dd-top">
                {trade.slice(0, 8).map(({ card, quantity }) => (
                  <li key={card.id}>
                    <button type="button" className="wc" onClick={() => setOfferSheet('trade')} aria-label={`${card.name} ${card.id}, ${RARITY_LABEL[card.rarity]}, ${quantity} exemplaires`}>
                      <WishImg card={card} />
                      <span className="dd-q">×{quantity}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <nav className="db-links" aria-label="Aller plus loin">
        <Link to="/meta" style={{ '--c': 'var(--red)' } as React.CSSProperties}><span className="tile-ic"><Icon name="trophy" /></span><span className="grow"><b>Méta</b><small>Meilleurs decks du moment</small></span><Icon name="chev" /></Link>
        <Link to="/stats" style={{ '--c': 'var(--violet)' } as React.CSSProperties}><span className="tile-ic"><Icon name="chart" /></span><span className="grow"><b>Statistiques</b><small>Activité récente, historique et plus</small></span><Icon name="chev" /></Link>
        <Link to="/pokedex" style={{ '--c': 'var(--teal)' } as React.CSSProperties}><span className="tile-ic"><Icon name="book" /></span><span className="grow"><b>Pokédex</b><small>Ta collection par Pokémon</small></span><Icon name="chev" /></Link>
      </nav>
      <BoosterSheets d={d} stack={sheets} setStack={setSheets} />
      {cardOpen && <CardDetail card={d.cardById.get(cardOpen.id) ?? cardOpen} qty={d.owned.get(cardOpen.id) ?? 0} onClose={() => setCardOpen(null)} />}
      {offerSheet && <OfferSheet kind={offerSheet} list={offerSheet === 'trade' ? trade : share} onClose={() => setOfferSheet(null)} />}
    </main>
  );
}

function WishImg({ card }: { card: Card }) {
  const [broken, setBroken] = useState(false);
  return broken ? (
    <i className="wc-fb"><span>{card.name}</span><small>{card.id}</small></i>
  ) : (
    <i><img src={cardImageUrl(card)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /></i>
  );
}

function dateTile(iso: string) {
  const dt = new Date(iso);
  return { mon: MONTHS_FR[dt.getMonth()], day: dt.getDate() };
}

/** Carte « Évènement » : prochaine extension et évènement en cours ou à venir ; masquée sans données. */
function EventCard() {
  const { events } = useEvents();
  const now = useNow();
  const items = useMemo(() => {
    const next = events.filter((e) => e.type === 'expansion' && Date.parse(e.start) >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
    const reg = events.filter((e) => e.type !== 'expansion');
    const live = reg.filter((e) => phase(e, now) === 'live').sort((a, b) => a.end.localeCompare(b.end))[0];
    const soon = reg.filter((e) => phase(e, now) === 'soon').sort((a, b) => a.start.localeCompare(b.start))[0];
    const other = live ?? soon;
    return [next && { e: next, sub: expLabel(next, now) }, other && { e: other, sub: phase(other, now) === 'live' ? `Jusqu'au ${dateTile(other.end).day} ${dateTile(other.end).mon}` : `Dès le ${dateTile(other.start).day} ${dateTile(other.start).mon}`, live: !!live }]
      .filter((x): x is { e: GameEvent; sub: string; live?: boolean } => !!x);
  }, [events, now]);
  const [open, setOpen] = useState<GameEvent | null>(null);
  if (items.length === 0) return null;
  return (
    <section className="db-card db-event" style={{ '--c': 'var(--yellow)' } as React.CSSProperties} aria-label="Évènement">
      <h2><span className="tile-ic"><Icon name="cal" /></span>Évènement<Link className="more" to="/evenements">Programme<Icon name="chev" /></Link></h2>
      {items.map(({ e, sub, live }) => {
        const t = dateTile(e.type === 'expansion' || !live ? e.start : e.end);
        return (
          <button type="button" key={e.id} className="ev" onClick={() => setOpen(e)} aria-haspopup="dialog">
            <span className="date"><small>{t.mon}</small><b>{t.day}</b></span>
            <span className="grow">
              <b className="t1">{e.type === 'expansion' ? 'Prochaine extension' : e.name}</b>
              <span>{e.type === 'expansion' && !/extension/i.test(e.name) ? `${e.name} · ${sub}` : sub}{live ? ' · en cours' : ''}</span>
            </span>
          </button>
        );
      })}
      {open && <Suspense fallback={null}><EventDetail e={open} now={now} onClose={() => setOpen(null)} /></Suspense>}
    </section>
  );
}

function expLabel(e: GameEvent, now: number): string {
  const n = daysUntil(e.start, now);
  return n <= 0 ? "Aujourd'hui" : `Dans ${n} jour${n > 1 ? 's' : ''}`;
}
