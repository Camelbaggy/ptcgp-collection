import { useEffect, useMemo, useState } from 'react'
import { fetchPublicSet, fetchPublicSetList, importFromText, type ImportedSet, type PublicSet } from '../../lib/importers'
import { db, saveNewSet } from '../../lib/db'
import { RARITIES, RARITY_LABEL } from '../../lib/useData'
import { useToast } from '../../components/Toast'
import type { PackSlotRates, Rarity } from '../../lib/types'

interface PackForm { packType: string; packTypeRate: string; slots: Record<string, string>[] }
const emptyPack = (type: string, rate: string): PackForm => ({ packType: type, packTypeRate: rate, slots: Array.from({ length: 5 }, () => ({})) })

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
  const [forms, setForms] = useState<Record<string, PackForm[]>>({})

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
      const f: Record<string, PackForm[]> = {}
      for (const b of res.boosters) f[b.id] = [emptyPack('normal', '100')]
      setForms(f)
      setBoosterId(res.boosters[0]?.id ?? '')
      setData(res)
    } catch (e) { setError((e as Error).message); setData(null) }
  }

  const packs = forms[boosterId] ?? []
  const upd = (fn: (p: PackForm[]) => PackForm[]) => setForms((f) => ({ ...f, [boosterId]: fn(f[boosterId] ?? []) }))
  const slotSum = (s: Record<string, string>) => Object.values(s).reduce((a, v) => a + (parseFloat(v.replace(',', '.')) || 0), 0)

  const save = async () => {
    if (!data) return
    const num = (v: string) => parseFloat(v.replace(',', '.')) || 0
    const rates: PackSlotRates[] = []
    for (const b of data.boosters) {
      for (const p of forms[b.id] ?? []) {
        const slots = p.slots.map((s, i) => ({
          slot: i + 1,
          rates: Object.fromEntries(Object.entries(s).filter(([, v]) => num(v) > 0).map(([r, v]) => [r, num(v)])) as Partial<Record<Rarity, number>>,
        })).filter((s) => Object.keys(s.rates).length)
        if (slots.length) rates.push({ boosterId: b.id, packType: p.packType || 'normal', packTypeRate: num(p.packTypeRate), slots })
      }
    }
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
            <h2>Aperçu : {data.set.name} ({data.cards.length} cartes)</h2>
            <p>{byRarity.map(([r, n]) => `${RARITY_LABEL[r]} ${n}`).join(' · ')}</p>
            {data.warnings.length > 0 && <details><summary className="warn">{data.warnings.length} avertissement(s)</summary><ul>{data.warnings.slice(0, 30).map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
            <p>Boosters : {data.boosters.map((b) => b.name).join(', ') || 'aucun'}</p>
            <ul className="list">
              {data.cards.slice(0, 8).map((c) => <li key={c.id} className="list-item"><span className="mono">{c.id}</span><span className="grow">{c.name}</span><span>{RARITY_LABEL[c.rarity]}</span></li>)}
            </ul>
          </section>
          <section>
            <h2>Taux d'obtention (%)</h2>
            <div className="chips scroll">
              {data.boosters.map((b) => <button key={b.id} className={'chip big' + (b.id === boosterId ? ' on' : '')} onClick={() => setBoosterId(b.id)}>{b.name}</button>)}
            </div>
            {packs.map((p, pi) => (
              <div key={pi} className="packform">
                <div className="row">
                  <input className="input" value={p.packType} placeholder="Type de pack" onChange={(e) => upd((a) => a.map((x, i) => i === pi ? { ...x, packType: e.target.value } : x))} />
                  <input className="input" inputMode="decimal" value={p.packTypeRate} placeholder="% du type" onChange={(e) => upd((a) => a.map((x, i) => i === pi ? { ...x, packTypeRate: e.target.value } : x))} />
                </div>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Slot</th>{rarities.map((r) => <th key={r}>{RARITY_LABEL[r]}</th>)}<th>Σ</th></tr></thead>
                    <tbody>
                      {p.slots.map((s, si) => {
                        const sum = slotSum(s)
                        return (
                          <tr key={si}>
                            <td>{si + 1}</td>
                            {rarities.map((r) => (
                              <td key={r}><input inputMode="decimal" value={s[r] ?? ''} onChange={(e) => upd((a) => a.map((x, i) => i === pi ? { ...x, slots: x.slots.map((y, j) => j === si ? { ...y, [r]: e.target.value } : y) } : x))} /></td>
                            ))}
                            <td className={sum === 0 || Math.abs(sum - 100) < 0.05 ? '' : 'warn'}>{Math.round(sum * 100) / 100}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="row">
                  <button className="btn" onClick={() => upd((a) => a.map((x, i) => i === pi ? { ...x, slots: [...x.slots, { ...x.slots[x.slots.length - 1] }] } : x))}>+ Slot</button>
                  <button className="btn" onClick={() => upd((a) => a.map((x, i) => i === pi ? { ...x, slots: x.slots.length > 1 ? x.slots.slice(0, -1) : x.slots } : x))}>− Slot</button>
                  {packs.length > 1 && <button className="btn danger" onClick={() => upd((a) => a.filter((_, i) => i !== pi))}>Supprimer ce pack</button>}
                </div>
              </div>
            ))}
            <button className="btn" onClick={() => upd((a) => [...a, emptyPack('rare', '0.05')])}>+ Type de pack</button>
          </section>
          <button className="btn primary big" onClick={save}>Enregistrer l'extension</button>
        </>
      )}
    </div>
  )
}
