import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatAge } from '../lib/age'
import { sexLabel } from '../lib/sex'
import { store } from '../lib/store'
import type { Patient } from '../lib/types'
import { useFindKey } from './hooks'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Patient search in the header, so a record can be opened from any screen. Ctrl+K (or "/"
 * outside a text box) goes to it; up and down arrows move through the matches, Enter opens
 * one, Escape closes. On a phone it is a button that opens the box under the header. The
 * patient list leaves it out: that screen has a search box of its own.
 */
export default function QuickFind() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  // The matches, with the words they answer: an answer to an earlier search is never shown.
  const [found, setFound] = useState<{ q: string; rows: Patient[] } | null>(null)
  const [at, setAt] = useState(0)
  // On a phone the box is out of sight until asked for.
  const [open, setOpen] = useState(false)
  const [listed, setListed] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()

  // The search runs on the server, a moment after typing stops.
  const words = q.trim()
  useEffect(() => {
    if (!words) return
    let live = true
    const t = setTimeout(() => {
      store.listPatients({ q: words, limit: 8 }).then(
        (r) => {
          if (!live) return
          setFound({ q: words, rows: r.rows })
          setAt(0)
        },
        () => live && setFound({ q: words, rows: [] }),
      )
    }, 250)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [words])

  useFindKey(() => {
    setOpen(true)
    input.current?.focus()
  })
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open && !listed) return
    const away = (e: PointerEvent) => {
      if (wrap.current?.contains(e.target as Node)) return
      setOpen(false)
      setListed(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open, listed])

  const rows = found && found.q === words ? found.rows : null
  function close() {
    setQ('')
    setFound(null)
    setListed(false)
    setOpen(false)
  }
  function pick(p: Patient) {
    close()
    input.current?.blur()
    nav(`/patients/${p.id}`)
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close()
      input.current?.blur()
    } else if (rows && rows.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setAt(e.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0))
    } else if (e.key === 'Enter' && rows && rows[at]) {
      e.preventDefault()
      pick(rows[at])
    }
  }

  const showing = listed && words !== '' && rows !== null
  return (
    <div className={open ? 'find open' : 'find'} ref={wrap} role="search">
      <button type="button" className="find-open" aria-label="Find a patient" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
      <div className="find-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#55656C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Find a patient"
          aria-expanded={showing}
          aria-controls={id}
          aria-activedescendant={showing && rows[at] ? `${id}-${at}` : undefined}
          aria-autocomplete="list"
          placeholder="Find patient"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setListed(true)
          }}
          onFocus={() => setListed(true)}
          onKeyDown={keys}
        />
        <kbd className="wide-only" aria-hidden="true">{MAC ? '⌘K' : 'Ctrl K'}</kbd>
        {showing && (
          <div className="find-pop">
            <ul id={id} role="listbox" aria-label="Matching patients">
              {rows.map((p, i) => (
                // Keeping the pointer from taking focus leaves the list open until the click lands.
                <li key={p.id} id={`${id}-${i}`} role="option" aria-selected={i === at} className={i === at ? 'at' : undefined} onPointerDown={(e) => e.preventDefault()} onPointerMove={() => setAt(i)} onClick={() => pick(p)}>
                  <span className="t">{p.name}</span>
                  <span className="d">
                    <span className="mono">MRN {p.mrn}</span> · {formatAge(p.dob)} · {sexLabel(p.sex)}
                  </span>
                </li>
              ))}
            </ul>
            {rows.length === 0 && <div className="cond-none muted" role="status">No patient matches.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
