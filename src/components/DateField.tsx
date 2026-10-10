import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseISODate, todayISO } from '../lib/age'
import { autoSlash, monthCells, MONTH_NAMES, parseTyped, shiftDays, showDate } from '../lib/dateinput'
import { usePresence } from './hooks'

interface Props {
  /** Stored date, YYYY-MM-DD, or '' for none. */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  id?: string
  /** The form's own check failed (an empty required date, for one). */
  invalid?: boolean
  'aria-label'?: string
  style?: React.CSSProperties
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/**
 * A date box that reads day first (dd/mm/yyyy) on every device, with a calendar of its own.
 * The browser's built-in date box is not used: its calendar does not open everywhere (inside
 * an embedded preview, for one) and it shows month first on devices set to US English.
 */
export default function DateField({ value, onChange, min, max, id, invalid, style, ...rest }: Props) {
  const [text, setText] = useState(showDate(value))
  const [open, setOpen] = useState(false)
  // The calendar stays a moment after it is closed, to fade away.
  const pop = usePresence(open)
  // Where the calendar goes on the screen, worked out from the box when it opens.
  const [place, setPlace] = useState<React.CSSProperties>({})
  const cal = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const typing = useRef(false)
  const calId = useId()

  // The box follows the stored value unless the doctor is in the middle of typing in it.
  useEffect(() => {
    if (!typing.current) setText(showDate(value))
  }, [value])

  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max)
  const typed = parseTyped(text)
  const bad = text.trim() !== '' && (!typed || !allowed(typed))

  function type(next: string) {
    typing.current = true
    const shown = autoSlash(next, text)
    setText(shown)
    if (shown.trim() === '') return onChange('')
    const v = parseTyped(shown)
    if (v && allowed(v)) onChange(v)
  }
  function pick(v: string) {
    typing.current = false
    onChange(v)
    setText(showDate(v))
    setOpen(false)
    input.current?.focus()
  }
  function toggle() {
    if (!open && wrap.current) {
      const r = wrap.current.getBoundingClientRect()
      // Under the box; above it when there is not room below (the save bar takes the last
      // 80 px); and pulled in from the right when it would run off the side of the screen.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 316))
      setPlace(window.innerHeight - r.bottom < 400 && r.top > 380 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
    }
    setOpen(!open)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      const t = e.target as Node
      if (wrap.current?.contains(t) || cal.current?.contains(t)) return
      setOpen(false)
    }
    // It is placed once, so it closes when the page behind it scrolls or the window changes.
    document.addEventListener('pointerdown', away)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', away)
    }
  }, [open])

  return (
    <span className="datefield" ref={wrap} style={style}>
      <input
        ref={input}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        aria-label={rest['aria-label']}
        aria-invalid={bad || invalid || undefined}
        value={text}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          // Leaving the box tidies what was typed, or puts the last good date back.
          typing.current = false
          setText(showDate(value))
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      <button type="button" className="cal-btn" aria-label="Choose from a calendar" aria-expanded={open} aria-controls={open ? calId : undefined} onClick={toggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </button>
      {/* Drawn at the top level of the page so nothing (a sticky column, the save bar) can cover or clip it. */}
      {pop.there && createPortal(<Calendar id={calId} boxRef={cal} place={place} leaving={pop.leaving} value={value} min={min} max={max} onPick={pick} onClose={() => { setOpen(false); input.current?.focus() }} />, document.body)}
    </span>
  )
}

function Calendar({ id, boxRef, place, leaving, value, min, max, onPick, onClose }: { id: string; boxRef: React.RefObject<HTMLDivElement | null>; place: React.CSSProperties; /** Closed, and fading away. */ leaving: boolean; value: string; min?: string; max?: string; onPick: (v: string) => void; onClose: () => void }) {
  const today = todayISO()
  const clamp = (v: string) => (min && v < min ? min : max && v > max ? max : v)
  // The day the keyboard is on. It starts on the chosen date, or today, kept inside the limits.
  const [cursor, setCursor] = useState(() => clamp(parseISODate(value) ? value : today))
  const grid = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const year = Number(cursor.slice(0, 4))
  const month = Number(cursor.slice(5, 7))
  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max)
  const firstYear = min ? Number(min.slice(0, 4)) : Number(today.slice(0, 4)) - 25
  const lastYear = max ? Number(max.slice(0, 4)) : Number(today.slice(0, 4)) + 10
  const years = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, i) => firstYear + i)

  const go = (v: string) => {
    moved.current = true
    setCursor(clamp(v))
  }
  // Month and year jumps keep the day of the month where they can (31 Jan to 28 Feb).
  const jump = (y: number, m: number) => {
    const last = new Date(y, m, 0).getDate()
    go(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(Number(cursor.slice(8, 10)), last)).padStart(2, '0')}`)
  }
  const step = (months: number) => {
    const d = new Date(year, month - 1 + months, 1)
    jump(d.getFullYear(), d.getMonth() + 1)
  }

  useEffect(() => {
    // After an arrow key the highlighted day takes the keyboard focus with it.
    if (moved.current) grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
  }, [cursor])
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
  }, [])

  const canPrev = !min || `${year}-${String(month).padStart(2, '0')}-01` > min
  const canNext = !max || shiftDays(`${year}-${String(month).padStart(2, '0')}-01`, new Date(year, month, 0).getDate()) <= max

  return (
    <div
      className={leaving ? 'cal leaving' : 'cal'}
      ref={boxRef}
      style={place}
      id={id}
      role="dialog"
      aria-label="Choose a date"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div className="cal-head">
        <button type="button" className="icon-btn" aria-label="Previous month" disabled={!canPrev} onClick={() => step(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <select aria-label="Month" value={month} onChange={(e) => jump(year, Number(e.target.value))}>
          {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <select aria-label="Year" value={year} onChange={(e) => jump(Number(e.target.value), month)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={!canNext} onClick={() => step(1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      <div className="cal-week" aria-hidden="true">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
      <div
        className="cal-grid"
        ref={grid}
        onKeyDown={(e) => {
          const by: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
          if (e.key in by) {
            e.preventDefault()
            go(shiftDays(cursor, by[e.key]))
          } else if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault()
            step(e.key === 'PageUp' ? -1 : 1)
          }
        }}
      >
        {monthCells(year, month).map((c) => (
          <button
            type="button"
            key={c.iso}
            className={[c.inMonth ? '' : 'out', c.iso === today ? 'today' : ''].join(' ').trim() || undefined}
            aria-pressed={c.iso === value}
            aria-label={`${c.day} ${MONTH_NAMES[Number(c.iso.slice(5, 7)) - 1]} ${c.iso.slice(0, 4)}`}
            tabIndex={c.iso === cursor ? 0 : -1}
            disabled={!allowed(c.iso)}
            onClick={() => onPick(c.iso)}
          >
            {c.day}
          </button>
        ))}
      </div>
      <div className="cal-foot">
        <button type="button" className="btn small" disabled={!allowed(today)} onClick={() => onPick(today)}>Today</button>
        <button type="button" className="btn small" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
