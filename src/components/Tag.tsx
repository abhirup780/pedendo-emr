import type { Condition } from '../lib/types'
import { TAG_COLORS, tagColor } from '../lib/tags'

export function Tag({ condition }: { condition: Condition }) {
  const c = tagColor(condition.color)
  return (
    <span className="tag" style={{ background: c.bg, color: c.fg }}>
      {condition.name}
    </span>
  )
}

/** The row of colour dots for choosing a tag's colour. */
export function Swatches({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {Object.entries(TAG_COLORS).map(([key, c]) => (
        <button key={key} type="button" className="swatch" aria-label={c.label} aria-pressed={value === key} style={{ background: c.fg }} onClick={() => onChange(key)} />
      ))}
    </div>
  )
}

/** Filter or toggle chip in a tag's colour; filled when pressed. */
export function TagChip(props: { label: string; color: string; pressed: boolean; count?: number; onClick: () => void }) {
  const c = tagColor(props.color)
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      style={{ borderColor: c.fg, background: props.pressed ? c.fg : c.bg, color: props.pressed ? '#fff' : c.fg }}
    >
      {props.label}
      {props.count != null && <span className="n">{props.count}</span>}
    </button>
  )
}
