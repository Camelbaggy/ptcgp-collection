import { useState, type ReactNode } from 'react'
import { BoosterEmblem, SetLogo } from '../../components/Brand'
import { ChangeLine } from '../../components/PageKit'
import { Sheet } from '../../components/Sheet'
import { splitSets } from '../../lib/useData'
import type { CardSet } from '../../lib/types'
import type { BoosterChoice } from './boosterChoice'

/*
 * Choix d'extension et de booster de l'écran Ajout (lot L05) : une ligne « Changer » (logo + code, ou logo +
 * emblème + booster) qui ouvre une feuille ; les extensions y sont en grille « logo + code » (le logo dit déjà le nom).
 */

/** Grille d'extensions (3 colonnes) : bouton logo + code, l'extension choisie est marquée. */
export function SetGrid({ sets, value, onPick, label = 'Extensions' }: { sets: CardSet[]; value?: string; onPick: (id: string) => void; label?: string }) {
  const { regular, special } = splitSets(sets)
  const btn = (s: CardSet) => (
    <button key={s.id} type="button" className={'set-pick' + (s.id === value ? ' on' : '')} aria-pressed={s.id === value} aria-label={`${s.id} · ${s.name}`} title={s.name} onClick={() => onPick(s.id)}>
      <SetLogo setId={s.id} name="" /><span className="set-pick-code">{s.id}</span>
    </button>
  )
  return (
    <>
      <div className="set-grid" role="group" aria-label={label}>{[...regular].reverse().map(btn)}</div>
      {special.length > 0 && <><h3 className="set-grid-h">Promos et spéciaux</h3><div className="set-grid" role="group" aria-label="Promos et spéciaux">{special.map(btn)}</div></>}
    </>
  )
}

/** Ligne « extension · Changer » + feuille de choix. `detail` : une donnée à droite (ex. « 190 / 217 »). */
export function SetLine({ sets, value, onPick, detail, disabled }: { sets: CardSet[]; value?: CardSet; onPick: (id: string) => void; detail?: ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <ChangeLine logo={value && <SetLogo setId={value.id} name={value.name} fallback={<span className="cl-code">{value.name}</span>} />} label={value?.id ?? 'Extension'} detail={detail}
        onChange={() => { if (!disabled) setOpen(true) }} />
      {open && (
        <Sheet title="Extension" onClose={() => setOpen(false)}>
          <SetGrid sets={sets} value={value?.id} onPick={(id) => { onPick(id); setOpen(false) }} />
        </Sheet>
      )}
    </>
  )
}

/**
 * Ligne « booster · Changer » de la saisie d'un booster : logo d'extension + emblème + nom du booster.
 * La feuille : extensions, boosters de l'extension choisie, et (saisie manuelle) « Chercher dans tous les boosters ».
 */
export function BoosterLine({ ch, wholeSet, setWholeSet, onChange }: {
  ch: BoosterChoice
  /** Case « Chercher dans tous les boosters de l'extension » (saisie manuelle seulement). */
  wholeSet?: boolean
  setWholeSet?: (v: boolean) => void
  onChange?: () => void
}) {
  const { curSet, setBoosters, curBooster } = ch
  const [open, setOpen] = useState(false)
  const withBoosters = ch.sets.filter((s) => ch.boosters.some((b) => b.setId === s.id))
  const many = setBoosters.length > 1
  const pickSet = (id: string) => {
    ch.setSetId(id); ch.setBoosterId(''); onChange?.()
    if (ch.boosters.filter((b) => b.setId === id).length <= 1) setOpen(false)
  }
  return (
    <>
      <ChangeLine
        logo={curSet && <><SetLogo setId={curSet.id} name={curSet.name} fallback={<span className="cl-code">{curSet.id}</span>} />{curBooster && <BoosterEmblem boosterId={curBooster.id} />}</>}
        label={(wholeSet && many) || !curBooster ? curSet?.id ?? 'Booster' : curBooster.name}
        detail={wholeSet && many ? 'Tous les boosters' : undefined}
        onChange={() => setOpen(true)} />
      {open && (
        <Sheet title="Booster" onClose={() => setOpen(false)}>
          {many && (
            <>
              <h3 className="set-grid-h">Booster</h3>
              <div className="chips booster-picks" role="group" aria-label="Booster">
                {setBoosters.map((b) => (
                  <button key={b.id} type="button" aria-pressed={b.id === curBooster?.id && !wholeSet} className={'chip big' + (b.id === curBooster?.id ? ' on' : '')}
                    onClick={() => { ch.setBoosterId(b.id); setWholeSet?.(false); onChange?.(); setOpen(false) }}><BoosterEmblem boosterId={b.id} />{b.name}</button>
                ))}
              </div>
              {setWholeSet && (
                <label className="check"><input type="checkbox" checked={!!wholeSet} onChange={(e) => setWholeSet(e.target.checked)} /> Chercher dans tous les boosters de l'extension</label>
              )}
            </>
          )}
          <h3 className="set-grid-h">Extension</h3>
          <SetGrid sets={withBoosters} value={curSet?.id} onPick={pickSet} />
        </Sheet>
      )}
    </>
  )
}
