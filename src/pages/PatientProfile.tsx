import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon, RxMark } from '../components/Icon'
import { Qty } from '../components/Qty'
import Results from '../components/Results'
import { PageSkeleton } from '../components/Skeleton'
import { useTitle } from '../components/hooks'
import { initials } from '../components/Shell'
import { Tag } from '../components/Tag'
import { formatAge, formatDate, midParentalHeight, targetRange, todayISO } from '../lib/age'
import { allergyStatus } from '../lib/allergy'
import { bmi, daysBetween, rxLine } from '../lib/clinical'
import { visitSds } from '../lib/growth'
import { visitDrafts } from '../lib/device'
import { sexLabel } from '../lib/sex'
import { photoFiles } from '../lib/photofiles'
import { store } from '../lib/store'
import { tannerSummary } from '../lib/tanner'
import { toast } from '../lib/toast'
import type { Condition, Investigation, Patient, Visit } from '../lib/types'
import { NONE } from '../lib/text'

export default function PatientProfile() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState<Patient | null | undefined>(undefined)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [catalog, setCatalog] = useState<Investigation[]>([])
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  useTitle('Patient')

  useEffect(() => {
    Promise.all([store.getPatient(id), store.listConditions(), store.listVisits(id)]).then(
      ([pt, cs, vs]) => {
        setP(pt)
        setConditions(cs)
        setVisits(vs)
        store.listInvestigations().then(setCatalog, () => {})
      },
      (e: Error) => {
        setError(e.message)
        setP(null)
      },
    )
  }, [id])

  if (p === undefined) return <PageSkeleton />
  if (p === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const tags = conditions.filter((c) => p.condition_ids.includes(c.id))
  const allergy = allergyStatus(p.allergies)
  // At a glance: the visits come newest first.
  const lastVisit = visits[0]
  const withHeight = visits.find((v) => v.height_cm != null)
  const withWeight = visits.find((v) => v.weight_kg != null)
  const heightSds = withHeight ? visitSds(withHeight, p.dob, p.sex).height : null
  const weightBmi = withWeight ? bmi(withWeight.height_cm, withWeight.weight_kg) : null
  const lastRx = visits.find((v) => v.medicines.length > 0)
  const reviewIn = p.next_review_on ? daysBetween(todayISO(), p.next_review_on) : null
  // Visit notes typed in this tab and not saved. A draft of a visit since deleted is left out.
  const drafts = visitDrafts(id)
  const newDraft = drafts.find((d) => d.vid === null)
  const draftIds = new Set(drafts.map((d) => d.vid))
  const clock = (at: string) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const mph = midParentalHeight(p.father_height_cm, p.mother_height_cm, p.sex)

  async function remove() {
    try {
      // The photograph files first: once the records are gone nothing says where they are.
      await photoFiles.remove((await store.listPhotos(id)).map((ph) => ph.file_id))
      await store.deletePatient(id)
      toast('Patient deleted.')
      nav('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    }
  }

  return (
    <main className="page">
      {error && <div className="alert">{error}</div>}
      {/* Who it is, with the allergy status beside the name; then what can be done next. */}
      <section className="card pad phead">
        <span className="avatar lg" aria-hidden="true">
          {initials(p.name)}
        </span>
        <div className="phead-id">
          <div className="row" style={{ gap: '6px 10px' }}>
            <h1 className="sub">{p.name}</h1>
            {tags.map((c) => (
              <Tag key={c.id} condition={c} />
            ))}
            {allergy === 'some' && <span className="pill danger">Allergy: {p.allergies}</span>}
            {allergy === 'none' && <span className="pill ok">No known drug allergy</span>}
            {allergy === 'unrecorded' && <span className="pill info">Allergies not recorded</span>}
          </div>
          <div className="muted" style={{ marginTop: 3 }}>
            {formatAge(p.dob)} · {sexLabel(p.sex)} · DOB {formatDate(p.dob)} · <span className="mono" style={{ whiteSpace: 'nowrap' }}>MRN {p.mrn}</span>
          </div>
        </div>
        <div className="phead-actions">
          <Link to={`/patients/${p.id}/edit`} className="btn outline">
            <Icon name="pencil" />
            Edit
          </Link>
          <Link to={`/patients/${p.id}/growth`} className="btn outline" aria-label="Growth chart">
            <Icon name="chart" />
            <span>Growth<span className="wide-only"> chart</span></span>
          </Link>
          <Link to={`/patients/${p.id}/photos`} className="btn outline">
            <Icon name="image" />
            Photos
          </Link>
          <Link to={`/patients/${p.id}/visits/new`} className="btn primary">
            <Icon name="plus" />
            New visit
          </Link>
        </div>
      </section>

      {lastVisit && (
        <div className="calc cols4" style={{ marginTop: 0 }}>
          <div>
            <div className="k">Last visit</div>
            <div className="v">{formatDate(lastVisit.visit_date)}</div>
            <div className="k">{visits.length === 1 ? '1 visit recorded' : `${visits.length} visits recorded`}</div>
          </div>
          <div>
            <div className="k">Next review</div>
            <div className={reviewIn != null && reviewIn < 0 ? 'v warn' : 'v'}>{p.next_review_on ? formatDate(p.next_review_on) : NONE}</div>
            <div className="k">{reviewIn == null ? 'no review date set' : reviewIn < 0 ? `overdue by ${-reviewIn} ${reviewIn === -1 ? 'day' : 'days'}` : reviewIn === 0 ? 'today' : `in ${reviewIn} ${reviewIn === 1 ? 'day' : 'days'}`}</div>
          </div>
          <div>
            <div className="k">Latest height</div>
            <div className="v">{withHeight ? <Qty v={withHeight.height_cm!} u="cm" /> : NONE}</div>
            <div className="k">{withHeight ? `${heightSds == null ? '' : `SDS ${heightSds < 0 ? '−' : '+'}${Math.abs(heightSds).toFixed(2)} · `}${formatDate(withHeight.visit_date)}` : 'not recorded'}</div>
          </div>
          <div>
            <div className="k">Latest weight</div>
            <div className="v">{withWeight ? <Qty v={withWeight.weight_kg!} u="kg" /> : NONE}</div>
            <div className="k">{withWeight ? `${weightBmi == null ? '' : `BMI ${weightBmi} · `}${formatDate(withWeight.visit_date)}` : 'not recorded'}</div>
          </div>
          {lastRx && (
            <div className="wide">
              <div className="k">Medicines on the last prescription, {formatDate(lastRx.visit_date)}</div>
              <ul className="rx-brief">
                {lastRx.medicines.map((m, i) => (
                  <li key={i}><strong>{m.name}</strong>{rxLine(m) && <span className="muted"> {rxLine(m)}</span>}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {newDraft && (
        <div className="note row" role="status">
          <span className="grow">A new visit was started{newDraft.at && ` at ${clock(newDraft.at)}`} and not saved. The notes are kept in this tab only.</span>
          <Link to={`/patients/${p.id}/visits/new`} className="btn small">Continue the visit</Link>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="grow ic"><Icon name="calendar" size={18} />Visits</h2>
          <span className="muted">{visits.length === 0 ? 'None yet' : `${visits.length} recorded`}</span>
        </div>
        {visits.length === 0 ? (
          <div className="empty">No visits yet. Start the first one with "New visit".</div>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Visit history">
            <div className="vtable" role="table" aria-label="Visits">
              <div className="vrow head" role="row">
                <div role="columnheader">Date</div>
                <div role="columnheader">Age</div>
                <div role="columnheader">Height</div>
                <div role="columnheader">Weight</div>
                <div role="columnheader">BMI</div>
                <div role="columnheader">Tanner</div>
                <div role="columnheader">Assessment</div>
                <div role="columnheader"><RxMark label="Prescription" /></div>
              </div>
              {visits.map((v) => (
                <div className="vrow" key={v.id} role="row">
                  <div role="cell">
                    <Link className="open" to={`/patients/${p.id}/visits/${v.id}`}>
                      {formatDate(v.visit_date)}
                    </Link>
                    {draftIds.has(v.id) && <> <span className="pill warn">Unsaved changes</span></>}
                  </div>
                  <div role="cell">{formatAge(p.dob, v.visit_date)}</div>
                  <div className="mono" role="cell">{v.height_cm == null ? NONE : <Qty v={v.height_cm} u="cm" />}</div>
                  <div className="mono" role="cell">{v.weight_kg == null ? NONE : <Qty v={v.weight_kg} u="kg" />}</div>
                  <div className="mono" role="cell">{bmi(v.height_cm, v.weight_kg) ?? NONE}</div>
                  <div className="mono clip" role="cell" title={tannerSummary(v.tanner, p.sex)}>{tannerSummary(v.tanner, p.sex).split(' · ')[0] || NONE}</div>
                  <div className="clip" role="cell" title={v.assessment}>{v.assessment || NONE}</div>
                  <div role="cell">
                    <Link className="rx-link" to={`/patients/${p.id}/visits/${v.id}/print`} title="Open the prescription, to print it">
                      {v.medicines.length === 0 ? 'Print' : `${v.medicines.length} ${v.medicines.length === 1 ? 'item' : 'items'}`}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Results patientId={p.id} catalog={catalog} mode="all" />

      <section className="card pad">
        <h2 className="ic" style={{ marginBottom: 12 }}><Icon name="person" size={18} />Patient details</h2>
        <dl className="dl">
          <dt>Parent or guardian</dt>
          <dd>{p.guardian_name ? `${p.guardian_name} (${p.guardian_relation})` : NONE}</dd>
          <dt>Phone</dt>
          <dd className="mono">{p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : NONE}</dd>
          <dt>Address</dt>
          <dd>{p.address || NONE}</dd>
          <dt>Parents' heights</dt>
          <dd className="mono">
            {[p.father_height_cm ? `Father ${p.father_height_cm} cm` : '', p.mother_height_cm ? `Mother ${p.mother_height_cm} cm` : ''].filter(Boolean).join(' · ') || NONE}
          </dd>
          <dt>Mid-parental height</dt>
          <dd className="mono">{mph == null ? (p.sex === 'U' && p.father_height_cm && p.mother_height_cm ? 'after sex is assigned' : NONE) : `${mph.toFixed(1)} cm (target ${targetRange(mph)})`}</dd>
          <dt>Notes</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>{p.notes || NONE}</dd>
          <dt>Registered</dt>
          <dd>{formatDate(p.created_at)}</dd>
        </dl>
      </section>

      <div className="row end">
        {confirming ? (
          <>
            <span>Delete {p.name} with all visits and results? Photographs of this patient are erased too. This cannot be undone.</span>
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
