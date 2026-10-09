import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConditionFilter from '../components/ConditionFilter'
import SetupChecklist from '../components/SetupChecklist'
import { RowsSkeleton } from '../components/Skeleton'
import { Tag } from '../components/Tag'
import { formatAge, formatDate, todayISO } from '../lib/age'
import { daysBetween } from '../lib/clinical'
import { sexLabel } from '../lib/sex'
import { store } from '../lib/store'
import type { DueFilter, PatientSort } from '../lib/store'
import { tagColor } from '../lib/tags'
import type { Condition, Patient } from '../lib/types'
import { NONE } from '../lib/text'

/** Review date with how far away it is; overdue dates are marked. */
function Due({ on }: { on: string | null }) {
  if (!on) return <span className="muted">{NONE}</span>
  const days = daysBetween(todayISO(), on) ?? 0
  if (days < 0) return <span className="pill warn" title={formatDate(on)}>Overdue {-days} d</span>
  if (days <= 7) return <span className="pill ok" title={formatDate(on)}>{days === 0 ? 'Today' : `In ${days} d`}</span>
  return <span className="muted">{formatDate(on)}</span>
}

function Row({ p, byId }: { p: Patient; byId: Map<string, Condition> }) {
  return (
    <div className="tr" role="row">
      <div className="mono muted" role="cell">{p.mrn}</div>
      <div role="cell">
        <Link className="name" to={`/patients/${p.id}`}>
          {p.name}
        </Link>
        <div className="muted" style={{ fontSize: 12.5 }}>
          <span className="narrow-only mono">MRN {p.mrn}{p.guardian_name && ' · '}</span>
          {p.guardian_name}
        </div>
      </div>
      <div role="cell">
        {formatAge(p.dob)} · {p.sex === 'U' ? 'sex not assigned' : sexLabel(p.sex)}
      </div>
      <div className="tags" role="cell">
        {p.condition_ids.map((id) => {
          const c = byId.get(id)
          return c ? <Tag key={id} condition={c} /> : null
        })}
        {p.condition_ids.length === 0 && <span className="muted">{NONE}</span>}
      </div>
      <div className="muted" role="cell">{p.last_visit_on ? formatDate(p.last_visit_on) : 'No visit yet'}</div>
      <div role="cell"><Due on={p.next_review_on} /></div>
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
  const [due, setDue] = useState<DueFilter | null>(null)
  const [sort, setSort] = useState<PatientSort>('recent')
  const [limit, setLimit] = useState(200)
  const [follow, setFollow] = useState<{ overdue: number; week: number } | null>(null)
  const [everyone, setEveryone] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([store.listConditions(), store.conditionCounts(), store.followupCounts(todayISO()), store.listPatients({ limit: 1 })]).then(
      ([c, n, f, all]) => {
        setConditions(c)
        setCounts(n)
        setFollow(f)
        setEveryone(all.total)
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      store.listPatients({ q, conditionId: tag, due, sort, limit, today: todayISO() }).then(
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
  }, [q, tag, due, sort, limit])

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

  const filtering = q.trim() !== '' || tag !== null || due !== null
  let foot = ''
  if (!loading && rows.length > 0) {
    foot = rows.length < total ? `Showing ${rows.length} of ${total}.` : `${total} ${total === 1 ? 'patient' : 'patients'}`
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

      <div className="tiles">
        <button type="button" className="tile" aria-pressed={due === null} onClick={() => setDue(null)}>
          <span className="k">All<span className="wide-only"> patients</span></span>
          <span className="v">{everyone ?? '…'}</span>
        </button>
        <button type="button" className="tile" aria-pressed={due === 'week'} onClick={() => setDue(due === 'week' ? null : 'week')}>
          <span className="k"><span className="wide-only">Review due in the next 7 days</span><span className="narrow-only">Due in 7 days</span></span>
          <span className="v">{follow?.week ?? '…'}</span>
        </button>
        <button type="button" className="tile" aria-pressed={due === 'overdue'} onClick={() => setDue(due === 'overdue' ? null : 'overdue')}>
          <span className="k"><span className="wide-only">Review overdue, not seen since</span><span className="narrow-only">Overdue</span></span>
          <span className={follow && follow.overdue > 0 ? 'v warn' : 'v'}>{follow?.overdue ?? '…'}</span>
        </button>
      </div>

      <SetupChecklist patients={everyone} />

      <section className="card">
        <div className="card-head">
          <div className="muted cond-label" style={{ fontSize: 13, fontWeight: 500 }}>
            Condition
          </div>
          <div className="cond-slot">
            {conditions.length > 0 && <ConditionFilter conditions={conditions} counts={counts} value={tag} onChange={setTag} />}
            {conditions.length === 0 && !loading && <Link to="/settings?tab=tags">Set up condition tags</Link>}
          </div>
          <label className="sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as PatientSort)}>
              <option value="recent">Last seen</option>
              <option value="registered">Newest registered</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button type="button" className="switch" aria-pressed={grouped} onClick={() => setGrouped(!grouped)}>
            <span className="track" />
            Group by condition
          </button>
        </div>

        <div className="table-wrap" tabIndex={0} role="region" aria-label="Patient list">
          <div className="table" role="table" aria-label="Patients">
            <div className="tr head" role="row">
              <div role="columnheader">MRN</div>
              <div role="columnheader">Patient</div>
              <div role="columnheader">Age · sex</div>
              <div role="columnheader">Conditions</div>
              <div role="columnheader">Last visit</div>
              <div role="columnheader">Review due</div>
            </div>
            {groups
              ? groups.map((g) => (
                  <div key={g.key} role="rowgroup">
                    <div role="row">
                      <div className="group-head" role="cell" aria-colspan={6}>
                        <span className="dot" style={{ background: g.dot }} />
                        {g.label}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          {g.rows.length}
                        </span>
                      </div>
                    </div>
                    {g.rows.map((p) => (
                      <Row key={p.id} p={p} byId={byId} />
                    ))}
                  </div>
                ))
              : rows.map((p) => <Row key={p.id} p={p} byId={byId} />)}
          </div>
        </div>

        {loading && <RowsSkeleton rows={6} />}
        {!loading && rows.length === 0 && !error && (
          <div className="empty">
            {due === 'overdue' && !q && !tag ? 'No overdue reviews.' : due === 'week' && !q && !tag ? 'No reviews due in the next 7 days.' : filtering ? 'No patient matches this search.' : 'No patients yet. Add the first one with "New patient".'}
          </div>
        )}
        {foot && (
          <div className="foot row">
            <span className="grow">{foot}</span>
            {!loading && rows.length < total && <button type="button" className="btn small" onClick={() => setLimit(limit + 200)}>Show 200 more</button>}
          </div>
        )}
      </section>
    </main>
  )
}
