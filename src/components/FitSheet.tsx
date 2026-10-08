import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const PX_PER_MM = 96 / 25.4

/**
 * Shows a sheet of paper true to its proportions on any screen: when the paper is wider than
 * the space available it is shrunk as a whole, like a photograph, instead of letting the text
 * re-wrap into a layout that would not match the print. Printing ignores the shrink.
 */
export default function FitSheet({ paperWidthMm, className, children }: { paperWidthMm: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = width == null ? 1 : Math.min(1, width / (paperWidthMm * PX_PER_MM))
  return (
    <div ref={box} className={`fit${className ? ` ${className}` : ''}`}>
      <div className="fit-zoom" style={{ '--z': String(scale), width: `${paperWidthMm}mm` } as CSSProperties}>
        {children}
      </div>
    </div>
  )
}
