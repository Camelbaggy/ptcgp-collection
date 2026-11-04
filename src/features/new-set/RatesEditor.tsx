import { Icon } from '../../components/Icon'
import type { Booster, PackSlotRates, Rarity } from '../../lib/types'
import { RARITY_LABEL } from '../../lib/useData'

/** Formulaire des taux d'obtention (en %), partagé par « Nouvelle extension » et « Vérifier les taux ». */
export interface PackForm { packType: string; packTypeRate: string; slots: Record<string, string>[] }
export type RatesForms = Record<string, PackForm[]>

export const emptyPack = (type: string, rate: string): PackForm => ({ packType: type, packTypeRate: rate, slots: Array.from({ length: 5 }, () => ({})) })

const num = (v: string) => parseFloat(v.replace(',', '.')) || 0
const slotSum = (s: Record<string, string>) => Object.values(s).reduce((a, v) => a + num(v), 0)

/** Taux existants -> valeurs du formulaire (les lignes à 0 % / sans slot sont ignorées). */
export function ratesToForms(boosters: Booster[], rates: PackSlotRates[]): RatesForms {
  const out: RatesForms = {}
  for (const b of boosters) {
    const packs = rates.filter((r) => r.boosterId === b.id && r.slots.length).map((r): PackForm => ({
      packType: r.packType,
      packTypeRate: String(r.packTypeRate),
      slots: r.slots.map((s) => Object.fromEntries(Object.entries(s.rates).map(([k, v]) => [k, String(v)]))),
    }))
    out[b.id] = packs.length ? packs : [emptyPack('normal', '100')]
  }
  return out
}

/** Valeurs du formulaire -> PackSlotRates (les slots vides sont retirés). */
export function formsToRates(boosters: Booster[], forms: RatesForms): PackSlotRates[] {
  const rates: PackSlotRates[] = []
  for (const b of boosters) {
    for (const p of forms[b.id] ?? []) {
      const slots = p.slots.map((s, i) => ({
        slot: i + 1,
        rates: Object.fromEntries(Object.entries(s).filter(([, v]) => num(v) > 0).map(([r, v]) => [r, num(v)])) as Partial<Record<Rarity, number>>,
      })).filter((s) => Object.keys(s.rates).length)
      if (slots.length) rates.push({ boosterId: b.id, packType: p.packType || 'normal', packTypeRate: num(p.packTypeRate), slots })
    }
  }
  return rates
}

interface Props {
  boosters: Booster[]
  rarities: Rarity[]
  forms: RatesForms
  setForms: (f: RatesForms | ((f: RatesForms) => RatesForms)) => void
  boosterId: string
  setBoosterId: (id: string) => void
}

export default function RatesEditor({ boosters, rarities, forms, setForms, boosterId, setBoosterId }: Props) {
  const packs = forms[boosterId] ?? []
  const upd = (fn: (p: PackForm[]) => PackForm[]) => setForms((f) => ({ ...f, [boosterId]: fn(f[boosterId] ?? []) }))
  return (
    <>
      <div className="chips scroll">
        {boosters.map((b) => <button key={b.id} className={'chip big' + (b.id === boosterId ? ' on' : '')} onClick={() => setBoosterId(b.id)}>{b.name}</button>)}
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
            <button className="btn" onClick={() => upd((a) => a.map((x, i) => i === pi ? { ...x, slots: [...x.slots, { ...x.slots[x.slots.length - 1] }] } : x))}><Icon name="plus" />Slot</button>
            <button className="btn" onClick={() => upd((a) => a.map((x, i) => i === pi ? { ...x, slots: x.slots.length > 1 ? x.slots.slice(0, -1) : x.slots } : x))}><Icon name="minus" />Slot</button>
            {packs.length > 1 && <button className="btn danger" onClick={() => upd((a) => a.filter((_, i) => i !== pi))}><Icon name="trash" />Supprimer ce pack</button>}
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => upd((a) => [...a, emptyPack('rare', '0.05')])}><Icon name="plus" />Type de pack</button>
    </>
  )
}
