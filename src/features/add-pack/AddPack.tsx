import { Suspense, lazy, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { SegTabs } from '../../components/PageKit'
import { isNative } from '../../lib/native/holoNative'
import { usePersisted, useSets } from '../../lib/useData'
import WonderPick from './WonderPick'
const BulkUpdate = lazy(() => import('./BulkUpdate'))
import { CATS, METHOD_LABEL, fromOnglet, methodsFor, pickMethod, type AddCat, type AddMethod } from './methods'
import PackEntry from './PackEntry'
import { useBoosterChoice } from './boosterChoice'
import { addHelp } from './addHelp'
const PzCollectionImport = lazy(() => import('./PzCollectionImport'))
const RecapImport = lazy(() => import('./RecapImport'))
const ScreenMass = lazy(() => import('./ScreenMass'))
const VideoImport = lazy(() => import('./VideoImport'))

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
    case 'booster': return <PackEntry key={method} input={method === 'shot' ? 'shot' : method === 'grid' ? 'grid' : 'manual'} />
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
  const [grid, setGrid] = usePersisted('add.grid', false)
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
  const method = pickMethod(curCat, isNative, subs[curCat], grid)
  const choose = (m: AddMethod) => {
    setSubs({ ...subs, [curCat]: m })
    if (curCat === 'booster' && m !== 'shot') setGrid(m === 'grid')
  }

  if (!sets.length) return <div className="page" data-section="green"><EmptyState icon="layers" title="Aucune extension" text="Ajoute-en une depuis « Nouvelle extension »." action={<Link className="btn primary" to="/extension/nouvelle">Nouvelle extension</Link>} /></div>

  return (
    <div className="page with-bar add-page" data-section="green">
      <PageHeader icon="plus" title="Ajouter" help={addHelp(curCat, methods, isNative)} />
      <div className="add-pick">
        <SegTabs label="Que veux-tu ajouter ?" value={curCat} onChange={setCat}
          options={CATS.map((c) => ({ value: c.id, label: c.short, aria: c.short === c.label ? undefined : c.label }))} />
        {methods.length > 1 && (
          <SegTabs label="Méthode" value={method} onChange={choose}
            options={methods.map((m, i) => ({
              value: m, label: METHOD_LABEL[m].short, icon: i === 0 ? 'star' : undefined,
              aria: i === 0 ? `${METHOD_LABEL[m].label}, recommandé` : METHOD_LABEL[m].short === METHOD_LABEL[m].label ? undefined : METHOD_LABEL[m].label,
            }))} />
        )}
      </div>
      <div style={{ display: 'contents' }} data-content-start=""><Suspense fallback={<div className="card" aria-busy="true" style={{ minHeight: 120 }} />}><Content cat={curCat} method={method} /></Suspense></div>
    </div>
  )
}
