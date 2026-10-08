import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatAge, formatDate } from '../lib/age'
import { bmi, rxLine } from '../lib/clinical'
import { EMPTY_CLINIC, store } from '../lib/store'
import { tannerSummary } from '../lib/tanner'
import type { Clinic, Patient, Visit } from '../lib/types'

const PREVIEW = !!import.meta.env.VITE_PREVIEW

export default function PrintRx() {
  const { id = '', vid = '' } = useParams()
  const [data, setData] = useState<{ p: Patient; v: Visit; c: Clinic } | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([store.getPatient(id), store.getVisit(vid), store.getClinic()]).then(
      ([p, v, c]) => setData(p && v && v.patient_id === p.id ? { p, v, c: c ?? EMPTY_CLINIC } : null),
      (e: Error) => {
        setError(e.message)
        setData(null)
      },
    )
  }, [id, vid])

  if (data === undefined) return <main className="page muted">Loading…</main>
  if (data === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This prescription could not be found.'}</div>
        <Link to={`/patients/${id}`}>Back to the patient</Link>
      </main>
    )

  const { p, v, c } = data
  const b = bmi(v.height_cm, v.weight_kg)
  const vitals: [string, string][] = []
  if (v.height_cm != null) vitals.push(['Height', `${v.height_cm} cm`])
  if (v.weight_kg != null) vitals.push(['Weight', `${v.weight_kg} kg`])
  if (b != null) vitals.push(['BMI', `${b} kg/m²`])
  if (v.bp) vitals.push(['BP', `${v.bp} mmHg`])
  const noHeader = !c.doctor_name.trim()

  return (
    <main className="sheet-wrap">
      <div className="sheet-tools no-print">
        <Link to={`/patients/${id}`} className="btn">Back to patient</Link>
        <Link to={`/patients/${id}/visits/${vid}`} className="btn">Edit visit</Link>
        <span className="grow" />
        {PREVIEW ? (
          <span className="muted">Printing is switched off in this preview; it works in the deployed app.</span>
        ) : (
          <button type="button" className="btn primary" onClick={() => window.print()}>Print</button>
        )}
      </div>
      {noHeader && (
        <div className="alert no-print" style={{ width: '100%', maxWidth: '210mm' }}>
          The letterhead is empty. Add the doctor and clinic details under <Link to="/settings">Settings</Link>.
        </div>
      )}

      <article className="sheet">
        <div className="letterhead">
          <div>
            <h1 className="doctor">{c.doctor_name || 'Doctor’s name'}</h1>
            {c.qualifications && <div>{c.qualifications}</div>}
            {c.reg_no && <div>Reg. No. {c.reg_no}</div>}
          </div>
          <div className="right">
            {c.clinic_name && <div style={{ fontWeight: 600 }}>{c.clinic_name}</div>}
            {c.address && <div style={{ whiteSpace: 'pre-line' }}>{c.address}</div>}
            {c.phone && <div>Phone: {c.phone}</div>}
            {c.email && <div>{c.email}</div>}
          </div>
        </div>

        <div className="who-row">
          <div>
            <strong>{p.name}</strong> · {formatAge(p.dob, v.visit_date)} · {p.sex === 'M' ? 'Male' : 'Female'}
          </div>
          <div>
            <span className="mono">MRN {p.mrn}</span> · {formatDate(v.visit_date)}
          </div>
        </div>

        {vitals.length > 0 && (
          <div className="vitals">
            {vitals.map(([k, val]) => (
              <div key={k}>
                <div className="k">{k}</div>
                <div className="mono">{val}</div>
              </div>
            ))}
          </div>
        )}

        {tannerSummary(v.tanner, p.sex) && <div><strong>Pubertal stage:</strong> {tannerSummary(v.tanner, p.sex)}</div>}
        {p.allergies && <div><strong>Drug allergy:</strong> {p.allergies}</div>}
        {v.assessment && <div style={{ whiteSpace: 'pre-wrap' }}><strong>Diagnosis:</strong> {v.assessment}</div>}

        <div className="rx">
          <div className="rx-mark" role="img" aria-label="Prescription">℞</div>
          <ol className="rx-list">
            {v.medicines.map((m, i) => (
              <li key={i}>
                <div style={{ fontWeight: 600 }}>{i + 1}. {m.name}</div>
                {rxLine(m) && <div>{rxLine(m)}</div>}
                {m.instructions && <div>{m.instructions}</div>}
              </li>
            ))}
            {v.medicines.length === 0 && <li className="muted">No medicines prescribed at this visit.</li>}
          </ol>
        </div>

        {v.investigations.length > 0 && (
          <div className="block">
            <div style={{ fontWeight: 600 }}>Investigations advised</div>
            {v.investigations.join(' · ')}
          </div>
        )}

        {v.print_plan && v.plan && (
          <div className="block">
            <div style={{ fontWeight: 600 }}>Plan</div>
            {v.plan}
          </div>
        )}

        {v.advice && (
          <div className="block">
            <div style={{ fontWeight: 600 }}>Advice</div>
            {v.advice}
          </div>
        )}

        <div className="bottom">
          {v.review_date ? (
            <div className="review">
              <div className="k" style={{ color: '#44545b', fontSize: '10pt' }}>Next review</div>
              <div style={{ fontWeight: 600, fontSize: '13pt' }}>{formatDate(v.review_date)}</div>
            </div>
          ) : (
            <span />
          )}
          <div className="sign">
            <div className="line" />
            <div style={{ fontWeight: 600, marginTop: '1.5mm' }}>{c.doctor_name}</div>
          </div>
        </div>
      </article>
    </main>
  )
}
