import { Icon } from '../../components/Icon'
import { usePersisted } from '../../lib/useData'
import PzCollectionImport from './PzCollectionImport'
import VideoImport from './VideoImport'

type Source = 'video' | 'pz'

/** Onglet « Import » : mise à jour de la collection depuis une vidéo du jeu ou une page Pokémon-Zone. */
export default function ImportTab() {
  const [src, setSrc] = usePersisted<Source>('import.source', 'video')
  return (
    <>
      <div className="chips import-src" role="tablist" aria-label="Source de l'import">
        <button role="tab" aria-selected={src === 'video'} className={'chip big' + (src === 'video' ? ' on' : '')} onClick={() => setSrc('video')}><Icon name="video" />Vidéo du jeu</button>
        <button role="tab" aria-selected={src === 'pz'} className={'chip big' + (src === 'pz' ? ' on' : '')} onClick={() => setSrc('pz')}><Icon name="upload" />Pokémon-Zone</button>
      </div>
      {src === 'pz' ? <PzCollectionImport /> : <VideoImport />}
    </>
  )
}
