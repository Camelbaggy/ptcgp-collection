import { useMemo } from 'react';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { CardThumb } from '../../components/CardTile';
import { BoosterEmblem, BoosterPackImage, SetLogo } from '../../components/Brand';
import { missingCardOdds, type BoosterAnalysis } from '../../lib/calc';
import { setWish } from '../../lib/db';
import { RARITY_LABEL } from '../../lib/useData';
import type { CalcData } from './useCalcData';
import { num, packsLabel, pct } from './format';
import { setIdOf } from '../../lib/setId'

/** Vue empilée de l'encart « À ouvrir en premier » : liste de tous les boosters, ou un booster. */
export type BoosterView = { k: 'list' } | { k: 'booster'; boosterId: string };

/** Classement des boosters (promos et spéciaux déjà exclus) par proba de nouvelle carte décroissante. */
const rankByNew = (analyses: BoosterAnalysis[]): BoosterAnalysis[] =>
  [...analyses].sort((a, b) => b.legacyNew - a.legacyNew);

/** Proba à 3 décimales, comme dans le jeu ; 3 chiffres significatifs pour les cartes très rares (0,00747 %). */
function oddsLabel(p: number): string {
  const x = p * 100;
  if (x >= 0.01) return pct(p, 3);
  return `${x.toLocaleString('fr-FR', { maximumSignificantDigits: 3 })} %`;
}

export function BoosterSheets({ d, stack, setStack }: { d: CalcData; stack: BoosterView[]; setStack: (s: BoosterView[]) => void }) {
  const top = stack[stack.length - 1];
  if (!top) return null;
  const title = top.k === 'list' ? 'Probabilités par extension' : boosterTitle(d, top.boosterId);
  return (
    <Sheet title={title} full onClose={() => setStack([])}>
      {stack.length > 1 && (
        <button type="button" className="btn ghost bs-back" onClick={() => setStack(stack.slice(0, -1))}><Icon name="chevl" />Retour à la liste</button>
      )}
      {top.k === 'list'
        ? <BoosterList d={d} onPick={(boosterId) => setStack([...stack, { k: 'booster', boosterId }])} />
        : <MissingCards d={d} boosterId={top.boosterId} />}
    </Sheet>
  );
}

function boosterTitle(d: CalcData, boosterId: string): string {
  const b = d.boosterById.get(boosterId);
  if (!b) return boosterId;
  const set = d.sets.find((s) => s.id === b.setId);
  return set && set.name !== b.name ? `${set.name} · ${b.name}` : b.name;
}

const setOf = (d: CalcData, boosterId: string) => d.boosterById.get(boosterId)?.setId ?? setIdOf(boosterId);

function BoosterList({ d, onPick }: { d: CalcData; onPick: (boosterId: string) => void }) {
  const ranked = useMemo(() => rankByNew(d.analyses), [d.analyses]);
  const max = ranked[0]?.legacyNew || 1;
  return (
    <>
      <p className="bs-hint">Chance de tirer au moins une nouvelle carte par pack, du meilleur booster au moins bon. Touche un booster pour voir ses cartes manquantes.</p>
      <ul className="bs-list">
        {ranked.map((a) => {
          const sid = setOf(d, a.boosterId);
          const b = d.boosterById.get(a.boosterId);
          const miss = a.total - a.owned;
          return (
            <li key={a.boosterId}>
              <button type="button" className="bs-row" onClick={() => onPick(a.boosterId)} aria-label={`${b?.name ?? a.boosterId}, ${pct(a.legacyNew, 2)} de nouvelle carte, voir les cartes manquantes`}>
                <span className="bs-pk"><BoosterPackImage boosterId={a.boosterId} className="sm" fallback={<BoosterEmblem boosterId={a.boosterId} />} /></span>
                <span className="bs-main">
                  <span className="bs-brand"><SetLogo setId={sid} small fallback={<b>{sid}</b>} /><BoosterEmblem boosterId={a.boosterId} small /></span>
                  <b className="bs-name">{b?.name ?? a.boosterId}</b>
                  <small>{miss > 0 ? `${num(miss)} manquante${miss > 1 ? 's' : ''}` : 'Complet'} · {pct(a.completion)} complété</small>
                  <span className="bs-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (a.legacyNew / max) * 100)}%` }} /></span>
                </span>
                <span className="bs-val"><b>{pct(a.legacyNew, 2)}</b><Icon name="chev" /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function MissingCards({ d, boosterId }: { d: CalcData; boosterId: string }) {
  const odds = useMemo(() => missingCardOdds(boosterId, d.cards, d.rates, d.owned), [boosterId, d.cards, d.rates, d.owned]);
  const wished = useMemo(() => new Set(d.wishlist.map((w) => w.cardId)), [d.wishlist]);
  const an = d.analyses.find((a) => a.boosterId === boosterId);
  const sid = setOf(d, boosterId);
  const nWished = odds.filter((o) => wished.has(o.card.id)).length;
  return (
    <>
      <div className="bs-head">
        <span className="bs-pk lg"><BoosterPackImage boosterId={boosterId} fallback={<BoosterEmblem boosterId={boosterId} />} /></span>
        <span className="bs-main">
          <span className="bs-brand"><SetLogo setId={sid} small fallback={<b>{sid}</b>} /><BoosterEmblem boosterId={boosterId} small /></span>
          <b className="bs-name">{num(odds.length)} carte{odds.length > 1 ? 's' : ''} manquante{odds.length > 1 ? 's' : ''}</b>
          {an && <small>{pct(an.legacyNew, 2)} de nouvelle carte · ≈ {packsLabel(1 / an.legacyNew)} packs par nouvelle carte</small>}
          {nWished > 0 && <small>{num(nWished)} déjà dans mes cartes visées</small>}
        </span>
      </div>
      {odds.length === 0 ? <p className="ptc-empty">Tu as toutes les cartes de ce booster.</p> : (
        <>
          <p className="bs-hint">Probabilité de tirer chaque carte dans un pack. Le cœur l'ajoute à tes cartes visées.</p>
          <ul className="bs-cards">
            {odds.map(({ card, p, packs }) => {
              const on = wished.has(card.id);
              return (
                <li key={card.id} className="bs-card">
                  <CardThumb card={card} />
                  <span className="bs-main">
                    <b className="bs-cn">{card.name}</b>
                    <small>{RARITY_LABEL[card.rarity]} · n° {card.number}</small>
                  </span>
                  <span className="bs-val"><b>{oddsLabel(p)}</b><small>≈ {packsLabel(packs)} packs</small></span>
                  <button type="button" className={'bs-wish' + (on ? ' on' : '')} aria-pressed={on}
                    aria-label={on ? `Retirer ${card.name} de mes cartes visées` : `Ajouter ${card.name} à mes cartes visées`}
                    onClick={() => { void setWish(card.id, on ? null : 2); }}>
                    <Icon name={on ? 'heartfill' : 'heart'} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
