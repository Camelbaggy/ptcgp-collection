import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { usePersisted } from '../../lib/useData';
import { cancelPzSync, startPzSync, usePzSync } from '../../lib/pzSync/store';
import { usePzSyncSupported } from '../add-pack/PzSyncPanel';

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * En tête de Stats › À vie : met à jour les statistiques depuis Pokémon-Zone.
 * Appli Android : synchro intégrée en mode `stats` (accueil + page Statistiques, aucune extension).
 * Web : renvoie vers le guide (favori ou page enregistrée).
 */
export function PzStatsSync({ fetchedAt }: { fetchedAt: string | null }) {
  const supported = usePzSyncSupported();
  const [player] = usePersisted('pz.player', '');
  const s = usePzSync();
  const running = s.status === 'running';
  const mine = s.mode === 'stats';
  const when = fetchedAt ? `Dernière mise à jour : ${fmt(fetchedAt)}.` : 'Jamais importées.';

  if (supported && player) {
    return (
      <section className="st-sync">
        <div className="st-sync-txt">
          <b>Statistiques Pokémon-Zone</b>
          <span>{running && mine ? s.label : s.status === 'error' && mine ? `Interrompue : ${s.error}` : `${when} Ne lit que 2 pages (accueil et statistiques), aucune extension.`}</span>
        </div>
        {running
          ? <button type="button" className="btn ghost" onClick={cancelPzSync} disabled={!mine}>{mine ? 'Annuler' : 'Synchro en cours…'}</button>
          : <button type="button" className="btn primary" onClick={() => void startPzSync(player, 'stats', [])}><Icon name="sync" />Mettre à jour</button>}
      </section>
    );
  }
  if (supported === null) return null;
  return (
    <section className="st-sync">
      <div className="st-sync-txt">
        <b>Statistiques Pokémon-Zone</b>
        <span>{when} {supported ? 'Indique d’abord ton profil Pokémon-Zone dans Ajout › Import.' : 'Dans l’appli Android, un bouton les met à jour ici ; sur le web, utilise le favori ou ta page Statistiques enregistrée.'}</span>
      </div>
      <Link to={supported ? '/ajout?onglet=pz' : '/guide-pokemon-zone'} className="btn"><Icon name={supported ? 'user' : 'help'} />{supported ? 'Indiquer mon profil' : 'Comment faire'}</Link>
    </section>
  );
}
