import { useEffect, useMemo, useState } from 'react'
import type { Card } from '../../lib/types'
import type { MetaCard } from '../../lib/meta/compute'
import { DECK_SIZE } from '../../lib/meta/compute'
import { ENERGY_NAME, deckEnergies, encodeDeckCode } from '../../lib/deckcode'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { QrSvg, useQrPath } from '../../components/Qr'

/** Deck QR code section of the meta deck sheet: scannable by the game, or a short reason why not. */
export function DeckQr({ consensus, cardById }: { consensus: MetaCard[]; cardById: Map<string, Card> }) {
  const toast = useToast()
  const [big, setBig] = useState(false)
  const res = useMemo((): { error: string; code?: undefined; energies?: undefined } | { code: string; energies: number[]; error?: undefined } => {
    const total = consensus.reduce((n, c) => n + c.count, 0)
    if (total !== DECK_SIZE) return { error: `La liste type ne compte que ${total} cartes sur ${DECK_SIZE} : pas assez de listes pour générer un QR code fiable.` }
    const cards = consensus.map((c) => cardById.get(c.cardId))
    if (cards.some((c) => !c || c.entityId === undefined || !c.entityKind))
      return { error: 'Certaines cartes n’ont pas d’identifiant de jeu (extension trop récente) : QR code indisponible.' }
    const all = [...cardById.values()]
    const energies = deckEnergies(consensus, all)
    try {
      return { code: encodeDeckCode({ cards: consensus, energies }, all), energies }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [consensus, cardById])
  const code = res.code ?? null
  const qrRaw = useQrPath(code)
  const qr = qrRaw && !qrRaw.tooLong ? qrRaw : null

  useEffect(() => {
    if (!big) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setBig(false) } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [big])

  const copy = async () => {
    try { await navigator.clipboard.writeText(code!); toast('Code copié') } catch { toast('Copie impossible') }
  }

  if (!code) return <p className="muted">{res.error}</p>
  return (
    <div className="deck-qr">
      <button className="qr-box" onClick={() => setBig(true)} aria-label="Agrandir le QR code" disabled={!qr}>
        {qr ? <QrSvg path={qr.path} size={qr.size} px={280} label="QR code du deck" /> : <span className="muted">…</span>}
      </button>
      <p className="muted qr-help">Scanne ce code depuis l’écran des decks du jeu. Touche le code pour l’agrandir.</p>
      <div className="chips qr-energies" aria-label="Énergies">
        {res.energies?.map((e) => <span key={e} className="chip">{ENERGY_NAME[e]}</span>)}
      </div>
      <button className="btn" onClick={copy}><Icon name="download" />Copier le code</button>
      {big && qr && (
        <div className="qr-full" role="dialog" aria-modal="true" aria-label="QR code du deck" onClick={() => setBig(false)}>
          <QrSvg path={qr.path} size={qr.size} label="QR code du deck" />
          <span>Touche pour fermer</span>
        </div>
      )}
    </div>
  )
}
