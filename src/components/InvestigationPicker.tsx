import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bestMatch, categoryOrder, rankedMatches } from '../lib/investigations'
import BrowseWindow from './BrowseWindow'
import type { Investigation, Panel } from '../lib/types'

interface Props {
  catalog: Investigation[]
  panels: Panel[]
  value: string[]
  onChange: (next: string[]) => void
  /** Saves the current selection as a panel; resolves to a short confirmation. */
  onSavePanel: (name: string) => Promise<string>
}

export const Tick = ({ on }: { on: boolean }) => <span className="box" aria-hidden="true">{on ? '✓' : ''}</span>

/**
 * Investigations advised at a visit. On the visit screen this stays small: one-tap panels, the
 * chosen tests, and a search box that suggests as you type. The whole list, however long it
 * grows, is browsed in a window of its own ("Browse all").
 */
export default function InvestigationPicker({ catalog, panels, value, onChange, onSavePanel }: Props) {
  const [q, setQ] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [panelName, setPanelName] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const has = (n: string) => value.includes(n)
  const toggle = (n: string) => onChange(has(n) ? value.filter((x) => x !== n) : [...value, n])
  const names = useMemo(() => catalog.map((i) => i.name), [catalog])

  // What Enter will add: the best match from the list, or the typed text when nothing matches.
  const enterAdds = bestMatch(names, q) ?? q.trim()
  const suggestions = useMemo(() => rankedMatches(names, q).slice(0, 7), [names, q])

  function add(name: string) {
    if (!name) return
    if (!has(name)) onChange([...value, name])
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
            placeholder={value.length ? 'Type to add another…' : 'Type to add: IGF-1, TSH, bone age…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(enterAdds)
              }
              if (e.key === 'Escape') setQ('')
            }}
          />
        </div>
        {q.trim() && (
          <div className="quick" role="group" aria-label="Matching investigations">
            {suggestions.map((n, i) => (
              <button type="button" key={n} className="opt" aria-pressed={has(n)} onClick={() => (has(n) ? toggle(n) : add(n))}>
                <Tick on={has(n)} />
                <span className="grow">{n}</span>
                {i === 0 && <span className="key">Enter</span>}
              </button>
            ))}
            {suggestions.length === 0 && (
              <button type="button" className="opt" onClick={() => add(q.trim())}>
                <span className="grow">Add "{q.trim()}" as a new investigation for this visit</span>
                <span className="key">Enter</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn small outline" onClick={() => setBrowsing(true)}>
          Browse all{catalog.length > 0 && ` (${catalog.length})`}
        </button>
        {panelName === null && value.length > 1 && (
          <button type="button" className="btn small" onClick={() => { setPanelName(''); setMsg('') }}>
            Save this selection as a panel
          </button>
        )}
      </div>

      {msg && <div className="pill ok" role="status">{msg}</div>}
      {panelName !== null && (
        <div className="row" style={{ gap: 8 }}>
          <input aria-label="Panel name" placeholder="Panel name" value={panelName} onChange={(e) => setPanelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void savePanel() } }} style={{ flex: '1 1 180px', minHeight: 40, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }} />
          <button type="button" className="btn small primary" disabled={!panelName.trim()} onClick={savePanel}>Save panel</button>
          <button type="button" className="btn small" onClick={() => setPanelName(null)}>Cancel</button>
        </div>
      )}

      {browsing && <BrowseDialog catalog={catalog} panels={panels} value={value} onChange={onChange} onClose={() => setBrowsing(false)} />}
    </section>
  )
}

/** The whole investigation list in its own window: groups down the side, search across all. */
function BrowseDialog({ catalog, panels, value, onChange, onClose }: Omit<Props, 'onSavePanel'> & { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  const has = (n: string) => value.includes(n)
  const toggle = (n: string) => onChange(has(n) ? value.filter((x) => x !== n) : [...value, n])
  const categories = useMemo(() => categoryOrder(catalog.map((i) => i.category)), [catalog])
  const t = q.trim().toLowerCase()
  // Searching looks through every group; otherwise the chosen group (or all of them) is shown.
  const shown = catalog.filter((i) => (t ? i.name.toLowerCase().includes(t) : group == null || i.category === group))
  const groups = categories.map((c) => ({ category: c, items: shown.filter((i) => i.category === c) })).filter((g) => g.items.length > 0)
  const exact = catalog.some((i) => i.name.toLowerCase() === t)
  const extra = value.filter((n) => !catalog.some((i) => i.name === n))

  return (
    <BrowseWindow
      title="Investigations"
      hint="Tick what to advise at this visit. Changes apply straight away."
      searchLabel="Search all investigations"
      q={q}
      onSearch={setQ}
      groups={[
        { key: null, label: 'All', count: catalog.length },
        ...categories.map((c) => ({ key: c, label: c, count: catalog.filter((i) => i.category === c).length, chosen: catalog.filter((i) => i.category === c && has(i.name)).length })),
      ]}
      group={group}
      onGroup={setGroup}
      listLabel="Investigation list"
      onClear={value.length > 0 ? () => onChange([]) : undefined}
      onClose={onClose}
      chosen={
        value.length === 0 ? (
          <span className="muted">Nothing advised yet</span>
        ) : (
          <>
            <span className="muted">{value.length} advised:</span>
            {value.map((n) => (
              <span className="picked" key={n}>
                {n}
                <button type="button" aria-label={`Remove ${n}`} onClick={() => toggle(n)}>×</button>
              </span>
            ))}
            {extra.length > 0 && <span className="muted" style={{ fontSize: 12.5 }}>({extra.length} not in your list)</span>}
          </>
        )
      }
    >
      {panels.length > 0 && !t && group == null && (
        <div className="inv-group">
          <div className="cat">Panels</div>
          <div className="suggest">
            {panels.map((p) => (
              <button type="button" key={p.id} className="panel-btn" onClick={() => onChange([...value, ...p.items.filter((n) => !has(n))])}>
                + {p.name} <span className="muted">({p.items.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map((g) => (
        <div className="inv-group" key={g.category}>
          <div className="cat">{g.category}</div>
          <div className="inv-grid">
            {g.items.map((i) => (
              <button type="button" key={i.id} className="opt" aria-pressed={has(i.name)} onClick={() => toggle(i.name)}>
                <Tick on={has(i.name)} />
                {i.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {t && !exact && (
        <button type="button" className="opt add" onClick={() => { if (!has(q.trim())) onChange([...value, q.trim()]); setQ('') }}>
          + Add "{q.trim()}" as a new investigation for this visit
        </button>
      )}
      {catalog.length === 0 && <div className="muted">Your investigation list is empty. Build it under <Link to="/settings?tab=tests">Settings</Link>, or type a name above to add it for this visit.</div>}
      {catalog.length > 0 && groups.length === 0 && t && <div className="muted">Nothing in your list matches "{q.trim()}".</div>}
    </BrowseWindow>
  )
}
