// Locks the page behind modal sheets. Ref-counted so stacked sheets share one lock.
// `position: fixed` on <body> is the only approach that also stops scrolling on iOS Safari;
// the scroll position is restored on unlock.
let count = 0
let savedY = 0
let saved: Partial<CSSStyleDeclaration> = {}

export function lockScroll(): () => void {
  if (count++ === 0) {
    const b = document.body
    savedY = window.scrollY
    saved = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, overflow: b.style.overflow }
    b.style.position = 'fixed'
    b.style.top = `-${savedY}px`
    b.style.left = '0'
    b.style.right = '0'
    b.style.width = '100%'
    b.style.overflow = 'hidden'
    document.documentElement.classList.add('scroll-locked')
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--count === 0) {
      Object.assign(document.body.style, saved)
      document.documentElement.classList.remove('scroll-locked')
      window.scrollTo(0, savedY)
    }
  }
}
