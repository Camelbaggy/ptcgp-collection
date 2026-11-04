import { useEffect, useMemo, useState } from 'react'
import { fetchPublicSet, fetchPublicSetList, importFromText, type ImportedSet, type PublicSet } from '../../lib/importers'
import { db, saveNewSet } from '../../lib/db'
import { RARITIES, RARITY_LABEL } from '../../lib/useData'
import { BoosterBadge, SetBadge } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import type { Rarity } from '../../lib/types'
import RatesEditor, { emptyPack, formsToRates, type RatesForms } from './RatesEditor'

export default function NewSet() {
  const toast = useToast()
  const [mode, setMode] = useState<'text' | 'public'>('text')
  const [text, setText] = useState('')
  const [setId, setSetId] = useState('')
  const [name, setName] = useState('')
  const [publicSets, setPublicSets] = useState<PublicSet[]>([])
  const [data, setData] = useState<ImportedSet | null>(null)
  const [error, setError] = useState('')
  const [boosterId, setBoosterId] = useState('')
  const [forms, setForms] = useState<RatesForms>({})

  useEffect(() => {
    if (mode !== 'public' || publicSets.length) return
    fetchPublicSetList().then(setPublicSets, () => setError('Source publique injoignable (hors connexion ?)'))
  }, [mode, publicSets.length])

  const rarities = useMemo(() => {
    const present = new Set<Rarity>(data?.cards.map((c) => c.rarity))
    return RARITIES.filter((r) => present.has(r))
  }, [data])

  const load = async () => {
    setError('')
    try {
      const res = mode === 'text'
        ? importFromText(text, { setId: setId.trim(), name: name.trim() || setId.trim(), order: 99 })
        : await fetchPublicSet(setId.trim())
      if (name && mode === 'public') res.set.name = name
      const f: RatesForms = {}
      for (const b of res.boosters) f[b.id] = [emptyPack('normal', '100')]
      setForms(f)
      setBoosterId(res.boosters[0]?.id ?? '')
      setData(res)
    } catch (e) { setError((e as Error).message); setData(null) }
  }

  const save = async () => {
    if (!data) return
    const rates = formsToRates(data.boosters, forms)
    const count = await db.sets.count()
    const set = { ...data.set, order: Math.max(data.set.order === 99 ? 0 : data.set.order, count + 1) }
    try {
      await saveNewSet(set, data.boosters, data.cards, rates)
      toast(`Extension ${set.id} enregistrée (${data.cards.length} cartes)`)
      setData(null); setText('')
    } catch (e) { setError((e as Error).message) }
  }

  const byRarity = data ? rarities.map((r) => [r, data.cards.filter((c) => c.rarity === r).length] as const) : []

  return (
    <div className="page">
      <h1>Nouvelle extension</h1>
      <div className="seg">
        <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Coller du texte</button>
        <button className={mode === 'public' ? 'on' : ''} onClick={() => setMode('public')}>Source publique</button>
      </div>
      <div className="row">
        <input className="input" placeholder="Identifiant (ex. B3)" list="public-sets" value={setId} onChange={(e) => setSetId(e.target.value)} />
        <input className="input" placeholder="Nom de l'extension" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {mode === 'text' ? (
        <textarea className="input" rows={8} placeholder={'## Mewtwo\n1 Bulbizarre ◊\n2 Herbizarre ◊◊\n(colle la liste d\'un site communautaire)'} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <datalist id="public-sets">
          {publicSets.map((s) => <option key={s.code} value={s.code}>{s.name.fr ?? s.name.en ?? s.code}</option>)}
        </datalist>
      )}
      <button className="btn primary big" onClick={load} disabled={!setId.trim() || (mode === 'text' && !text.trim())}>Prévisualiser</button>
      {error && <p className="warn">{error}</p>}

      {data && (
        <>
          <section>
            <h2 className="set-head"><SetBadge setId={data.set.id} name={data.set.name} text={data.set.id} />Aperçu : {data.set.name} ({data.cards.length} cartes)</h2>
            <p>{byRarity.map(([r, n]) => `${RARITY_LABEL[r]} ${n}`).join(' · ')}</p>
            {data.warnings.length > 0 && <details><summary className="warn">{data.warnings.length} avertissement(s)</summary><ul>{data.warnings.slice(0, 30).map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
            <div className="bb-list">{data.boosters.length ? data.boosters.map((b) => <BoosterBadge key={b.id} boosterId={b.id} setId={data.set.id} logo={false} text={b.name} />) : <p>Boosters : aucun</p>}</div>
            <ul className="list">
              {data.cards.slice(0, 8).map((c) => <li key={c.id} className="list-item"><span className="mono">{c.id}</span><span className="grow">{c.name}</span><span>{RARITY_LABEL[c.rarity]}</span></li>)}
            </ul>
          </section>
          <section>
            <h2>Taux d'obtention (%)</h2>
            <RatesEditor boosters={data.boosters} rarities={rarities} forms={forms} setForms={setForms} boosterId={boosterId} setBoosterId={setBoosterId} />
          </section>
          <button className="btn primary big" onClick={save}>Enregistrer l'extension</button>
        </>
      )}
    </div>
  )
}
