import { useEffect, useRef, useState } from 'react'
import { formatDate } from '../lib/age'
import { niceAxis } from '../lib/growth'
import type { GrowthPoint } from '../lib/growth'
import type { ReferenceTable } from '../lib/growth-reference'


function ageLabel(years: number): string {
  const y = Math.floor(years)
  const m = Math.floor((years - y) * 12)
  return `${y}y ${m}m`
}

/**
 * The child's measurements against age. Reference centile curves are drawn behind the points
 * when a table is supplied; without one the chart shows the child's own line only.
 */
export default function GrowthChart({ points, reference, label, unit }: { points: GrowthPoint[]; reference: ReferenceTable | null; label: string; unit: string }) {
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
  const xAxis = reference
    ? niceAxis(reference.rows[0].age, reference.rows[reference.rows.length - 1].age, narrow ? 7 : 13)
    : niceAxis(Math.min(...ages) - 0.4, Math.max(...ages) + 0.4, narrow ? 4 : 6)
  const curveRows = reference ? reference.rows.filter((r) => r.age >= xAxis.min && r.age <= xAxis.max) : []
  const ys = [...points.map((p) => p.value), ...curveRows.flatMap((r) => r.values)]
  const span = Math.max(...ys) - Math.min(...ys) || 1
  const yAxis = niceAxis(Math.min(...ys) - span * 0.08, Math.max(...ys) + span * 0.08, narrow ? 5 : 7)

  const x = (age: number) => M.l + ((age - xAxis.min) / (xAxis.max - xAxis.min)) * (W - M.l - M.r)
  const y = (v: number) => H - M.b - ((v - yAxis.min) / (yAxis.max - yAxis.min)) * (H - M.t - M.b)
  const ticks = (a: { min: number; max: number; step: number }) => {
    const out: number[] = []
    for (let v = a.min; v <= a.max + a.step / 1000; v += a.step) out.push(Math.round(v * 1000) / 1000)
    return out
  }
  const xt = ticks(xAxis)
  const yt = ticks(yAxis)
  const last = points[points.length - 1]
  const h = hover == null ? null : points[hover]

  return (
    <div className="gc" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} against age: ${points.length} measurements, latest ${last.value} ${unit} at ${ageLabel(last.age)}.`}>
        {yt.map((v) => <line key={`y${v}`} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="gc-grid" />)}
        {xt.map((v) => <line key={`x${v}`} y1={M.t} y2={H - M.b} x1={x(v)} x2={x(v)} className="gc-grid faint" />)}
        <path d={`M${M.l} ${M.t}V${H - M.b}H${W - M.r}`} className="gc-axis" />
        {yt.map((v) => <text key={`yl${v}`} x={M.l - 8} y={y(v) + 4} textAnchor="end" className="gc-tick">{v}</text>)}
        {xt.map((v) => <text key={`xl${v}`} x={x(v)} y={H - M.b + 18} textAnchor="middle" className="gc-tick">{v}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="gc-tick">Age (years)</text>
        {/* On a phone there is no room beside the axis; the tab above already names the measure. */}
        {!narrow && <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`} className="gc-tick">{label} ({unit})</text>}
        {narrow && <text x={M.l} y={M.t - 3} className="gc-tick">{unit}</text>}

        {reference && reference.centiles.map((c, i) => (
          <g key={c}>
            <path d={curveRows.map((r, j) => `${j ? 'L' : 'M'}${x(r.age).toFixed(1)} ${y(r.values[i]).toFixed(1)}`).join(' ')} className={c === 50 ? 'gc-centile mid' : i === 0 || i === reference.centiles.length - 1 ? 'gc-centile edge' : 'gc-centile'} />
            {curveRows.length > 0 && <text x={W - M.r + 6} y={y(curveRows[curveRows.length - 1].values[i]) + 4} className="gc-tick">{c}</text>}
          </g>
        ))}

        {points.length > 1 && <polyline points={points.map((p) => `${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} className="gc-line" />}
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(p.age)} cy={y(p.value)} r={i === points.length - 1 ? 6 : 4.5} className="gc-dot" />
            <circle
              cx={x(p.age)} cy={y(p.value)} r={14} className="gc-hit" tabIndex={0} role="img"
              aria-label={`${formatDate(p.date)}, age ${ageLabel(p.age)}: ${p.value} ${unit}`}
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
          <div>{formatDate(h.date)} · {ageLabel(h.age)}</div>
        </div>
      )}
    </div>
  )
}
