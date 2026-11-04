import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { dismissNewSetNotices, saveRates } from '../../lib/db'
import { RARITIES, useBoosters, useCards, useRates, useSets } from '../../lib/useData'
import { SetBadge } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import RatesEditor, { formsToRates, ratesToForms, type RatesForms } from './RatesEditor'

/** Vérifier / saisir les taux d'obtention des boosters d'une extension (livrée ou ajoutée). */
export default function SetRates() {
  const { setId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const set = useSets().find((s) => s.id === setId)
  const allBoosters = useBoosters()
  const boosters = useMemo(() => allBoosters.filter((b) => b.setId === setId), [allBoosters, setId])
  const cards = useCards()
  const rates = useRates()
  const [forms, setForms] = useState<RatesForms | null>(null)
  const [boosterId, setBoosterId] = useState('')

  useEffect(() => {
    if (forms || !boosters.length) return
    setForms(ratesToForms(boosters, rates))
    setBoosterId(boosters[0]!.id)
  }, [forms, boosters, rates])

  const rarities = useMemo(() => {
    const present = new Set(cards.filter((c) => c.setId === setId).map((c) => c.rarity))
    return RARITIES.filter((r) => present.has(r))
  }, [cards, setId])

  if (!set) return <div className="page" data-section="grey"><EmptyState icon="layers" title="Extension introuvable" action={<Link className="btn primary" to="/">Accueil</Link>} /></div>
  const estimated = boosters.some((b) => b.ratesEstimated && !rates.some((r) => r.boosterId === b.id && r.updatedAt))

  const save = async () => {
    if (!forms) return
    await saveRates(boosters.map((b) => b.id), formsToRates(boosters, forms))
    toast(`Taux de ${set.name} enregistrés`)
    nav('/')
  }
  const later = async () => {
    await dismissNewSetNotices([setId])
    nav('/')
  }

  return (
    <div className="page" data-section="grey">
      <PageHeader icon="layers" title={<span className="set-head"><SetBadge setId={set.id} name={set.name} text={set.id} />{set.name}</span>} sub="Taux d'obtention (%) des boosters" />
      {estimated && <p className="warn card"><Icon name="alert" /> Taux estimés — à vérifier : copie des taux d'une extension voisine. Corrigez-les avec ceux du jeu puis enregistrez ; ils remplaceront les taux livrés (et sont synchronisés).</p>}
      {forms && <RatesEditor boosters={boosters} rarities={rarities} forms={forms} setForms={(f) => setForms((cur) => (typeof f === 'function' ? f(cur ?? {}) : f))} boosterId={boosterId} setBoosterId={setBoosterId} />}
      <div className="row">
        <button className="btn primary big" onClick={save} disabled={!forms}><Icon name="check" />Enregistrer mes taux</button>
        <button className="btn big" onClick={later}>Plus tard</button>
      </div>
    </div>
  )
}
