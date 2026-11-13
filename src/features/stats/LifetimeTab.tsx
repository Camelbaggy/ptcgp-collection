import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BoosterEmblem, SetLogo } from '../../components/Brand';
import { Icon } from '../../components/Icon';
import { Rarity as RarityGlyph } from '../../components/Rarity'
import { RARITY_LABEL, RARE_RARITIES } from '../../lib/calc';
import { type JournalCoverage, type Lifetime, type LifetimeBar, dayLabel } from '../../lib/stats';
import { pzSetToSetId } from '../../lib/pzProfile/baseline';
import type { PzHome } from '../../lib/pzProfile/types';
import type { CalcData } from '../dashboard/useCalcData';
import { Donut, Empty, Section, StackBar, nf, nf1, pf } from './charts';
import type { Detail } from './details';
import { PzStatsSync } from './PzStatsSync';
import { GameAccount } from './GameAccount';
import { TYPE_COLOR, plural, rc } from './shared';

interface Props { d: CalcData; life: Lifetime | null; home: PzHome | null; coverage: JournalCoverage; open: (x: Detail) => void; setName: (id: string) => string }

const KPI_KEYS = new Set(['packs-opened', 'cards-obtained', 'unique-cards-obtained', 'days-played', 'wonder-picks', 'trades', 'cards-given'])
const rankText = (r?: { rank: number; of: number; topPct: number }) => (r ? `#${nf.format(r.rank)} sur ${nf.format(r.of)} · top ${nf.format(r.topPct)} %` : null);

function Bars({ list, color, limit = 12 }: { list: LifetimeBar[]; color: (label: string) => string; limit?: number }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...list.map((b) => b.value));
  const shown = all ? list : list.slice(0, limit);
  return (
    <>
      <ul className="st-rows tight" data-content-start="">
        {shown.map((b) => (
          <li key={b.label} title={`${b.label} : ${nf.format(b.value)} exemplaires${b.unique ? `, ${nf.format(b.unique)} différentes` : ''}`}>
            <span className="who"><i className="st-dot" style={{ background: color(b.label) }} /><span className="nm">{b.label}</span></span>
            <span className="bar thin"><i className="st-grow-x" style={{ width: `${(b.value / max) * 100}%`, background: color(b.label) }} /></span>
            <span className="v"><b>{nf.format(b.value)}</b>{b.unique ? <small>{nf.format(b.unique)} diff.</small> : null}</span>
          </li>
        ))}
      </ul>
      {list.length > limit && <button type="button" className="st-more" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Tout voir (${list.length})`}</button>}
    </>
  );
}

/** Onglet « À vie » : instantané Pokémon-Zone + packs saisis depuis l'import. */
export function LifetimeTab({ d, life, home, coverage, open, setName }: Props) {
  const [allBoosters, setAllBoosters] = useState(false);
  if (!life) {
    return (
      <>
        <PzStatsSync fetchedAt={null} />
        <section className="st-card st-cta">
          <h2>Tes statistiques depuis ton tout premier pack</h2>
          <p>Le journal de l’appli ne connaît que ce que tu y saisis{coverage.since ? ` (depuis le ${dayLabel(coverage.since, true)} : ${plural(coverage.packs, 'pack')})` : ''}. Pokémon-Zone, lui, a tout ton historique de jeu : packs ouverts par extension et par booster, cartes obtenues par rareté et par type, pioches miracle, échanges, ton classement…</p>
          <p>Importe ta page « Statistiques » Pokémon-Zone (avec la synchro de l’appli Android, le favori ou un fichier enregistré) : cet onglet se remplit, puis l’appli continue de compter les packs que tu saisis ensuite.</p>
          <div className="st-cta-actions">
            <Link to="/guide-pokemon-zone" className="btn primary"><Icon name="help" />Voir le guide</Link>
            <Link to="/ajout?onglet=pz" className="btn"><Icon name="upload" />Importer</Link>
          </div>
        </section>
        <GameAccount />
      </>
    );
  }

  const counter = (key: string) => life.counters.find((c) => c.key === key);
  const packs = life.packs, cards = life.cards;
  const perPack = packs && cards ? cards / packs : null;
  const days = life.daysPlayed;
  const unique = life.uniqueCards;
  const ownedNow = d.cards.filter((c) => (d.owned.get(c.id) ?? 0) > 0).length;
  const rest = life.counters.filter((c) => !KPI_KEYS.has(c.key));
  const maxSet = Math.max(1, ...life.bySet.map((s) => s.packs));
  const maxBooster = Math.max(1, ...life.byBooster.map((b) => b.packs));
  const boosters = allBoosters ? life.byBooster : life.byBooster.slice(0, 10);
  const rarSlices = life.byRarity.map((r) => ({ key: r.rarity, label: RARITY_LABEL[r.rarity], value: r.value, color: rc(r.rarity) }));
  const rarTotal = rarSlices.reduce((s, x) => s + x.value, 0);
  const rare = life.byRarity.filter((r) => RARE_RARITIES.includes(r.rarity));
  const rareTotal = rare.reduce((s, r) => s + r.value, 0);
  const setIds = d.sets.map((s) => s.id);
  const points = (home?.packPoints ?? []).map((p) => ({ ...p, setId: pzSetToSetId(p.setCode, setIds), added: life.bySet.find((s) => s.setCode === p.setCode)?.added ?? 0 }))
    .map((p) => ({ ...p, points: p.points + p.added * 5 })).filter((p) => p.points > 0);
  const cov = packs ? Math.min(1, coverage.packs / packs) : 0;
  const typeColor = (label: string) => TYPE_COLOR[label] ?? 'var(--st-c6)';

  return (
    <>
      <PzStatsSync asOf={life.asOf} fetchedAt={life.fetchedAt} addedPacks={life.addedPacks} />

      <div className="st-kpis">
        <div className="st-kpi">
          <span className="k">Packs ouverts</span>
          <b>{packs != null ? nf.format(packs) : '–'}</b>
          {rankText(counter('packs-opened')?.rank) && <span className="sub rank"><Icon name="trophy" />{rankText(counter('packs-opened')?.rank)}</span>}
          <span className="sub">{days ? `${nf1.format((packs ?? 0) / days)} par jour de jeu` : ''}</span>
        </div>
        <div className="st-kpi">
          <span className="k">Cartes obtenues</span>
          <b>{cards != null ? nf.format(cards) : '–'}</b>
          <span className="sub">{perPack ? `${nf1.format(perPack)} par pack ouvert, toutes sources` : ''}</span>
        </div>
        <div className="st-kpi">
          <span className="k">Cartes différentes obtenues</span>
          <b>{unique != null ? nf.format(unique) : '–'}</b>
          <span className="sub">{nf.format(ownedNow)} possédées aujourd’hui dans l’appli</span>
        </div>
        <div className="st-kpi">
          <span className="k">Jours de jeu</span>
          <b>{days != null ? nf.format(days) : '–'}</b>
          <span className="sub">{counter('wonder-picks') ? `${nf.format(counter('wonder-picks')!.value)} pioches miracle` : ''}</span>
        </div>
        <div className="st-kpi">
          <span className="k">Échanges</span>
          <b>{counter('trades') ? nf.format(counter('trades')!.value) : '–'}</b>
          <span className="sub">{counter('cards-given') ? `${nf.format(counter('cards-given')!.value)} cartes offertes` : ''}{counter('trade-partners') ? ` · ${nf.format(counter('trade-partners')!.value)} partenaires` : ''}</span>
        </div>
        <div className="st-kpi">
          <span className="k">Suivi dans l’appli</span>
          <b>{pf(cov, 0)}</b>
          <span className="sub">{nf.format(coverage.packs)} packs saisis sur {packs != null ? nf.format(packs) : '–'}</span>
        </div>
      </div>

      <div className="st-grid">
        <Section wide title="Packs ouverts par extension" sub="Depuis ton premier pack, avec la complétion actuelle"
          insight={life.bySet[0] ? <>Extension la plus ouverte : <b>{life.bySet[0].setId ? setName(life.bySet[0].setId) : life.bySet[0].name}</b> ({plural(life.bySet[0].packs, 'pack')}, {pf(life.bySet[0].packs / Math.max(1, packs ?? 1), 0)} du total).</> : undefined}>
          {!life.bySet.length ? <Empty>Pas de détail par extension dans la page importée.</Empty> : (
            <ul className="st-rows stacked">
              {life.bySet.map((s) => {
                const c = s.setId ? d.cards.filter((x) => x.setId === s.setId) : [];
                const have = c.filter((x) => (d.owned.get(x.id) ?? 0) > 0).length;
                const label = s.setId ? setName(s.setId) : s.name;
                return (
                  <li key={s.setCode} className={s.setId ? 'link' : ''} title={`${label} : ${s.packs} packs${s.added ? `, dont ${s.added} saisis depuis l’import` : ''}`}>
                    {s.setId && <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'set', setId: s.setId! })}><span className="sr-only">{label} : voir le détail</span></button>}
                    <span className="who"><span className="st-logo">{s.setId ? <SetLogo setId={s.setId} name={label} small fallback={<b>{s.setCode}</b>} /> : <b>{s.setCode}</b>}</span><span className="nm">{label}</span></span>
                    <span className="bar thin"><i className="st-grow-x" style={{ width: `${(s.packs / maxSet) * 100}%`, background: 'var(--st-c1)' }} /></span>
                    <span className="v"><b>{nf.format(s.packs)}</b><small>{c.length ? `${pf(have / c.length, 0)} complétée` : `${nf.format(s.cards)} cartes`}</small></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Packs ouverts par booster" sub="Correspondance avec les boosters de l’appli"
          insight={life.byBooster[0] ? <>Booster favori : <b>{life.byBooster[0].boosterId ? `${d.boosterById.get(life.byBooster[0].boosterId)?.setId ?? ''} ${d.boosterById.get(life.byBooster[0].boosterId)?.name ?? life.byBooster[0].name}` : life.byBooster[0].name}</b> ({plural(life.byBooster[0].packs, 'pack')}).</> : undefined}>
          {!life.byBooster.length ? <Empty>Pas de détail par booster dans la page importée.</Empty> : (
            <>
              <ul className="st-rows stacked">
                {boosters.map((b, i) => {
                  const bo = b.boosterId ? d.boosterById.get(b.boosterId) : undefined;
                  return (
                    <li key={(b.boosterId ?? b.name) + i} className={bo ? 'link' : ''} title={`${bo?.name ?? b.name} : ${b.packs} packs`}>
                      {bo && <button type="button" className="st-hit" aria-haspopup="dialog" onClick={() => open({ k: 'booster', boosterId: bo.id })}><span className="sr-only">{bo.name} : voir le détail</span></button>}
                      <span className="who">{bo && <span className="st-emb"><BoosterEmblem boosterId={bo.id} small /></span>}<span className="nm">{bo ? <><small>{bo.setId}</small> {bo.name}</> : b.name}</span></span>
                      <span className="bar thin"><i className="st-grow-x" style={{ width: `${(b.packs / maxBooster) * 100}%`, background: 'var(--st-c1)' }} /></span>
                      <span className="v"><b>{nf.format(b.packs)}</b></span>
                    </li>
                  );
                })}
              </ul>
              {life.byBooster.length > 10 && <button type="button" className="st-more" onClick={() => setAllBoosters(!allBoosters)}>{allBoosters ? 'Réduire' : `Voir les ${life.byBooster.length} boosters`}</button>}
            </>
          )}
        </Section>

        <Section title="Raretés obtenues" sub="Exemplaires reçus, toutes sources (packs, pioches miracle, missions)"
          insight={rareTotal && packs ? <><b>{nf.format(rareTotal)}</b> cartes ★ ou mieux, soit une pour {nf1.format(packs / rareTotal)} packs ouverts.</> : undefined}>
          {!rarTotal ? <Empty>Pas de détail par rareté dans la page importée.</Empty> : (
            <div className="st-vstack">
              <Donut slices={rarSlices} ariaLabel="Raretés obtenues à vie" centerTop={nf.format(rarTotal)} centerBottom="exemplaires" />
              {packs ? (
                <ul className="st-rows tight st-freq">
                  {rare.map((r) => (
                    <li key={r.rarity}>
                      <span className="who rar"><i className="st-dot" style={{ background: rc(r.rarity) }} /><RarityGlyph r={r.rarity} /></span>
                      <StackBar total={Math.max(1, ...rare.map((x) => x.value))} parts={[{ label: 'Obtenues', value: r.value, color: rc(r.rarity) }]} />
                      <span className="v"><b>{nf.format(r.value)}</b><small>1 / {nf.format(Math.round(packs / Math.max(1, r.value)))} packs</small></span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Section>

        {life.byType.length > 0 && (
          <Section title="Types obtenus" sub="Exemplaires reçus par type, et cartes différentes">
            <Bars list={life.byType} color={typeColor} />
            {life.trainers.length > 0 && <><h3 className="st-sub">Dresseurs</h3><Bars list={life.trainers} color={() => 'var(--st-t-dresseur)'} /></>}
          </Section>
        )}

        {life.special.length > 0 && (
          <Section title="Cartes spéciales" sub="Formes régionales, Ultra-Chimères, Méga-Évolutions…">
            <Bars list={life.special} color={() => 'var(--st-c5)'} limit={8} />
          </Section>
        )}

        {points.length > 0 && (
          <Section title="Points de booster" sub="Solde réel par extension (5 points par pack saisi depuis l’import)">
            <ul className="st-points">
              {points.map((p) => (
                <li key={p.setCode}>
                  {p.setId ? <SetLogo setId={p.setId} small fallback={<b>{p.setCode}</b>} /> : <b>{p.setCode}</b>}
                  <b>{nf.format(p.points)}</b>
                  {p.added > 0 && <small>+{nf.format(p.added * 5)}</small>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {rest.length > 0 && (
          <Section title="Autres compteurs" sub="Tels qu’affichés par Pokémon-Zone">
            <ul className="st-counters">
              {rest.map((c) => (
                <li key={c.key}>
                  <span>{c.labelFr}</span>
                  <b>{c.approx ? '≈ ' : ''}{nf.format(c.value)}</b>
                  {rankText(c.rank) && <small>{rankText(c.rank)}</small>}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
      <GameAccount />
      <p className="st-foot">Les chiffres à vie viennent de Pokémon-Zone ; l’appli y ajoute seulement les packs complets saisis après l’import. Réimporte ta page Statistiques pour tout remettre à jour (cartes obtenues hors packs, pioches miracle, échanges…).</p>
    </>
  );
}
