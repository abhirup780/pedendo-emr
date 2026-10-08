import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bestMatch, categoryOrder } from '../lib/investigations'
import type { Investigation, Panel } from '../lib/types'

interface Props {
  catalog: Investigation[]
  panels: Panel[]
  value: string[]
  onChange: (next: string[]) => void
  /** Saves the current selection as a panel; resolves to a short confirmation. */
  onSavePanel: (name: string) => Promise<string>
}

export default function InvestigationPicker({ catalog, panels, value, onChange, onSavePanel }: Props) {
  const [q, setQ] = useState('')
  // On a phone the full list is several screens long, so it starts folded away there.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 700px)').matches)
  const [panelName, setPanelName] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const has = (n: string) => value.includes(n)
  const toggle = (n: string) => onChange(has(n) ? value.filter((x) => x !== n) : [...value, n])

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase()
    const shown = catalog.filter((i) => !t || i.name.toLowerCase().includes(t))
    return categoryOrder(shown.map((i) => i.category)).map((c) => ({ category: c, items: shown.filter((i) => i.category === c) }))
  }, [catalog, q])
  const matches = groups.reduce((n, g) => n + g.items.length, 0)

  // What Enter will add: the best match from the list, or the typed text when nothing matches.
  const enterAdds = bestMatch(catalog.map((i) => i.name), q) ?? q.trim()

  function addTyped() {
    if (!enterAdds) return
    if (!has(enterAdds)) onChange([...value, enterAdds])
    setQ('')
  }

  async function savePanel() {
    if (!panelName?.trim()) return
    try {
      setMsg(await onSavePanel(panelName.trim()))
      setPanelName(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save the panel.')
    }
  }

  return (
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row">
        <h2 className="grow">Investigations</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          {value.length === 0 ? 'None advised' : `${value.length} advised · printed on the prescription`}
        </span>
      </div>

      {panels.length > 0 && (
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>One-tap panels</div>
          <div className="suggest">
            {panels.map((p) => (
              <button type="button" key={p.id} className="panel-btn" onClick={() => onChange([...value, ...p.items.filter((n) => !has(n))])}>
                + {p.name} <span className="muted">({p.items.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="picker-box">
          {value.map((n) => (
            <span className="picked" key={n}>
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => toggle(n)}>×</button>
            </span>
          ))}
          <input
            type="search"
            aria-label="Search or add an investigation"
            placeholder={value.length ? 'Search or add another…' : 'Search IGF-1, TSH, bone age… or type a new one and press Enter'}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTyped()
              }
            }}
          />
          <button type="button" className="icon-btn" aria-expanded={open} aria-label={open ? 'Hide the list' : 'Show the list'} onClick={() => setOpen(!open)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        {open && (
          <div className="picker-list">
            {groups.map((g) => (
              <div key={g.category}>
                <div className="cat">{g.category}</div>
                {g.items.map((i) => (
                  <button type="button" key={i.id} className="opt" aria-pressed={has(i.name)} onClick={() => toggle(i.name)}>
                    <span className="box" aria-hidden="true">{has(i.name) ? '✓' : ''}</span>
                    {i.name}
                  </button>
                ))}
              </div>
            ))}
            {catalog.length === 0 && <div className="muted">Your investigation list is empty. Build it under <Link to="/settings">Settings</Link>, or type a name above and press Enter.</div>}
            {catalog.length > 0 && matches === 0 && <div className="muted">Nothing in your list matches.</div>}
          </div>
        )}
        {q.trim() && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Enter adds "{enterAdds}"{matches === 0 ? ' as a new investigation for this visit' : ''}.</div>}
      </div>

      {msg && <div className="pill ok" role="status">{msg}</div>}
      {panelName === null ? (
        value.length > 1 && (
          <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => { setPanelName(''); setMsg('') }}>
            Save this selection as a panel
          </button>
        )
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <input aria-label="Panel name" placeholder="Panel name" value={panelName} onChange={(e) => setPanelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void savePanel() } }} style={{ flex: '1 1 180px', minHeight: 40, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }} />
          <button type="button" className="btn small primary" disabled={!panelName.trim()} onClick={savePanel}>Save panel</button>
          <button type="button" className="btn small" onClick={() => setPanelName(null)}>Cancel</button>
        </div>
      )}
    </section>
  )
}
