import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { dayLabel } from '../../lib/stats';
import { usePersisted } from '../../lib/useData';
import { cancelPzSync, startPzSync, usePzSync } from '../../lib/pzSync/store';
import { usePzSyncSupported } from '../add-pack/PzSyncPanel';

/**
 * Bandeau unique en tête de Stats › À vie : source (date des données Pokémon-Zone, packs saisis
 * depuis) et mise à jour. Android : synchro intégrée en mode `stats` (accueil + statistiques,
 * aucune extension). Web : lien vers le guide.
 */
export function PzStatsSync({ asOf, fetchedAt, addedPacks = 0 }: { asOf?: string | null; fetchedAt: string | null; addedPacks?: number }) {
  const supported = usePzSyncSupported();
  const [player] = usePersisted('pz.player', '');
  const s = usePzSync();
  const mine = s.mode === 'stats';
  const running = s.status === 'running';
  const date = asOf ?? fetchedAt?.slice(0, 10) ?? null;

  const sub = running && mine ? s.label
    : s.status === 'error' && mine ? `Interrompue : ${s.error}`
      : addedPacks > 0 ? `+${addedPacks} pack${addedPacks > 1 ? 's' : ''} saisi${addedPacks > 1 ? 's' : ''} depuis`
        : null;

  let action = null;
  if (supported && player) {
    action = running
      ? <button type="button" className="btn ghost small" onClick={cancelPzSync} disabled={!mine}>{mine ? 'Annuler' : 'Synchro…'}</button>
      : <button type="button" className="btn primary small" onClick={() => void startPzSync(player, 'stats', [])}><Icon name="sync" />Mettre à jour</button>;
  } else if (supported) {
    action = <Link to="/ajout?onglet=pz" className="btn small"><Icon name="user" />Mon profil P-Z</Link>;
  } else if (supported === false && fetchedAt) {
    action = <Link to="/guide-pokemon-zone" className="btn ghost small"><Icon name="help" />Mettre à jour</Link>;
  }

  return (
    <section className="st-sync">
      <div className="st-sync-txt">
        <b>Pokémon-Zone{date ? ` · au ${dayLabel(date, true)}` : ' · pas encore importé'}</b>
        {sub && <span>{sub}</span>}
      </div>
      {(fetchedAt || action) && (
        <div className="st-sync-act">
          {fetchedAt && <Link to="/profil?onglet=jeu" className="btn ghost small">Compte de jeu</Link>}
          {action}
        </div>
      )}
    </section>
  );
}
