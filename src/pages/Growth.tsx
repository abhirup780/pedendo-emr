import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GrowthChart from '../components/GrowthChart'
import { useTitle } from '../components/hooks'
import { PageSkeleton } from '../components/Skeleton'
import { formatAge, formatDate, midParentalHeight, TARGET_RANGE_CM, targetRange } from '../lib/age'
import { bmi, heightVelocity } from '../lib/clinical'
import { bmiBand, chartReference, growthPoints, MEASURES, visitSds } from '../lib/growth'
import { noReferenceReason, referenceAt, REFS } from '../lib/growth-reference'
import type { Measure } from '../lib/growth-reference'
import { refSex, sexLabel } from '../lib/sex'
import { store } from '../lib/store'
import type { Patient, RefSex, Visit } from '../lib/types'
import { NONE } from '../lib/text'

const signed = (n: number | null) => (n == null ? NONE : `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)}`)

export default function Growth() {
  const { id = '' } = useParams()
  useTitle('Growth chart')
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined)
  const [visits, setVisits] = useState<Visit[]>([])
  const [measure, setMeasure] = useState<Measure>('height')
  const [error, setError] = useState('')
  // Only for a child whose sex is not assigned: which reference to hold the points against.
  // A way of looking, chosen on this screen; it is not saved and changes nothing on the record.
  const [compare, setCompare] = useState<RefSex | null>(null)

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

  const points = useMemo(() => (patient ? growthPoints(visits, patient.dob, measure, refSex(patient.sex) ?? compare) : []), [visits, patient, measure, compare])
  const measured = useMemo(() => visits.filter((v) => v.height_cm != null || v.weight_kg != null), [visits])

  if (patient === undefined) return <PageSkeleton />
  if (patient === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const info = MEASURES.find((m) => m.key === measure)!
  const lower = measure === 'bmi' ? 'BMI' : info.label.toLowerCase()
  const last = points[points.length - 1]
  const unassigned = patient.sex === 'U'
  const rs = refSex(patient.sex) ?? compare
  const reference = rs ? chartReference(rs, measure, points.map((p) => p.age)) : null
  const lastRef = last && rs ? referenceAt(rs, measure, last.ageDays) : null
  const lastSds = last?.sds ?? null
  const band = measure === 'bmi' && last && rs ? bmiBand(last.raw, rs, last.ageDays) : null
  const refNames = reference ? reference.refs.map((r) => REFS[r].short).join(' · ') : ''
  const lineNote = !reference
    ? ''
    : reference.refs.includes('iap2015')
      ? measure === 'bmi'
        ? 'Lines are those printed in the IAP 2015 paper: the 3rd, 5th, 10th, 25th and 50th centiles; OW and OB are its overweight and obesity lines (adult-equivalent BMI 23 and 27).'
        : 'Lines are the seven on the IAP chart, labelled 3 to 97 as printed there: the median, and ⅔, 1⅓ and 2 SD either side.'
      : 'Lines are the WHO median and 1, 2 and 3 SD either side.'
  const latestHeight = visits.find((v) => v.height_cm != null)
  const velocity = latestHeight ? heightVelocity(latestHeight.height_cm, latestHeight.visit_date, visits.filter((v) => v.visit_date < latestHeight.visit_date)) : null
  const mph = midParentalHeight(patient.father_height_cm, patient.mother_height_cm, patient.sex)
  // On the height chart the target is marked where the child is heading: at 18 years.
  const target = measure === 'height' && mph != null ? { mid: mph, low: mph - TARGET_RANGE_CM, high: mph + TARGET_RANGE_CM } : null
  const targetShown = target != null && reference != null && reference.to >= 18
  const rows = measured.map((v) => ({ v, z: visitSds(v, patient.dob, rs ?? 'U') }))

  return (
    <main className="page">
      <div className="row">
        <div className="grow">
          <h1 className="sub">Growth · <Link to={`/patients/${id}`}>{patient.name}</Link></h1>
          <div className="muted">{formatAge(patient.dob)} · {sexLabel(patient.sex)} · <span className="mono">MRN {patient.mrn}</span></div>
        </div>
        <Link to={`/patients/${id}/visits/new`} className="btn primary">+ New visit</Link>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="calc cols4" style={{ marginTop: 0 }}>
        <div>
          <div className="k">Latest {lower}</div>
          <div className="v">{last ? `${last.value} ${info.unit}` : NONE}</div>
          <div className="k">{last ? `${formatDate(last.date)} · ${formatAge(patient.dob, last.date)}` : 'not recorded'}</div>
        </div>
        <div>
          <div className="k">{info.label} SDS</div>
          <div className="v">{signed(lastSds)}</div>
          <div className="k">{!last ? 'not recorded' : !rs ? 'sex not assigned' : !lastRef || lastSds == null ? noReferenceReason(measure, last.ageDays) : unassigned ? `as a ${rs === 'M' ? 'boy' : 'girl'} · ${REFS[lastRef.ref].short}` : `${REFS[lastRef.ref].short}${lastRef.posture === 'length' ? ' · length' : ''}${band ? ` · ${band}` : ''}`}</div>
        </div>
        <div>
          <div className="k">Height velocity</div>
          <div className="v">{velocity ? `${velocity.cmPerYear.toFixed(1)} cm/yr` : NONE}</div>
          <div className="k">{velocity ? `since ${formatDate(velocity.fromDate)}` : 'needs two heights 3 months apart'}</div>
        </div>
        <div>
          <div className="k">Mid-parental height</div>
          <div className="v">{mph == null ? NONE : `${mph.toFixed(1)} cm`}</div>
          <div className="k">{mph == null ? (unassigned ? 'after sex is assigned' : 'add the parents’ heights') : `target ${targetRange(mph)}`}</div>
        </div>
      </div>

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <div className="seg" role="group" aria-label="Measure">
            {MEASURES.map((m) => (
              <button type="button" key={m.key} aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)}>{m.label}</button>
            ))}
          </div>
          {unassigned && (
            <div className="seg" role="group" aria-label="Compare with the reference for">
              <button type="button" aria-pressed={compare === null} onClick={() => setCompare(null)}>No reference</button>
              <button type="button" aria-pressed={compare === 'M'} onClick={() => setCompare('M')}>Boys</button>
              <button type="button" aria-pressed={compare === 'F'} onClick={() => setCompare('F')}>Girls</button>
            </div>
          )}
          <span className="grow" />
          <span className="muted sm">{reference ? `${refNames}${unassigned ? (rs === 'M' ? ' · boys' : ' · girls') : ''}` : 'The child’s own measurements'}</span>
        </div>
        {unassigned && (
          <div className="note info">
            Sex is not yet assigned, so no reference is applied by default. Choose Boys or Girls above to look at the measurements against either one; the choice is not saved.
          </div>
        )}
        <GrowthChart points={points} reference={reference} label={info.label} unit={info.unit} target={target} dob={patient.dob} />
        {reference && (
          <div className="muted sm">
            {lineNote}
            {targetShown && ` The bar at 18 years is the mid-parental target, ${targetRange(mph!)}.`}
            {reference.refs.length > 1 && ' WHO (under 5 years) and IAP (from 5 years) are separate references, so the lines step at 5 years.'}
            {measure === 'height' && points.some((p) => p.age < 2) && ' Under 2 years the WHO standard is for length measured lying down; from 2 years, standing height.'}
            {measure !== 'height' && points.some((p) => p.age < 5) && ` No ${lower} reference is held for under 5 years.`}
          </div>
        )}
        {!reference && points.length > 0 && rs && (
          <div className="note info">
            No reference lines or SDS: {noReferenceReason(measure, last.ageDays)}. The app holds WHO 2006 length/height for under 5 years and IAP 2015 height, weight and BMI for 5 to 18 years.
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="grow">Measurements</h2><span className="muted">{measured.length} visits</span></div>
        {measured.length === 0 ? (
          <div className="empty">No measurements yet.</div>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Measurements">
            {/* On a phone each row is a card; the labels the cards need are the data-k of each cell. */}
            <table className="preview measures">
              <thead><tr><th>Date</th><th>Age</th><th>Height (cm)</th><th>Height SDS</th><th>Velocity (cm/yr)</th><th>Weight (kg)</th><th>Weight SDS</th><th>BMI</th><th>BMI SDS</th></tr></thead>
              <tbody>
                {rows.map(({ v, z }) => {
                  const vel = heightVelocity(v.height_cm, v.visit_date, visits.filter((x) => x.visit_date < v.visit_date))
                  return (
                    <tr key={v.id}>
                      <td><Link to={`/patients/${id}/visits/${v.id}`}>{formatDate(v.visit_date)}</Link></td>
                      <td>{formatAge(patient.dob, v.visit_date)}</td>
                      <td className="mono own" data-k="Height (cm)">{v.height_cm ?? NONE}</td>
                      <td className="mono" data-k="SDS">{signed(z.height)}</td>
                      <td className="mono" data-k="Velocity (cm/yr)">{vel ? vel.cmPerYear.toFixed(1) : NONE}</td>
                      <td className="mono own" data-k="Weight (kg)">{v.weight_kg ?? NONE}</td>
                      <td className="mono" data-k="SDS">{signed(z.weight)}</td>
                      <td className="mono own" data-k="BMI">{bmi(v.height_cm, v.weight_kg) ?? NONE}</td>
                      <td className="mono" data-k="SDS">{signed(z.bmi)}</td>
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
