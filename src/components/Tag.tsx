import type { Condition } from '../lib/types'
import { tagColor } from '../lib/tags'

export function Tag({ condition }: { condition: Condition }) {
  const c = tagColor(condition.color)
  return (
    <span className="tag" style={{ background: c.bg, color: c.fg }}>
      {condition.name}
    </span>
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
