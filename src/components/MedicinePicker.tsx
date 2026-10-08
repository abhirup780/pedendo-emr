import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EMPTY_RX, rxLine } from '../lib/clinical'
import { rankedMatches } from '../lib/investigations'
import { cite } from '../lib/protocols'
import type { Protocol, ProtocolMedicine } from '../lib/protocols'
import type { Medicine, RxItem, RxTemplate } from '../lib/types'
import BrowseWindow, { ProtocolNote } from './BrowseWindow'
import { Tick } from './InvestigationPicker'

interface Props {
  catalog: Medicine[]
  /** What is on this prescription now. */
  meds: RxItem[]
  /** The previous visit's prescription, offered as a group of its own. */
  last: { label: string; medicines: RxItem[] } | null
  templates: RxTemplate[]
  onAdd: (item: RxItem) => void
  onRemove: (name: string) => void
  onTemplate: (id: string) => void
  /** Guideline protocols for this patient's condition tags; their medicines are offered first. */
  protocols?: Protocol[]
}

const OTHER = 'Other'

/**
 * Adding medicines to a prescription. On the visit screen: a box that suggests from the
 * doctor's list as you type. The whole list is browsed in a window of its own, grouped by
 * route (the list has no categories of its own).
 */
export default function MedicinePicker(props: Props) {
  const { catalog, meds, onAdd, protocols = [] } = props
  const [q, setQ] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const on = (name: string) => meds.some((m) => m.name === name)
  // The doctor's own list first; a protocol medicine of the same name does not appear twice.
  const fromProtocols = useMemo(() => protocols.flatMap((p) => p.medicines.map((m) => ({ ...m.rx, from: p.name }))).filter((m, i, all) => all.findIndex((x) => x.name === m.name) === i), [protocols])
  const names = useMemo(() => [...new Set([...catalog.map((m) => m.name), ...fromProtocols.map((m) => m.name)])], [catalog, fromProtocols])
  const byName = (name: string): RxItem => catalog.find((m) => m.name === name) ?? fromProtocols.find((m) => m.name === name)!
  const protocolOf = (name: string) => (catalog.some((m) => m.name === name) ? '' : (fromProtocols.find((m) => m.name === name)?.from ?? ''))
  const suggestions = useMemo(() => rankedMatches(names, q).slice(0, 7), [names, q])

  // Enter adds the best match from the list, or the typed name as a medicine not on the list.
  function add(item: RxItem) {
    onAdd(item)
    setQ('')
  }
  const typed = (): RxItem => (suggestions.length > 0 ? byName(suggestions[0]) : { ...EMPTY_RX, name: q.trim() })

  return (
    <div className="field">
      <label htmlFor="med-add">Add a medicine</label>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input
          id="med-add"
          type="search"
          placeholder="Type to add from your list, or a new name"
          value={q}
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (q.trim()) add(typed())
            }
            if (e.key === 'Escape') setQ('')
          }}
        />
        <button type="button" className="btn outline" style={{ flex: '0 0 auto' }} onClick={() => setBrowsing(true)}>
          Browse all{catalog.length > 0 && ` (${catalog.length})`}
        </button>
      </div>
      {q.trim() && (
        <div className="quick" role="group" aria-label="Matching medicines">
          {suggestions.map((n, i) => (
            <button type="button" key={n} className="opt" onClick={() => add(byName(n))}>
              <span className="grow">
                {n}
                {protocolOf(n) && <span className="muted"> · {protocolOf(n)} protocol</span>}
                {on(n) && <span className="muted"> · already on this prescription</span>}
              </span>
              {i === 0 && <span className="key">Enter</span>}
            </button>
          ))}
          {suggestions.length === 0 && (
            <button type="button" className="opt" onClick={() => add({ ...EMPTY_RX, name: q.trim() })}>
              <span className="grow">Add "{q.trim()}" (not on your list)</span>
              <span className="key">Enter</span>
            </button>
          )}
        </div>
      )}
      {catalog.length === 0 && !q.trim() && <span className="hint">Your medicine list is empty. Build it under <Link to="/settings?tab=meds">Settings</Link>, or type a name and press Enter.</span>}
      {browsing && <BrowseMedicines {...props} onClose={() => setBrowsing(false)} />}
    </div>
  )
}

function BrowseMedicines({ catalog, meds, last, templates, onAdd, onRemove, onTemplate, onClose, protocols = [] }: Props & { onClose: () => void }) {
  const [q, setQ] = useState('')
  const PKEY = (k: string) => `\u0000p:${k}`
  // A patient with a protocol starts on it.
  const [group, setGroup] = useState<string | null>(protocols.length > 0 ? PKEY(protocols[0].key) : null)
  const active = protocols.find((p) => PKEY(p.key) === group)
  const on = (name: string) => meds.some((m) => m.name === name)
  const routeOf = (m: RxItem) => m.route.trim() || OTHER
  // Routes with the most medicines first; "Other" (no route set) last.
  const routes = useMemo(() => {
    const n = new Map<string, number>()
    for (const m of catalog) n.set(routeOf(m), (n.get(routeOf(m)) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : b[1] - a[1] || a[0].localeCompare(b[0]))).map(([route]) => route)
  }, [catalog])
  const LAST = '\u0000last'
  const t = q.trim().toLowerCase()
  const sorted = useMemo(() => [...catalog].sort((a, b) => a.name.localeCompare(b.name)), [catalog])
  const shown = sorted.filter((m) => (t ? m.name.toLowerCase().includes(t) : group == null || routeOf(m) === group))
  const sections = (group === LAST || active) && !t ? [] : routes.map((r) => ({ route: r, items: shown.filter((m) => routeOf(m) === r) })).filter((s) => s.items.length > 0)
  const exact = catalog.some((m) => m.name.toLowerCase() === t)

  const row = (m: RxItem, key: string) => (
    <button type="button" key={key} className="opt med-opt" aria-pressed={on(m.name)} title={on(m.name) ? 'Already on this prescription. Remove it from the list at the foot of this window.' : undefined} onClick={() => { if (!on(m.name)) onAdd(m) }}>
      <Tick on={on(m.name)} />
      <span className="grow">
        <span className="t">{m.name}</span>
        <span className="d">{rxLine(m) || 'No default directions'}</span>
      </span>
    </button>
  )

  // A protocol medicine: what it is for, the guideline's dose wording and where it is from.
  const protoRow = (p: Protocol, m: ProtocolMedicine) => (
    <button type="button" key={`${p.key}-${m.generic}`} className="opt med-opt proto-med" aria-pressed={on(m.rx.name)} title={on(m.rx.name) ? 'Already on this prescription. Remove it from the list at the foot of this window.' : undefined} onClick={() => { if (!on(m.rx.name)) onAdd(m.rx) }}>
      <Tick on={on(m.rx.name)} />
      <span className="grow">
        <span className="t">{m.rx.name}{m.strengths.length > 0 && <span className="muted" style={{ fontWeight: 400 }}> · {m.strengths.join(', ')}</span>}</span>
        <span className="d">{m.indication}</span>
        {m.verified && m.doseGuide ? (
          <span className="g"><strong>Dose guide:</strong> {m.doseGuide}{m.max && ` ${m.max}`} <span className="src">({cite(p, m.doseSources)})</span></span>
        ) : (
          <span className="g none">No dose is held for this medicine: none could be read from a guideline. Enter your own.</span>
        )}
        {m.prescriberNote && <span className="g"><strong>Note:</strong> {m.prescriberNote}</span>}
      </span>
    </button>
  )

  return (
    <BrowseWindow
      title="Medicines"
      hint="Pick what to prescribe. Each is added with your usual directions, which you can change on the prescription."
      searchLabel="Search all medicines"
      q={q}
      onSearch={setQ}
      groups={[
        ...protocols.map((p) => ({ key: PKEY(p.key), label: `For ${p.name}`, count: p.medicines.length, chosen: p.medicines.filter((m) => on(m.rx.name)).length })),
        { key: null, label: 'All', count: catalog.length },
        ...(last && last.medicines.length > 0 ? [{ key: LAST, label: `Last prescription (${last.label})`, count: last.medicines.length, chosen: last.medicines.filter((m) => on(m.name)).length }] : []),
        ...routes.map((r) => ({ key: r, label: r, count: catalog.filter((m) => routeOf(m) === r).length, chosen: catalog.filter((m) => routeOf(m) === r && on(m.name)).length })),
      ]}
      group={group}
      onGroup={setGroup}
      listLabel="Medicine list"
      onClose={onClose}
      chosen={
        meds.length === 0 ? (
          <span className="muted">Nothing on this prescription yet</span>
        ) : (
          <>
            <span className="muted">On this prescription:</span>
            {[...new Set(meds.map((m) => m.name))].map((n) => (
              <span className="picked" key={n}>
                {n}
                <button type="button" aria-label={`Remove ${n}`} onClick={() => onRemove(n)}>×</button>
              </span>
            ))}
          </>
        )
      }
    >
      {active && !t && (
        <>
          <div className="inv-group">
            <div className="cat">Medicines in the {active.name} protocol</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Each is added with the dose left blank for you to fill in. The guideline's dose range is shown here and beside the dose box.</div>
            <div className="proto-meds">{active.medicines.map((m) => protoRow(active, m))}</div>
          </div>
          <ProtocolNote protocol={active} />
        </>
      )}
      {t && protocols.flatMap((p) => p.medicines.filter((m) => m.rx.name.toLowerCase().includes(t) && !catalog.some((c) => c.name === m.rx.name)).map((m) => ({ p, m }))).length > 0 && (
        <div className="inv-group">
          <div className="cat">From this patient's protocols</div>
          <div className="proto-meds">{protocols.flatMap((p) => p.medicines.filter((m) => m.rx.name.toLowerCase().includes(t) && !catalog.some((c) => c.name === m.rx.name)).map((m) => protoRow(p, m)))}</div>
        </div>
      )}
      {templates.length > 0 && !t && group == null && (
        <div className="inv-group">
          <div className="cat">Templates</div>
          <div className="suggest">
            {templates.map((tp) => (
              <button type="button" key={tp.id} className="panel-btn" onClick={() => onTemplate(tp.id)}>
                + {tp.name} <span className="muted">({tp.medicines.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {group === LAST && !t && last && (
        <div className="inv-group">
          <div className="cat">Prescribed on {last.label}, with the doses given then</div>
          <div className="inv-grid meds">{last.medicines.map((m, i) => row(m, `last-${i}`))}</div>
        </div>
      )}
      {sections.map((s) => (
        <div className="inv-group" key={s.route}>
          <div className="cat">{s.route}</div>
          <div className="inv-grid meds">{s.items.map((m) => row(m, m.id))}</div>
        </div>
      ))}
      {t && !exact && (
        <button type="button" className="opt add" onClick={() => { onAdd({ ...EMPTY_RX, name: q.trim() }); setQ('') }}>
          + Add "{q.trim()}" (not on your list)
        </button>
      )}
      {catalog.length === 0 && <div className="muted">Your medicine list is empty. Build it under <Link to="/settings?tab=meds">Settings</Link>, or type a name above to add it to this prescription.</div>}
      {catalog.length > 0 && sections.length === 0 && t && <div className="muted">Nothing in your list matches "{q.trim()}".</div>}
    </BrowseWindow>
  )
}
