import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GrowthChart from '../components/GrowthChart'
import { decimalAge, formatAge, formatDate, midParentalHeight } from '../lib/age'
import { bmi, heightVelocity } from '../lib/clinical'
import { findReference, growthPoints, MEASURES, sds } from '../lib/growth'
import type { Measure } from '../lib/growth-reference'
import { store } from '../lib/store'
import type { Patient, Visit } from '../lib/types'

const signed = (n: number | null) => (n == null ? '—' : `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(1)}`)

export default function Growth() {
  const { id = '' } = useParams()
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined)
  const [visits, setVisits] = useState<Visit[]>([])
  const [measure, setMeasure] = useState<Measure>('height')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([store.getPatient(id), store.listVisits(id)]).then(
      ([p, vs]) => {
        setPatient(p)
        setVisits(vs)
      },
      (e: Error) => {
        setError(e.message)
        setPatient(null)
      },
    )
  }, [id])

  const points = useMemo(() => (patient ? growthPoints(visits, patient.dob, measure) : []), [visits, patient, measure])
  const measured = useMemo(() => visits.filter((v) => v.height_cm != null || v.weight_kg != null), [visits])

  if (patient === undefined) return <main className="page muted">Loading…</main>
  if (patient === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const info = MEASURES.find((m) => m.key === measure)!
  const last = points[points.length - 1]
  const reference = last ? findReference(patient.sex, measure, last.age) : null
  const latestHeight = visits.find((v) => v.height_cm != null)
  const velocity = latestHeight ? heightVelocity(latestHeight.height_cm, latestHeight.visit_date, visits.filter((v) => v.visit_date < latestHeight.visit_date)) : null
  const mph = midParentalHeight(patient.father_height_cm, patient.mother_height_cm, patient.sex)
  const lastSds = last ? sds(last.value, patient.sex, measure, last.age) : null
  const anySds = measured.some((v) => v.height_cm != null && sds(v.height_cm, patient.sex, 'height', decimalAge(patient.dob, v.visit_date) ?? -1) != null)

  return (
    <main className="page">
      <div className="row">
        <div className="grow">
          <h1 style={{ fontSize: 21 }}>Growth · <Link to={`/patients/${id}`}>{patient.name}</Link></h1>
          <div className="muted">{formatAge(patient.dob)} · {patient.sex === 'M' ? 'Male' : 'Female'} · <span className="mono">MRN {patient.mrn}</span></div>
        </div>
        <Link to={`/patients/${id}/visits/new`} className="btn primary">+ New visit</Link>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="calc" style={{ marginTop: 0 }}>
        <div>
          <div className="k">Latest {info.label.toLowerCase()}</div>
          <div className="v">{last ? `${last.value} ${info.unit}` : '—'}</div>
          <div className="k">{last ? `${formatDate(last.date)} · ${formatAge(patient.dob, last.date)}` : 'not recorded'}</div>
        </div>
        <div>
          <div className="k">{info.label} SDS</div>
          <div className="v">{signed(lastSds)}</div>
          <div className="k">{lastSds == null ? 'needs the reference tables' : (reference?.label ?? '')}</div>
        </div>
        <div>
          <div className="k">Height velocity</div>
          <div className="v">{velocity ? `${velocity.cmPerYear.toFixed(1)} cm/yr` : '—'}</div>
          <div className="k">{velocity ? `since ${formatDate(velocity.fromDate)}` : 'needs two heights 3 months apart'}</div>
        </div>
        <div>
          <div className="k">Mid-parental height</div>
          <div className="v">{mph == null ? '—' : `${mph.toFixed(1)} cm`}</div>
          <div className="k">{mph == null ? 'add the parents’ heights' : `target ${(mph - 8).toFixed(1)}–${(mph + 8).toFixed(1)} cm`}</div>
        </div>
      </div>

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <div className="seg" role="group" aria-label="Measure">
            {MEASURES.map((m) => (
              <button type="button" key={m.key} aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)}>{m.label}</button>
            ))}
          </div>
          <span className="grow" />
          <span className="muted" style={{ fontSize: 13 }}>{reference ? reference.label : 'The child’s own measurements'}</span>
        </div>
        <GrowthChart points={points} reference={reference} label={info.label} unit={info.unit} />
        {!reference && points.length > 0 && (
          <div className="note" style={{ background: '#eceFee', color: '#44545b', fontWeight: 400 }}>
            Centile curves and SDS are not shown yet: the published reference tables have not been added to the app.
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="grow">Measurements</h2><span className="muted">{measured.length} visits</span></div>
        {measured.length === 0 ? (
          <div className="empty">No measurements yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="preview">
              <thead><tr><th>Date</th><th>Age</th><th>Height (cm)</th>{anySds && <th>Height SDS</th>}<th>Velocity (cm/yr)</th><th>Weight (kg)</th><th>BMI</th></tr></thead>
              <tbody>
                {measured.map((v) => {
                  const vel = heightVelocity(v.height_cm, v.visit_date, visits.filter((x) => x.visit_date < v.visit_date))
                  const z = v.height_cm == null ? null : sds(v.height_cm, patient.sex, 'height', decimalAge(patient.dob, v.visit_date) ?? -1)
                  return (
                    <tr key={v.id}>
                      <td><Link to={`/patients/${id}/visits/${v.id}`}>{formatDate(v.visit_date)}</Link></td>
                      <td>{formatAge(patient.dob, v.visit_date)}</td>
                      <td className="mono">{v.height_cm ?? '—'}</td>
                      {anySds && <td className="mono">{signed(z)}</td>}
                      <td className="mono">{vel ? vel.cmPerYear.toFixed(1) : '—'}</td>
                      <td className="mono">{v.weight_kg ?? '—'}</td>
                      <td className="mono">{bmi(v.height_cm, v.weight_kg) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
