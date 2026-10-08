import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag, TagChip } from '../components/Tag'
import { formatAge, formatDate } from '../lib/age'
import { store } from '../lib/store'
import { tagColor } from '../lib/tags'
import type { Condition, Patient } from '../lib/types'

function Row({ p, byId }: { p: Patient; byId: Map<string, Condition> }) {
  return (
    <div className="tr">
      <div className="mono muted">{p.mrn}</div>
      <div>
        <Link className="name" to={`/patients/${p.id}`}>
          {p.name}
        </Link>
        {p.guardian_name && <div className="muted" style={{ fontSize: 12.5 }}>{p.guardian_name}</div>}
      </div>
      <div>
        {formatAge(p.dob)} · {p.sex}
      </div>
      <div className="tags">
        {p.condition_ids.map((id) => {
          const c = byId.get(id)
          return c ? <Tag key={id} condition={c} /> : null
        })}
        {p.condition_ids.length === 0 && <span className="muted">—</span>}
      </div>
      <div className="mono">{p.phone || '—'}</div>
      <div className="muted">{formatDate(p.created_at)}</div>
    </div>
  )
}

export default function Patients() {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [rows, setRows] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [grouped, setGrouped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([store.listConditions(), store.conditionCounts()]).then(
      ([c, n]) => {
        setConditions(c)
        setCounts(n)
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      store.listPatients({ q, conditionId: tag }).then(
        (r) => {
          if (!live) return
          setRows(r.rows)
          setTotal(r.total)
          setLoading(false)
          setError('')
        },
        (e: Error) => {
          if (!live) return
          setError(e.message)
          setLoading(false)
        },
      )
    }, q ? 250 : 0)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, tag])

  const byId = useMemo(() => new Map(conditions.map((c) => [c.id, c])), [conditions])
  const groups = useMemo(() => {
    if (!grouped) return null
    const shown = tag ? conditions.filter((c) => c.id === tag) : conditions
    const out = shown
      .map((c) => ({ key: c.id, label: c.name, dot: tagColor(c.color).fg, rows: rows.filter((p) => p.condition_ids.includes(c.id)) }))
      .filter((g) => g.rows.length > 0)
    const untagged = rows.filter((p) => p.condition_ids.length === 0)
    if (!tag && untagged.length) out.push({ key: 'none', label: 'No condition tag', dot: '#8a979c', rows: untagged })
    return out
  }, [grouped, tag, conditions, rows])

  const filtering = q.trim() !== '' || tag !== null
  let foot = ''
  if (!loading && rows.length > 0) {
    foot = rows.length < total ? `Showing the ${rows.length} most recent of ${total}. Search to narrow down.` : `${total} ${total === 1 ? 'patient' : 'patients'}`
    if (grouped) foot += ' · A patient with two tags appears under both.'
  }

  return (
    <main className="page">
      <div className="row">
        <div className="grow">
          <h1>Patients</h1>
        </div>
        <label className="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#55656C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="search" aria-label="Search patients" placeholder="Search name, phone or MRN" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Link to="/patients/new" className="btn primary">
          + New patient
        </Link>
      </div>

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <div className="card-head">
          <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            Condition
          </div>
          <div className="tags grow">
            <button
              type="button"
              className="chip"
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
              style={{ borderColor: tag === null ? '#14242b' : '#c9d2cf', background: tag === null ? '#14242b' : '#fff', color: tag === null ? '#fff' : '#14242b' }}
            >
              All
            </button>
            {conditions.map((c) => (
              <TagChip key={c.id} label={c.name} color={c.color} count={counts[c.id] ?? 0} pressed={tag === c.id} onClick={() => setTag(tag === c.id ? null : c.id)} />
            ))}
            {conditions.length === 0 && !loading && (
              <Link to="/settings" style={{ alignSelf: 'center' }}>
                Set up condition tags
              </Link>
            )}
          </div>
          <button type="button" className="switch" aria-pressed={grouped} onClick={() => setGrouped(!grouped)}>
            <span className="track" />
            Group by condition
          </button>
        </div>

        <div className="table-wrap">
          <div className="table">
            <div className="tr head">
              <div>MRN</div>
              <div>Patient</div>
              <div>Age · sex</div>
              <div>Conditions</div>
              <div>Phone</div>
              <div>Registered</div>
            </div>
            {groups
              ? groups.map((g) => (
                  <div key={g.key}>
                    <div className="group-head">
                      <span className="dot" style={{ background: g.dot }} />
                      {g.label}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        {g.rows.length}
                      </span>
                    </div>
                    {g.rows.map((p) => (
                      <Row key={p.id} p={p} byId={byId} />
                    ))}
                  </div>
                ))
              : rows.map((p) => <Row key={p.id} p={p} byId={byId} />)}
          </div>
        </div>

        {loading && <div className="empty">Loading patients…</div>}
        {!loading && rows.length === 0 && !error && (
          <div className="empty">
            {filtering ? 'No patient matches this search.' : 'No patients yet. Add the first one with "New patient".'}
          </div>
        )}
        {foot && <div className="foot">{foot}</div>}
      </section>
    </main>
  )
}
