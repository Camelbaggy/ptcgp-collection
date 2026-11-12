import { useEffect, useState } from 'react'

/** SVG path (one rect per dark module, merged per row) of a QR code, level H by default. Loaded on demand (small lib). */
export function useQrPath(text: string | null, level: 'L' | 'M' | 'Q' | 'H' = 'H'): { path: string; size: number } | null {
  const [qr, setQr] = useState<{ text: string; path: string; size: number } | null>(null)
  useEffect(() => {
    if (!text) return
    let live = true
    import('qrcode-generator').then(({ default: qrcode }) => {
      const q = qrcode(0, level)
      q.addData(text, 'Byte')
      q.make()
      const n = q.getModuleCount()
      let path = ''
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (!q.isDark(y, x)) continue
          let w = 1
          while (x + w < n && q.isDark(y, x + w)) w++
          path += `M${x} ${y}h${w}v1h-${w}z`
          x += w
        }
      }
      if (live) setQr({ text, path, size: n })
    })
    return () => { live = false }
  }, [text, level])
  return qr && qr.text === text ? qr : null
}

export function QrSvg({ path, size, px, label }: { path: string; size: number; px?: number; label: string }) {
  const quiet = 4
  const v = size + quiet * 2
  return (
    <svg viewBox={`0 0 ${v} ${v}`} width={px} height={px} role="img" aria-label={label} shapeRendering="crispEdges" style={px ? undefined : { width: '100%', height: '100%' }}>
      <rect width={v} height={v} fill="#fff" />
      <path d={path} transform={`translate(${quiet} ${quiet})`} fill="#000" />
    </svg>
  )
}

