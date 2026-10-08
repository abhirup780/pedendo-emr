import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { tagColor } from '../lib/tags'
import type { Condition } from '../lib/types'

/**
 * The condition filter on the patient list: one button that opens a list with a search box.
 * It stays one line however many condition tags there are. Up and down arrows move through
 * the list, Enter chooses, Escape closes.
 */
export default function ConditionFilter(props: { conditions: Condition[]; counts: Record<string, number>; value: string | null; onChange: (id: string | null) => void }) {
  const { conditions, counts, value, onChange } = props
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  const chosen = conditions.find((c) => c.id === value) ?? null
  // null stands for "All conditions"; it is left out while searching.
  const options = useMemo<(Condition | null)[]>(() => {
    const words = q.trim().toLowerCase()
    if (!words) return [null, ...conditions]
    return conditions.filter((c) => c.name.toLowerCase().includes(words))
  }, [conditions, q])

  useEffect(() => {
    if (open) document.getElementById(`${id}-${at}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, at, id])

  // A tap elsewhere closes the list. Focus leaving is not enough: a phone does not focus a
  // tapped button, and on a touch screen the search box is not focused for you.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // On a touch screen the keyboard would cover the list, so the search box waits to be tapped.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  function toggle() {
    if (!open) {
      setQ('')
      setAt(chosen ? conditions.indexOf(chosen) + 1 : 0)
    }
    setOpen(!open)
  }
  function pick(c: Condition | null) {
    onChange(c ? c.id : null)
    setOpen(false)
    button.current?.focus()
  }
  function keys(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const last = options.length - 1
      setAt(e.key === 'ArrowDown' ? Math.min(at + 1, last) : Math.max(at - 1, 0))
    } else if (e.key === 'Enter' && !(e.target as HTMLElement).closest('.icon-btn')) {
      e.preventDefault()
      if (at < options.length) pick(options[at])
    } else if (e.key === 'Escape') {
      setOpen(false)
      button.current?.focus()
    }
  }

  const color = chosen ? tagColor(chosen.color) : null
  return (
    <div className="cond" ref={wrap} onKeyDown={keys} onBlur={(e) => e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        ref={button}
        type="button"
        className="cond-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={chosen ? chosen.name : undefined}
        aria-label={chosen ? `Condition: ${chosen.name}. Change` : 'Condition: all. Choose one'}
        onClick={toggle}
        style={color ? { borderColor: color.fg, background: color.bg, color: color.fg } : undefined}
      >
        {chosen && color && <span className="dot" style={{ background: color.fg }} />}
        <span className="name">{chosen ? chosen.name : 'All conditions'}</span>
        {chosen && <span className="n">{counts[chosen.id] ?? 0}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {chosen && (
        <button
          type="button"
          className="icon-btn"
          aria-label={`Show all conditions, not only ${chosen.name}`}
          title="Show all conditions"
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
      {open && (
        <div className="cond-pop">
          <input
            type="text"
            role="combobox"
            aria-label="Find a condition"
            aria-expanded="true"
            aria-controls={id}
            aria-activedescendant={at < options.length ? `${id}-${at}` : undefined}
            aria-autocomplete="list"
            placeholder="Find a condition"
            autoComplete="off"
            spellCheck={false}
            autoFocus={!touch}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setAt(0)
            }}
          />
          <ul id={id} role="listbox" aria-label="Conditions">
            {options.map((c, i) => (
              // Keeping the pointer from taking focus leaves the list open until the click lands.
              <li key={c ? c.id : 'all'} id={`${id}-${i}`} role="option" aria-selected={(c ? c.id : null) === value} className={i === at ? 'at' : undefined} onPointerDown={(e) => e.preventDefault()} onPointerMove={() => setAt(i)} onClick={() => pick(c)}>
                <span className="dot" style={{ background: c ? tagColor(c.color).fg : 'transparent' }} />
                <span className="name">{c ? c.name : 'All conditions'}</span>
                {c && <span className="n">{counts[c.id] ?? 0}</span>}
              </li>
            ))}
          </ul>
          {options.length === 0 && <div className="cond-none muted">No condition tag matches.</div>}
        </div>
      )}
    </div>
  )
}
