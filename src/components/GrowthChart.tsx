import { useEffect, useRef, useState } from 'react'
import { formatDate } from '../lib/age'
import { niceAxis } from '../lib/growth'
import type { ChartReference, GrowthPoint } from '../lib/growth'
import { REFS } from '../lib/growth-reference'

function ageLabel(years: number): string {
  // A hair is added so that an age of exactly 6 years 6 months does not read as 6y 5m.
  const months = Math.floor(years * 12 + 0.02)
  return `${Math.floor(months / 12)}y ${months % 12}m`
}

const signed = (z: number) => `${z < 0 ? '−' : '+'}${Math.abs(z).toFixed(2)}`

/**
 * The child's measurements against age. The published reference lines are drawn behind the
 * points when one covers these ages; without one the chart shows the child's own line only.
 * Each part of the reference (WHO length, WHO height, IAP) is its own line: they are never
 * joined, because the tables do not meet.
 */
export default function GrowthChart({ points, reference, label, unit }: { points: GrowthPoint[]; reference: ChartReference | null; label: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  // The drawing is laid out for the width it actually gets, so labels stay readable on a
  // phone instead of shrinking with the picture.
  const box = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(760)
  useEffect(() => {
    const el = box.current
    if (!el) return
    setBoxWidth(el.getBoundingClientRect().width || 760)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setBoxWidth(entries[0].contentRect.width || 760))
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length === 0])
  const W = Math.round(Math.max(300, Math.min(760, boxWidth)))
  const narrow = W < 520
  const H = narrow ? Math.round(W * 0.9) : 440
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
  const ys = [...points.map((p) => p.value), ...segments.flatMap((s) => s.values.flat())]
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

  return (
    <div className="gc" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} against age${refNames ? ` on the ${refNames} reference lines` : ''}: ${points.length} measurements, latest ${last.value} ${unit} at ${ageLabel(last.age)}${last.sds == null ? '' : `, SDS ${signed(last.sds)}`}.`}>
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
          <g>
            <line x1={x(handover)} x2={x(handover)} y1={M.t} y2={H - M.b} className="gc-handover" />
            <text x={x(handover) - 5} y={M.t + 11} textAnchor="end" className="gc-tick">WHO</text>
            <text x={x(handover) + 5} y={M.t + 11} className="gc-tick">IAP</text>
          </g>
        )}
        {reference && reference.lines.map((line, i) => (
          <g key={line.label}>
            {segments.map((s, k) => (
              <path key={k} d={s.ages.map((age, j) => `${j ? 'L' : 'M'}${x(age).toFixed(1)} ${y(s.values[i][j]).toFixed(1)}`).join(' ')} className={`gc-centile ${line.kind}`} />
            ))}
            {named.has(i) && <text x={W - M.r + 5} y={named.get(i)! + 4} className="gc-tick">{line.label}</text>}
          </g>
        ))}

        {points.length > 1 && <polyline points={points.map((p) => `${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} className="gc-line" />}
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(p.age)} cy={y(p.value)} r={i === points.length - 1 ? 6 : 4.5} className="gc-dot" />
            <circle
              cx={x(p.age)} cy={y(p.value)} r={14} className="gc-hit" tabIndex={0} role="img"
              aria-label={`${formatDate(p.date)}, age ${ageLabel(p.age)}: ${p.value} ${unit}${p.sds == null ? '' : `, SDS ${signed(p.sds)}`}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            />
          </g>
        ))}
        {hover == null && (
          <text x={Math.min(x(last.age) + 10, W - M.r - 70)} y={y(last.value) - 10} className="gc-label">{last.value} {unit}</text>
        )}
      </svg>
      {h && (
        <div className="gc-tip" role="status" style={{ left: `${(x(h.age) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          <div className="mono" style={{ fontWeight: 600 }}>{h.value} {unit}</div>
          <div>{formatDate(h.date)} · {ageLabel(h.age)}{h.sds == null ? '' : ` · SDS ${signed(h.sds)}`}</div>
        </div>
      )}
    </div>
  )
}
