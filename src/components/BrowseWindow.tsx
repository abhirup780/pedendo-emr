import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface BrowseGroup {
  /** null is "All". */
  key: string | null
  label: string
  count: number
  /** How many in this group are already chosen; shown as a badge when above zero. */
  chosen?: number
}

/**
 * A long pick-list in a window of its own: search across everything at the top, groups down
 * the side (a strip across the top on a phone), the list in the middle, and what has been
 * chosen in the footer. Used for investigations and for medicines.
 *
 * It is a native <dialog>, so the browser keeps the keyboard inside it, Escape closes it and
 * focus goes back to the button that opened it. A click on the dimmed surround closes it too.
 */
export default function BrowseWindow(props: {
  title: string
  hint: string
  searchLabel: string
  q: string
  onSearch: (q: string) => void
  groups: BrowseGroup[]
  group: string | null
  onGroup: (key: string | null) => void
  listLabel: string
  children: ReactNode
  /** The chosen items, as chips. */
  chosen: ReactNode
  onClear?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const searching = props.q.trim() !== ''

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    // With a keyboard, start in the search box. On a touch screen that would bring up the
    // on-screen keyboard over the list, so the list is left in view instead.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) search.current?.focus()
    else d?.focus()
  }, [])

  return (
    <dialog ref={ref} className="inv-dialog" tabIndex={-1} aria-labelledby="browse-title" onClose={props.onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}>
      <div className="inv-head">
        <div className="grow">
          <h2 id="browse-title">{props.title}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{props.hint}</div>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="inv-search">
        <input
          type="search"
          ref={search}
          aria-label={props.searchLabel}
          placeholder={props.searchLabel}
          value={props.q}
          onChange={(e) => props.onSearch(e.target.value)}
          onKeyDown={(e) => {
            // Enter must not save the visit form behind this window.
            if (e.key === 'Enter') e.preventDefault()
          }}
        />
      </div>

      <div className="inv-body">
        <div className="inv-groups" role="group" aria-label="Groups">
          {props.groups.map((g) => (
            <button type="button" key={g.key ?? ''} aria-pressed={!searching && props.group === g.key} onClick={() => { props.onGroup(g.key); props.onSearch('') }}>
              <span className="grow">{g.label}</span>
              {!!g.chosen && <span className="n on">{g.chosen}</span>}
              <span className="n">{g.count}</span>
            </button>
          ))}
        </div>
        <div className="inv-list" tabIndex={0} role="region" aria-label={props.listLabel}>
          {props.children}
        </div>
      </div>

      <div className="inv-foot">
        <div className="inv-chosen" aria-live="polite">{props.chosen}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          {props.onClear && <button type="button" className="btn" onClick={props.onClear}>Clear all</button>}
          <button type="button" className="btn primary" onClick={() => ref.current?.close()}>Done</button>
        </div>
      </div>
    </dialog>
  )
}
