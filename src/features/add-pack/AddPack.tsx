import { Suspense, lazy, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { isNative } from '../../lib/native/holoNative'
import { usePersisted, useSets } from '../../lib/useData'
import WonderPick from './WonderPick'
const BulkUpdate = lazy(() => import('./BulkUpdate'))
import { CATS, METHOD_LABEL, fromOnglet, methodsFor, pickMethod, type AddCat, type AddMethod } from './methods'
import PackEntry from './PackEntry'
import { useBoosterChoice } from './boosterChoice'
const PzCollectionImport = lazy(() => import('./PzCollectionImport'))
const RecapImport = lazy(() => import('./RecapImport'))
const ScreenMass = lazy(() => import('./ScreenMass'))
const VideoImport = lazy(() => import('./VideoImport'))

/** Ce que fait chaque méthode, en une ligne, selon la catégorie. */
const HINT: Partial<Record<`${AddCat}.${AddMethod}`, string>> = {
  'booster.shot': 'Capture l\'écran de fin d\'ouverture : les cartes sont reconnues, tu vérifies puis valides.',
  'booster.manual': 'Tape le début du nom ou le numéro de chaque carte, ou touche-les dans la grille.',
  'boosters.screen': 'L\'appli filme le « Résumé ouverture » pendant que tu le fais défiler, puis lit tous les boosters.',
  'boosters.shots': 'Capture le « Résumé ouverture » en descendant (2 boosters par capture), ou envoie des captures déjà faites.',
  'boosters.video': 'Envoie une vidéo du « Résumé ouverture » que tu fais défiler.',
  'boosters.manual': 'Saisis les boosters l\'un après l\'autre, en validant chacun.',
  'mass.screen': 'Enregistre l\'écran « Échange de points Booster » de chaque extension : l\'extension est reconnue toute seule, puis une seule revue pour toutes.',
  'mass.pz': 'Lit ton profil Pokémon-Zone pour plusieurs extensions d\'un coup.',
  'set.pz': 'Lit la page de l\'extension sur ton profil Pokémon-Zone, et seulement celle-là.',
  'set.screen': 'L\'appli filme l\'écran « Échange de points Booster » pendant que tu le fais défiler.',
  'set.video': 'Envoie une vidéo de l\'écran « Échange de points Booster » que tu fais défiler.',
  'set.manual': 'Tape le nombre réel d\'exemplaires de chaque carte de l\'extension.',
}

/** Panneau « plusieurs boosters » : extension et booster choisis, puis lecture du récap. */
function Recap({ source }: { source: 'screen' | 'shots' | 'video' }) {
  const ch = useBoosterChoice()
  return (
    <RecapImport key={source} source={source} setCards={ch.setCards} allCards={ch.cards} boosters={ch.boosters}
      boosterId={ch.curBooster?.id} setName={ch.curSet?.name ?? ''} onBoosterChange={ch.switchBooster} />
  )
}

function Content({ cat, method }: { cat: AddCat; method: AddMethod }) {
  switch (cat) {
    case 'booster': return <PackEntry key={method} input={method === 'shot' ? 'shot' : 'manual'} />
    case 'boosters':
      return method === 'manual' ? <PackEntry input="manual" series /> : <Recap source={method === 'screen' ? 'screen' : method === 'video' ? 'video' : 'shots'} />
    case 'set':
      if (method === 'pz') return <PzCollectionImport scope="set" />
      if (method === 'manual') return <BulkUpdate />
      return <VideoImport key={method} source={method === 'screen' ? 'screen' : 'file'} />
    case 'wonder': return <WonderPick />
    case 'mass': return method === 'screen' ? <ScreenMass /> : <PzCollectionImport scope="mass" />
  }
}

export default function AddPack() {
  const sets = useSets()
  const [cat, setCat] = usePersisted<AddCat>('add.cat', 'booster')
  const [subs, setSubs] = usePersisted<Partial<Record<AddCat, AddMethod>>>('add.method', {})
  const [, setGrid] = usePersisted('add.grid', false)
  const [params] = useSearchParams()
  const onglet = params.has('pz') || params.has('pzz') ? 'pz' : params.get('onglet')
  useEffect(() => {
    const to = fromOnglet(onglet)
    if (!to) return
    setCat(to.cat)
    if (to.method) setSubs({ ...subs, [to.cat]: to.method })
    if (to.grid !== undefined) setGrid(to.grid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet])

  const curCat = CATS.some((c) => c.id === cat) ? cat : 'booster'
  const methods = methodsFor(curCat, isNative)
  const method = pickMethod(curCat, isNative, subs[curCat])
  const info = CATS.find((c) => c.id === curCat)!

  if (!sets.length) return <div className="page" data-section="green"><EmptyState icon="layers" title="Aucune extension" text="Ajoute-en une depuis « Nouvelle extension »." action={<Link className="btn primary" to="/extension/nouvelle">Nouvelle extension</Link>} /></div>

  return (
    <div className={'page with-bar'} data-section="green">
      <PageHeader icon="plus" title="Ajouter des cartes" sub={info.sub} />
      <div className="seg add-cats" role="tablist" aria-label="Que veux-tu ajouter ?">
        {CATS.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === curCat} className={c.id === curCat ? 'on' : ''} onClick={() => setCat(c.id)}>
            <Icon name={c.icon} /><span>{c.label}</span>
          </button>
        ))}
      </div>
      {methods.length > 1 && (
        <div className="chips scroll add-methods" role="tablist" aria-label="Méthode">
          {methods.map((m, i) => (
            <button key={m} role="tab" aria-selected={m === method}
              className={'chip big' + (m === method ? ' on' : '') + (i === 0 ? ' rec' : '')}
              onClick={() => setSubs({ ...subs, [curCat]: m })}>
              <Icon name={i === 0 ? 'star' : METHOD_LABEL[m].icon} /><span>{METHOD_LABEL[m].label}</span>
              {i === 0 && <span className="rec-tag">Recommandé</span>}
            </button>
          ))}
        </div>
      )}
      {HINT[`${curCat}.${method}`] && (
        <p className={'add-hint small' + (method === methods[0] ? ' rec' : '')}>
          {method === methods[0] && methods.length > 1 && <b>Le plus pratique · </b>}{HINT[`${curCat}.${method}`]}
        </p>
      )}
      <Suspense fallback={<div className="card" aria-busy="true" style={{ minHeight: 120 }} />}><Content cat={curCat} method={method} /></Suspense>
    </div>
  )
}
