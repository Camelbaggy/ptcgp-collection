import { Icon } from './Icon'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastState { msg: string; action?: { label: string; run: () => void } }
const Ctx = createContext<(msg: string, action?: ToastState['action']) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((msg: string, action?: ToastState['action']) => {
    setT({ msg, action })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setT(null), 6000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span className="tile-ic"><Icon name="check" /></span>
          <span className="grow">{t.msg}</span>
          {t.action && (
            <button onClick={() => { t.action!.run(); setT(null) }}>{t.action.label}</button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
