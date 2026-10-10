import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Shut and off the page; drawn shut, about to open; opening; open and at rest; shutting. */
type Phase = 'shut' | 'ready' | 'open' | 'still' | 'closing'

/**
 * Something that folds away: the staging pictures, a medicine's boxes, a test's earlier
 * results. It slides open and shut instead of jumping, and is taken off the page once shut.
 * What starts open is simply there, so nothing slides while a screen loads.
 *
 * `gap` is the space between it and what is above it. That space belongs inside the fold, so
 * that it opens and closes with it; a gap set on the parent would appear all at once.
 * `className` is for the stylesheet to place the fold in its parent's grid or row.
 */
export default function Fold({ open, gap = 0, className, children }: { open: boolean; gap?: number; className?: string; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(open ? 'still' : 'shut')
  const box = useRef<HTMLDivElement>(null)
  // Asked to open or to shut since it was last drawn.
  if (open && (phase === 'shut' || phase === 'closing')) setPhase(phase === 'shut' ? 'ready' : 'open')
  if (!open && phase !== 'shut' && phase !== 'closing') setPhase('closing')

  useEffect(() => {
    if (phase === 'ready') {
      // It is drawn shut first, and measured, so that the browser has somewhere to slide from.
      void box.current?.offsetHeight
      const next = setTimeout(() => setPhase((p) => (p === 'ready' ? 'open' : p)), 0)
      return () => clearTimeout(next)
    }
    if (phase === 'open' || phase === 'closing') {
      // A little longer than the slide itself (--calm in styles.css).
      const timer = setTimeout(() => setPhase((p) => (p !== phase ? p : phase === 'open' ? 'still' : 'shut')), 200)
      return () => clearTimeout(timer)
    }
  }, [phase])

  if (phase === 'shut') return null
  const wide = phase === 'open' || phase === 'still'
  return (
    <div ref={box} className={`fold${wide ? ' open' : ''}${phase === 'still' ? ' still' : ''}${className ? ` ${className}` : ''}`}>
      <div className="fold-in">{gap ? <div style={{ paddingTop: gap }}>{children}</div> : children}</div>
    </div>
  )
}
