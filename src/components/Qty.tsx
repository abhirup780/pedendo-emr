import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { lessMotion } from './hooks'

/**
 * A measurement: the number leads, and its unit follows small and grey. The space between
 * them does not break, so a unit is never left alone at the start of a line.
 */
export function Qty({ v, u }: { v: string | number; u: string }) {
  return (
    <>
      {v}
      {u && <span className="u">{` ${u}`}</span>}
    </>
  )
}

/**
 * Where an SDS falls between −3 and +3: a line with a mark at each whole SD (the taller one is
 * 0) and a dot. Position only: no colour, no bands, nothing that passes judgement. A value
 * beyond either end is an arrowhead at that end. It is for the eye; the figure beside it is
 * what a screen reader reads.
 */
export function SdsScale({ z }: { z: number | null | undefined }) {
  if (z == null || !Number.isFinite(z)) return null
  const at = (Math.max(-3, Math.min(3, z)) + 3) / 6
  return (
    <span className="sds" aria-hidden="true" title="From −3 to +3 SD. The tall mark is 0." style={{ '--at': at } as CSSProperties}>
      {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
        <i key={n} className={n === 0 ? 'zero' : undefined} />
      ))}
      <b className={z < -3 ? 'low' : z > 3 ? 'high' : undefined} />
    </span>
  )
}

/**
 * One of a row of calculated figures (a cell of `.calc`). When what it shows changes, it is
 * washed with colour for a moment, so that the eye finds the figure that moved; `of` is the
 * figure as text, to tell a change by. Nothing happens when the screen first opens.
 */
export function Figure({ of, children }: { of: string; children: ReactNode }) {
  const cell = useRef<HTMLDivElement>(null)
  const was = useRef(of)
  useEffect(() => {
    if (was.current === of) return
    was.current = of
    const el = cell.current
    if (!el || typeof el.animate !== 'function' || lessMotion()) return
    const tint = getComputedStyle(el).getPropertyValue('--primary-tint').trim() || '#e3f0f0'
    el.animate([{ backgroundColor: tint }, {}], { duration: 480, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
  }, [of])
  return <div ref={cell}>{children}</div>
}
