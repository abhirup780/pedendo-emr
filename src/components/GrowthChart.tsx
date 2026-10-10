import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { formatAge, formatDate } from '../lib/age'
import { chartBands, niceAxis } from '../lib/growth'
import type { ChartReference, CurveSegment, GrowthPoint } from '../lib/growth'
import { REFS } from '../lib/growth-reference'
import { Qty } from './Qty'

const signed = (z: number) => `${z < 0 ? '−' : '+'}${Math.abs(z).toFixed(2)}`

/**
 * How far through its time (0 to 1) a movement on the app's easing curve, cubic-bezier(0.2, 0,
 * 0, 1) (--ease in styles.css), has covered `part` of its distance. The curve is quick at
 * first and slow at the end, so half the distance is covered in well under half the time.
 */
function easeTime(part: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const s = (lo + hi) / 2
    if (3 * (1 - s) * s * s + s * s * s < part) lo = s
    else hi = s
  }
  const s = (lo + hi) / 2
  return 3 * (1 - s) * (1 - s) * s * 0.2 + s * s * s
}

/**
 * The child's measurements against age. The published reference lines are drawn behind the
 * points when one covers these ages; without one the chart shows the child's own line only.
 * Each part of the reference (WHO length, WHO height, IAP) is its own line: they are never
 * joined, because the tables do not meet.
 *
 * A point's place along the axis is its decimal age, as the references want it; the age
 * written beside it is the calendar age from the date of birth, the same as in the table
 * under the chart. (Decimal years turned back into months can come out a month ahead.)
 */
export default function GrowthChart({ points, reference, label, unit, target, dob }: { points: GrowthPoint[]; reference: ChartReference | null; label: string; unit: string; /** The child's date of birth, for the age written beside each measurement. */ dob: string; /** Mid-parental height and its range, in the chart's unit; drawn at 18 years when the chart reaches it. */ target?: { mid: number; low: number; high: number } | null }) {
  const [hover, setHover] = useState<number | null>(null)
  // The chart draws itself when the screen opens, and again each time another measure is chosen
  // ("draw" in styles.css). The class comes off when that is over.
  const [fresh, setFresh] = useState(true)
  // Another measure is another set of points: what was pointed at no longer applies, and the
  // drawing starts again.
  const [shown, setShown] = useState(label)
  if (shown !== label) {
    setShown(label)
    setHover(null)
    setFresh(true)
  }
  useEffect(() => {
    const timer = setTimeout(() => setFresh(false), 1100)
    return () => clearTimeout(timer)
  }, [label])
  // The drawing is laid out for the width it actually gets, so labels stay readable on a
  // phone instead of shrinking with the picture.
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [boxWidth, setBoxWidth] = useState(760)
  // How much of the window is left below the top of the chart. A wide chart is made to fit in
  // it, so that the whole chart is seen without scrolling.
  const [room, setRoom] = useState(440)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBoxWidth(r.width || 760)
      setRoom(window.innerHeight - (r.top + window.scrollY) - 28)
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length === 0])
  // Drawn at the size it is shown (up to 1240 px), not drawn small and stretched: its labels
  // are then the same size as the words around it.
  const W = Math.round(Math.max(300, Math.min(1240, boxWidth)))
  const narrow = W < 520
  const H = narrow ? Math.round(W * 0.9) : Math.round(Math.min(W * 0.62, Math.max(340, room)))
  const M = narrow ? { l: 40, r: 30, t: 20, b: 40 } : { l: 52, r: 44, t: 18, b: 42 }
  if (points.length === 0) return <div className="empty">No {label.toLowerCase()} recorded yet. It appears here after the first visit with a measurement.</div>

  const ages = points.map((p) => p.age)
  // With a reference the age axis is the published chart's own (0–2, 0–5, 5–18 or 0–18 years);
  // infants are labelled in months.
  const inMonths = reference != null && reference.to <= 2
  const xAxis = reference
    ? { min: reference.from, max: reference.to, step: inMonths ? (narrow ? 0.5 : 0.25) : niceAxis(reference.from, reference.to, narrow ? 7 : 13).step }
    : niceAxis(Math.min(...ages) - 0.4, Math.max(...ages) + 0.4, narrow ? 4 : 6)
  const segments = reference?.segments ?? []
  // Adult height belongs at the end of the published chart, so it is drawn only on one that runs to 18.
  const goal = target && reference && xAxis.max >= 18 ? target : null
  const ys = [...points.map((p) => p.value), ...segments.flatMap((s) => s.values.flat()), ...(goal ? [goal.low, goal.high] : [])]
  const span = Math.max(...ys) - Math.min(...ys) || 1
  // The reference lines already frame the picture, so they need less room around them than a
  // child's own few points do.
  const yAxis = reference
    ? niceAxis(Math.min(...ys) - span * 0.02, Math.max(...ys) + span * 0.02, narrow ? 8 : 10)
    : niceAxis(Math.min(...ys) - span * 0.08, Math.max(...ys) + span * 0.08, narrow ? 5 : 7)

  const x = (age: number) => M.l + ((age - xAxis.min) / (xAxis.max - xAxis.min)) * (W - M.l - M.r)
  const y = (v: number) => H - M.b - ((v - yAxis.min) / (yAxis.max - yAxis.min)) * (H - M.t - M.b)
  const ticks = (a: { min: number; max: number; step: number }) => {
    const out: number[] = []
    for (let v = Math.ceil(a.min / a.step - 1e-9) * a.step; v <= a.max + a.step / 1000; v += a.step) out.push(Math.round(v * 1000) / 1000)
    return out
  }
  const xt = ticks(xAxis)
  const yt = ticks(yAxis)
  const last = points[points.length - 1]
  const h = hover == null ? null : points[hover]
  const lastSegment = segments[segments.length - 1]
  const labelled = lastSegment && lastSegment.ages[lastSegment.ages.length - 1] >= xAxis.max - 0.01
  const handover = reference && reference.refs.length > 1 ? segments.find((s) => s.ref === 'iap2015')?.ages[0] : undefined
  // One line of the reference over one of its parts, as the points of a path.
  const run = (s: CurveSegment, i: number) => s.ages.map((age, j) => `${x(age).toFixed(1)} ${y(s.values[i][j]).toFixed(1)}`)
  const bands = reference ? chartBands(reference.lines) : []
  // While the chart draws itself, a measurement appears as the line reaches it: the line takes
  // 480 ms, starting 120 ms in (--once in styles.css), and `along` is how far along the line
  // each measurement lies.
  const along = points.map((_, i) => points.slice(1, i + 1).reduce((sum, p, j) => sum + Math.hypot(x(p.age) - x(points[j].age), y(p.value) - y(points[j].value)), 0))
  const reached = (i: number) => ({ animationDelay: `${Math.round(120 + easeTime(along[i] / (along[along.length - 1] || 1)) * 480)}ms` })
  const goalWidth = narrow ? 8 : 12
  // Line names at the right edge. Where the lines end too close together to name them all
  // (a 0–18 year chart on a phone), the median and the outermost lines are named first.
  const named = new Map<number, number>()
  if (reference && labelled) {
    const at = reference.lines.map((_, i) => y(lastSegment.values[i][lastSegment.ages.length - 1]))
    const rank = (i: number) => (reference.lines[i].kind === 'mid' ? 0 : i === 0 || i === at.length - 1 ? 1 : reference.lines[i].kind === 'inner' ? 3 : 2)
    for (const i of at.map((_, j) => j).sort((a, b) => rank(a) - rank(b))) {
      if ([...named.values()].every((taken) => Math.abs(taken - at[i]) >= 12)) named.set(i, at[i])
    }
  }
  const refNames = reference ? reference.refs.map((r) => REFS[r].short).join(' and ') : ''
  // The measurement nearest the pointer, if one is within reach. One sheet over the drawing
  // does this, so that visits a few months apart on an eighteen-year axis can still be picked.
  const point = (e: PointerEvent<SVGRectElement>) => {
    const r = svg.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    const k = W / r.width
    const px = (e.clientX - r.left) * k
    const py = (e.clientY - r.top) * k
    let best: number | null = null
    let reach = 44
    points.forEach((p, i) => {
      const d = Math.hypot(x(p.age) - px, y(p.value) - py)
      if (d < reach) {
        reach = d
        best = i
      }
    })
    setHover(best)
  }

  return (
    <div className={fresh ? 'gc draw' : 'gc'} ref={box}>
      {/* A drawing of its own for each measure (the key), so that each is drawn from nothing: one
          kept from the measure before would stand there finished. */}
      <svg key={label} ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} against age${refNames ? ` on the ${refNames} reference lines` : ''}: ${points.length} measurements, latest ${last.value} ${unit} at ${formatAge(dob, last.date)}${last.sds == null ? '' : `, SDS ${signed(last.sds)}`}${goal ? `; mid-parental height ${goal.mid.toFixed(1)} ${unit}` : ''}.`}>
        {yt.map((v) => <line key={`y${v}`} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="gc-grid" />)}
        {xt.map((v) => <line key={`x${v}`} y1={M.t} y2={H - M.b} x1={x(v)} x2={x(v)} className="gc-grid faint" />)}
        <path d={`M${M.l} ${M.t}V${H - M.b}H${W - M.r}`} className="gc-axis" />
        {yt.map((v) => <text key={`yl${v}`} x={M.l - 8} y={y(v) + 4} textAnchor="end" className="gc-tick">{v}</text>)}
        {xt.map((v) => <text key={`xl${v}`} x={x(v)} y={H - M.b + 18} textAnchor="middle" className="gc-tick">{inMonths ? Math.round(v * 12) : v}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="gc-tick">Age ({inMonths ? 'months' : 'years'})</text>
        {/* On a phone there is no room beside the axis; the tab above already names the measure. */}
        {!narrow && <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`} className="gc-tick">{label} ({unit})</text>}
        {narrow && <text x={M.l} y={M.t - 3} className="gc-tick">{unit}</text>}

        {handover != null && (
          <g className="gc-ref">
            <line x1={x(handover)} x2={x(handover)} y1={M.t} y2={H - M.b} className="gc-handover" />
            <text x={x(handover) - 5} y={M.t + 11} textAnchor="end" className="gc-tick">WHO</text>
            <text x={x(handover) + 5} y={M.t + 11} className="gc-tick">IAP</text>
          </g>
        )}
        {/* Soft shading between published lines. Each part of the reference is shaded by itself, as its lines are drawn by themselves. */}
        {bands.map((b) => segments.map((s, k) => <path key={`${b.depth}${k}`} d={`M${run(s, b.from).join('L')}L${run(s, b.to).reverse().join('L')}Z`} className={`gc-band gc-ref ${b.depth}`} />))}
        {reference && reference.lines.map((line, i) => (
          <g key={line.label} className="gc-ref">
            {segments.map((s, k) => (
              <path key={k} d={`M${run(s, i).join('L')}`} className={`gc-centile ${line.kind}`} />
            ))}
            {named.has(i) && <text x={W - M.r + 5} y={named.get(i)! + 4} className="gc-tick">{line.label}</text>}
          </g>
        ))}

        {goal && (
          <g className="gc-ref">
            <title>Mid-parental height {goal.mid.toFixed(1)} {unit}, target {goal.low.toFixed(1)} to {goal.high.toFixed(1)} {unit}</title>
            {/* The target range as a soft band at 18 years, with a line across the middle of it. */}
            <rect x={x(18) - goalWidth} y={y(goal.high)} width={goalWidth} height={y(goal.low) - y(goal.high)} rx={goalWidth / 2} className="gc-goal" />
            <line x1={x(18) - goalWidth - 4} x2={x(18) + 3} y1={y(goal.mid)} y2={y(goal.mid)} className="gc-goal mid" />
            {/* On a phone the figure is in the tile above the chart; the name alone covers less of the lines. */}
            <text x={x(18) - goalWidth - 8} y={y(goal.mid) + 4} textAnchor="end" className="gc-label goal">{narrow ? 'MPH' : `MPH ${goal.mid.toFixed(1)}`}</text>
          </g>
        )}

        {/* pathLength lets the stylesheet draw the line from its first point to its last, whatever its length. */}
        {points.length > 1 && <path d={`M${points.map((p) => `${x(p.age).toFixed(1)} ${y(p.value).toFixed(1)}`).join('L')}`} pathLength={1} className="gc-line" />}
        {/* The latest measurement stands in a soft ring, so that it is found at once. */}
        <circle cx={x(last.age)} cy={y(last.value)} r={narrow ? 10 : 12} className="gc-halo" style={fresh ? reached(points.length - 1) : undefined} />
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(p.age)} cy={y(p.value)} r={(i === points.length - 1 ? 6 : 4.5) * (narrow ? 0.78 : 1)} className={hover === i ? 'gc-dot at' : 'gc-dot'} style={fresh ? reached(i) : undefined} />
            <circle
              cx={x(p.age)} cy={y(p.value)} r={14} className="gc-hit" tabIndex={0} role="img"
              aria-label={`${formatDate(p.date)}, age ${formatAge(dob, p.date)}: ${p.value} ${unit}${p.sds == null ? '' : `, SDS ${signed(p.sds)}`}`}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            />
          </g>
        ))}
        {hover == null && (
          <text x={Math.min(x(last.age) + 12, W - M.r - 70)} y={y(last.value) - 13} className="gc-label now">{last.value}<tspan dx={3} className="gc-unit">{unit}</tspan></text>
        )}
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} className="gc-plot" onPointerMove={point} onPointerDown={point} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }} />
      </svg>
      {h && (
        <div className="gc-tip" role="status" style={{ left: `${(x(h.age) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          <div className="mono" style={{ fontWeight: 600 }}><Qty v={h.value} u={unit} /></div>
          <div>{formatDate(h.date)} · {formatAge(dob, h.date)}{h.sds == null ? '' : ` · SDS ${signed(h.sds)}`}</div>
        </div>
      )}
    </div>
  )
}
