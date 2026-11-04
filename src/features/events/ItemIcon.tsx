import { useEffect, useState } from 'react'
import { BASE } from '../../lib/db'
import { resolveItemIcon, type BuiltinIcon, type IconCtx, type ItemIconManifest } from '../../lib/events/itemIcons'
import { itemLabelFr } from '../../lib/events/translate'

// The manifest (public/data/item-icons.json) is produced at deploy time; absent in dev: built-in icons are used then.
let manifestP: Promise<ItemIconManifest | undefined> | undefined
function loadManifest(): Promise<ItemIconManifest | undefined> {
  manifestP ??= fetch(`${BASE}data/item-icons.json`)
    .then(async (r) => {
      const j = r.ok ? await r.json() : undefined
      return j && typeof j === 'object' && j.items && Array.isArray(j.emblems) ? (j as ItemIconManifest) : undefined
    })
    .catch(() => undefined)
  return manifestP
}
export function useItemIconManifest(): ItemIconManifest | undefined {
  const [m, setM] = useState<ItemIconManifest>()
  useEffect(() => { let on = true; loadManifest().then((x) => on && setM(x)); return () => { on = false } }, [])
  return m
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const SHAPES: Record<BuiltinIcon, React.ReactNode> = {
  exp: <><rect x="2" y="6" width="20" height="12" rx="6" fill="#3b82f6" /><text x="12" y="15" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="system-ui,sans-serif">EXP</text></>,
  emblem: <><path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15.4 6.8 18.1l1-5.8L3.5 8.2l5.9-.9z" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" /></>,
  cover: <><path {...P} d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6z" /><path {...P} d="M6 3v18M10 8h5" /></>,
  backdrop: <><rect {...P} x="3" y="4" width="18" height="13" rx="2" /><path {...P} d="M3 14l5-4 4 3 3-2 6 4M9 21h6M12 17v4" /></>,
  sleeve: <><rect {...P} x="6" y="3" width="12" height="18" rx="2" /><path {...P} d="M9 7h6M9 17h6" /></>,
  playmat: <><rect {...P} x="2" y="6" width="20" height="12" rx="2" /><circle {...P} cx="12" cy="12" r="3" /><path {...P} d="M12 6v3M12 15v3" /></>,
  coin: <><circle cx="12" cy="12" r="9" fill="#fbbf24" stroke="#b45309" strokeWidth="1.4" /><circle {...P} cx="12" cy="12" r="5" stroke="#b45309" /></>,
  profile: <><rect {...P} x="3" y="3" width="18" height="18" rx="4" /><circle {...P} cx="12" cy="10" r="3" /><path {...P} d="M6 19c1-3 3-4 6-4s5 1 6 4" /></>,
  pack: <><path {...P} d="M7 3h10l1 3v15H6V6zM6 6h12M9 11h6M9 15h6" /></>,
  deck: <><rect {...P} x="8" y="3" width="12" height="16" rx="2" /><path {...P} d="M5 7v12a2 2 0 002 2h9M11 8h6M11 12h6" /></>,
  card: <><rect {...P} x="5" y="3" width="14" height="18" rx="2" /><rect {...P} x="8" y="6" width="8" height="7" /><path {...P} d="M8 16h8" /></>,
  gift: <><rect {...P} x="3" y="9" width="18" height="12" rx="1" /><path {...P} d="M3 13h18M12 9v12M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0" /></>,
}

/** Icône d'un objet (image Serebii si disponible, sinon pictogramme intégré). `file` = nom du fichier d'icône Pokémon-Zone. */
export function ItemIcon({ file, label, ctx, size = 28 }: { file?: string; label?: string; ctx?: IconCtx; size?: number }) {
  const manifest = useItemIconManifest()
  const ref = resolveItemIcon(file, ctx, manifest)
  const [broken, setBroken] = useState<string>()
  const title = label ?? (file ? itemLabelFr(file) : 'Objet')
  const src = ref.kind === 'image' ? BASE + ref.path : undefined
  if (ref.kind === 'image' && broken !== src) {
    return <img className="ev-ico" src={src} width={size} height={size} alt={title} title={title} loading="lazy" onError={() => setBroken(src)} />
  }
  const id: BuiltinIcon = ref.kind === 'builtin' ? ref.id : 'gift'
  return (
    <svg className="ev-ico" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title}><title>{title}</title>{SHAPES[id]}</svg>
  )
}
