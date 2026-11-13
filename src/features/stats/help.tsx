import type { HelpBlock } from '../../components/HelpSheet';
import { nf, pf } from './charts';
import { dayLabel, type JournalCoverage } from '../../lib/stats';
import type { StatsTab } from './Stats';

/** Descriptions des cartes de chaque onglet : déplacées ici depuis les sous-titres (lot L10, règle 1). */
const SECTIONS: Record<StatsTab, [string, string][]> = {
  collection: [
    ['Complétion par extension', 'Part des cartes possédées au moins une fois.'],
    ['Complétion par rareté', 'Cartes possédées et manquantes.'],
    ['Doubles en stock', 'Exemplaires en trop par rareté.'],
    ['Types de Pokémon', 'Cartes différentes possédées par type.'],
  ],
  activite: [
    ['Complétion dans le temps', 'Cartes différentes possédées, jour après jour.'],
    ['Packs ouverts', 'Nombre de packs par jour, semaine ou mois.'],
    ['Chance', 'Cartes rares (☆ et plus) tirées contre attendues.'],
    ['Raretés tirées', 'Toutes les cartes de tes packs, même base que la chance.'],
    ['Boosters ouverts', 'Packs ouverts par booster.'],
    ['Partages et échanges', 'Nombre par jour, semaine ou mois.'],
    ['Meilleurs tirages', 'Tes plus belles cartes, de la plus rare à la plus récente.'],
  ],
  vie: [
    ['Packs ouverts par extension', 'Depuis ton premier pack, avec la complétion actuelle.'],
    ['Packs ouverts par booster', 'Correspondance avec les boosters de l’appli.'],
    ['Raretés obtenues', 'Exemplaires reçus, toutes sources (packs, pioches miracle, missions).'],
    ['Types obtenus', 'Exemplaires reçus par type, et cartes différentes.'],
    ['Points de booster', 'Solde réel par extension (5 points par pack saisi depuis l’import).'],
    ['Autres compteurs', 'Tels qu’affichés par Pokémon-Zone.'],
  ],
};

/** Contenu du « ? » de Statistiques : source des chiffres de l'onglet, règles de calcul, rôle de chaque carte. */
export function statsHelp(tab: StatsTab, coverage: JournalCoverage, lifePacks: number | null): HelpBlock[] {
  const source: HelpBlock = tab === 'collection'
    ? { title: 'Source', text: 'État actuel de ta collection dans l’appli, exact et indépendant de la période. Les échangeables et partageables suivent les mêmes règles que l’accueil.' }
    : tab === 'activite'
      ? {
        title: 'Source', text: coverage.since
          ? <>Journal de l’appli, tenu depuis le {dayLabel(coverage.since, true)} : {nf.format(coverage.packs)} {coverage.packs > 1 ? 'packs saisis' : 'pack saisi'}
            {lifePacks ? <>, soit {pf(Math.min(1, coverage.packs / lifePacks), 0)} de tes {nf.format(lifePacks)} packs ouverts (Pokémon-Zone).</> : '.'}</>
          : 'Le journal de l’appli est vide : saisis tes packs, échanges et partages pour remplir cet onglet.',
      }
      : { title: 'Source', text: 'Les chiffres à vie viennent de Pokémon-Zone ; l’appli y ajoute seulement les packs complets saisis après l’import. Réimporte ta page Statistiques pour tout remettre à jour (cartes obtenues hors packs, pioches miracle, échanges…). Elle contient tout ton historique : packs par extension et par booster, cartes par rareté et par type, classement. Importe-la avec la synchro de l’appli Android, le favori ou un fichier enregistré : l’appli continue ensuite de compter les packs que tu saisis.' };
  const rules: HelpBlock[] = tab === 'activite'
    ? [{ title: 'Règles', text: 'Un pack = une saisie de 4 cartes ou plus. Les mises à jour de quantités (imports Pokémon-Zone, vidéo, corrections) comptent dans les nouvelles cartes, pas dans les packs.' }]
    : [];
  return [source, ...rules, { title: 'Les cartes de cet onglet', text: <ul>{SECTIONS[tab].map(([t, s]) => <li key={t}><b>{t}</b> : {s}</li>)}</ul> }];
}
