import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { initials } from '../components/Shell'
import { Tag } from '../components/Tag'
import { formatAge, formatDate, midParentalHeight } from '../lib/age'
import { bmi } from '../lib/clinical'
import { store } from '../lib/store'
import type { Condition, Patient, Visit } from '../lib/types'

export default function PatientProfile() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState<Patient | null | undefined>(undefined)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([store.getPatient(id), store.listConditions(), store.listVisits(id)]).then(
      ([pt, cs, vs]) => {
        setP(pt)
        setConditions(cs)
        setVisits(vs)
      },
      (e: Error) => {
        setError(e.message)
        setP(null)
      },
    )
  }, [id])

  if (p === undefined) return <main className="page muted">Loading…</main>
  if (p === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const tags = conditions.filter((c) => p.condition_ids.includes(c.id))
  const mph = midParentalHeight(p.father_height_cm, p.mother_height_cm, p.sex)

  async function remove() {
    try {
      await store.deletePatient(id)
      nav('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    }
  }

  return (
    <main className="page">
      {error && <div className="alert">{error}</div>}
      <section className="card pad">
        <div className="row">
          <span className="avatar lg" aria-hidden="true">
            {initials(p.name)}
          </span>
          <div className="grow">
            <div className="row" style={{ gap: '6px 10px' }}>
              <h1 style={{ fontSize: 21 }}>{p.name}</h1>
              {tags.map((c) => (
                <Tag key={c.id} condition={c} />
              ))}
            </div>
            <div className="muted" style={{ marginTop: 3 }}>
              {formatAge(p.dob)} · {p.sex === 'M' ? 'Male' : 'Female'} · DOB {formatDate(p.dob)} · <span className="mono">MRN {p.mrn}</span>
            </div>
          </div>
          <span className={`pill ${p.allergies ? 'warn' : 'ok'}`}>{p.allergies ? `Allergy: ${p.allergies}` : 'No known drug allergy'}</span>
          <Link to={`/patients/${p.id}/edit`} className="btn outline">
            Edit
          </Link>
          <Link to={`/patients/${p.id}/visits/new`} className="btn primary">
            + New visit
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="grow">Visits</h2>
          <span className="muted">{visits.length === 0 ? 'None yet' : `${visits.length} recorded`}</span>
        </div>
        {visits.length === 0 ? (
          <div className="empty">No visits yet. Start the first one with "New visit".</div>
        ) : (
          <div className="table-wrap">
            <div className="vtable">
              <div className="vrow head">
                <div>Date</div>
                <div>Age</div>
                <div>Height</div>
                <div>Weight</div>
                <div>BMI</div>
                <div>Assessment</div>
                <div>℞</div>
              </div>
              {visits.map((v) => (
                <div className="vrow" key={v.id}>
                  <div>
                    <Link to={`/patients/${p.id}/visits/${v.id}`} style={{ fontWeight: 600, textDecoration: 'none', display: 'inline-block', padding: '4px 0' }}>
                      {formatDate(v.visit_date)}
                    </Link>
                  </div>
                  <div>{formatAge(p.dob, v.visit_date)}</div>
                  <div className="mono">{v.height_cm == null ? '—' : `${v.height_cm} cm`}</div>
                  <div className="mono">{v.weight_kg == null ? '—' : `${v.weight_kg} kg`}</div>
                  <div className="mono">{bmi(v.height_cm, v.weight_kg) ?? '—'}</div>
                  <div className="clip" title={v.assessment}>{v.assessment || '—'}</div>
                  <div>
                    <Link to={`/patients/${p.id}/visits/${v.id}/print`} style={{ display: 'inline-block', padding: '4px 0' }}>
                      {v.medicines.length === 0 ? 'Open' : `${v.medicines.length} ${v.medicines.length === 1 ? 'item' : 'items'}`}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card pad">
        <h2 style={{ marginBottom: 12 }}>Patient details</h2>
        <dl className="dl">
          <dt>Parent or guardian</dt>
          <dd>{p.guardian_name ? `${p.guardian_name} (${p.guardian_relation})` : '—'}</dd>
          <dt>Phone</dt>
          <dd className="mono">{p.phone || '—'}</dd>
          <dt>Address</dt>
          <dd>{p.address || '—'}</dd>
          <dt>Parents' heights</dt>
          <dd className="mono">
            {p.father_height_cm || p.mother_height_cm ? `Father ${p.father_height_cm ?? '—'} cm · Mother ${p.mother_height_cm ?? '—'} cm` : '—'}
          </dd>
          <dt>Mid-parental height</dt>
          <dd className="mono">{mph == null ? '—' : `${mph.toFixed(1)} cm (target ${(mph - 8).toFixed(1)}–${(mph + 8).toFixed(1)} cm)`}</dd>
          <dt>Notes</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>{p.notes || '—'}</dd>
          <dt>Registered</dt>
          <dd>{formatDate(p.created_at)}</dd>
        </dl>
      </section>

      <div className="row end">
        {confirming ? (
          <>
            <span>Delete {p.name} and all their records? This cannot be undone.</span>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep
            </button>
            <button type="button" className="btn danger" onClick={remove}>
              Delete permanently
            </button>
          </>
        ) : (
          <button type="button" className="btn danger small" onClick={() => setConfirming(true)}>
            Delete patient
          </button>
        )}
      </div>
    </main>
  )
}
