import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const PX_PER_MM = 96 / 25.4

/**
 * Shows a sheet of paper true to its proportions on any screen: when the paper is wider than
 * the space available it is shrunk as a whole, like a photograph, instead of letting the text
 * re-wrap into a layout that would not match the print. Printing ignores the shrink.
 *
 * Given a `label`, the box is one that may scroll (the layout editor's preview does): it is
 * named, and the keyboard can reach it, like the app's scrolling tables.
 */
export default function FitSheet({ paperWidthMm, className, label, children }: { paperWidthMm: number; className?: string; label?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  // Measured before the first painting, so that the sheet is never seen at full size for a
  // moment and then shrunk.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // The room inside the box: without its padding, and without the room it keeps for a scrollbar.
    const cs = getComputedStyle(el)
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    if (room > 0) setWidth(room)
  }, [])
  // From then on the box itself says when its width changes, to a fraction of a pixel.
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = width == null ? 1 : Math.min(1, width / (paperWidthMm * PX_PER_MM))
  return (
    <div ref={box} className={`fit${className ? ` ${className}` : ''}`} {...(label ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}>
      <div className="fit-zoom" style={{ '--z': String(scale), width: `${paperWidthMm}mm` } as CSSProperties}>
        {children}
      </div>
    </div>
  )
}
