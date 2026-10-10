import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { formatAge, formatDate } from '../lib/age'
import { allergyStatus } from '../lib/allergy'
import { bmi, rxLine } from '../lib/clinical'
import { sexLabel } from '../lib/sex'
import { blocks, firstPageInnerHeight, preprinted, qualificationParts } from '../lib/printlayout'
import type { PrintConfig, SectionKey } from '../lib/printlayout'
import { tannerSummary } from '../lib/tanner'
import type { Clinic, Patient, Visit } from '../lib/types'
import { RxMark } from './Icon'

interface Props {
  config: PrintConfig
  patient: Patient
  visit: Visit
  clinic: Clinic
  /** Draw the margin box and the pre-printed area, for lining a layout up with a pad. */
  guides?: boolean
}

/**
 * One prescription drawn to a print layout. The same component is the printed page, the
 * on-screen preview and the layout editor's live preview, so what is edited is what prints.
 * On screen it is shown page by page: `RxPages` draws it into the pages it will print on.
 */
export default function RxSheet({ config: c, patient: p, visit: v, clinic, guides }: Props) {
  const mm = (n: number) => `${n}mm`
  const custom = c.letterhead.source === 'custom'
  const lh = {
    clinic_name: custom ? c.letterhead.clinic_name : clinic.clinic_name,
    address: custom ? c.letterhead.address : clinic.address,
    phone: custom ? c.letterhead.phone : clinic.phone,
    email: custom ? c.letterhead.email : clinic.email,
  }
  const b = bmi(v.height_cm, v.weight_kg)
  const vitals: [string, string][] = []
  if (v.height_cm != null) vitals.push(['Height', `${v.height_cm} cm`])
  if (v.weight_kg != null) vitals.push(['Weight', `${v.weight_kg} kg`])
  if (b != null) vitals.push(['BMI', `${b} kg/m²`])
  if (v.bp) vitals.push(['BP', `${v.bp} mmHg`])
  const tanner = tannerSummary(v.tanner, p.sex)
  const titled = (title: string, body: string) => (
    <div className="block">
      <div className="t">{title}</div>
      {body}
    </div>
  )

  const shown = (key: SectionKey) => c.sections.some((s) => s.key === key && s.show)
  const reviewBox = v.review_date ? (
    <div className="review">
      <div className="k">Next review</div>
      <div className="t big">{formatDate(v.review_date)}</div>
    </div>
  ) : null
  const beside = c.signature.review_beside && shown('review') && shown('signature')

  /** Each returns null when there is nothing to print, and the section then takes no space. */
  const draw: Record<SectionKey, () => ReactNode> = {
    letterhead: () => (
      <div className={`letterhead ${c.letterhead.arrangement}${c.letterhead.rule ? ' rule' : ''}`}>
        <div className="lh-left">
          {c.letterhead.logo && clinic.logo && <img className="lh-logo" src={clinic.logo} alt="" />}
          <div>
            <h1 className="doctor">{clinic.doctor_name || 'Doctor’s name'}</h1>
            {/* One degree to a piece: where the line has to break, it breaks after a comma. */}
            {clinic.qualifications && (
              <div className="lh-sub">
                {qualificationParts(clinic.qualifications).map((part, i) => <Fragment key={i}>{i > 0 && ' '}<span className="deg">{part}</span></Fragment>)}
              </div>
            )}
            {clinic.reg_no && <div className="lh-sub">Reg. No. {clinic.reg_no}</div>}
          </div>
        </div>
        <div className="right">
          {lh.clinic_name && <div className="t">{lh.clinic_name}</div>}
          {lh.address && <div style={{ whiteSpace: 'pre-line' }}>{lh.address}</div>}
          {lh.phone && <div>Phone: {lh.phone}</div>}
          {lh.email && <div>{lh.email}</div>}
        </div>
      </div>
    ),
    patient: () => (
      <div className="who-row">
        <div>
          <strong>{p.name}</strong> · {formatAge(p.dob, v.visit_date)}{p.sex === 'U' ? '' : ` · ${sexLabel(p.sex)}`}
        </div>
        {(c.patient.mrn || c.patient.date) && (
          <div>
            {c.patient.mrn && <span className="mono">MRN {p.mrn}</span>}
            {c.patient.mrn && c.patient.date && ' · '}
            {c.patient.date && formatDate(v.visit_date)}
          </div>
        )}
      </div>
    ),
    vitals: () =>
      vitals.length === 0 ? null : c.vitals === 'boxes' ? (
        <div className="vitals">
          {vitals.map(([k, val]) => (
            <div key={k}>
              <div className="k">{k}</div>
              <div className="mono">{val}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vitals-inline">
          {vitals.map(([k, val]) => (
            <span key={k}>
              <span className="k">{k}</span> <span className="mono">{val}</span>
            </span>
          ))}
        </div>
      ),
    tanner: () => (tanner ? <div><strong>Pubertal stage:</strong> {tanner}</div> : null),
    allergy: () => (allergyStatus(p.allergies) === 'some' ? <div><strong>Drug allergy:</strong> {p.allergies}</div> : null),
    complaint: () => (v.complaint ? <div className="pre"><strong>Complaint:</strong> {v.complaint}</div> : null),
    history: () => (v.history ? <div className="pre"><strong>History and examination:</strong> {v.history}</div> : null),
    diagnosis: () => (v.assessment ? <div className="pre"><strong>Diagnosis:</strong> {v.assessment}</div> : null),
    rx: () => (
      <div className="rx">
        {c.rx.symbol && <div className="rx-mark" role="img" aria-label="Prescription"><RxMark /></div>}
        <ol className={`rx-list ${c.rx.style}`}>
          {v.medicines.map((m, i) =>
            c.rx.style === 'compact' ? (
              <li key={i}>
                <span className="t">{i + 1}. {m.name}</span>
                {rxLine(m) && <>: {rxLine(m)}</>}
                {m.instructions && <>. {m.instructions}</>}
              </li>
            ) : (
              <li key={i}>
                <div className="t">{i + 1}. {m.name}</div>
                {rxLine(m) && <div>{rxLine(m)}</div>}
                {m.instructions && <div>{m.instructions}</div>}
              </li>
            ),
          )}
          {v.medicines.length === 0 && <li className="muted">No medicines prescribed at this visit.</li>}
        </ol>
      </div>
    ),
    investigations: () => (v.investigations.length ? titled('Investigations advised', v.investigations.join(' · ')) : null),
    plan: () => (v.print_plan && v.plan ? titled('Plan', v.plan) : null),
    advice: () => (v.advice ? titled('Advice', v.advice) : null),
    // When the review date rides beside the signature it is not also printed on its own.
    review: () => (beside ? null : reviewBox),
    signature: () => (
      <div className="sig-row">
        {beside && reviewBox}
        <div className="sign">
        <div className="line">{c.signature.image && clinic.signature && <img src={clinic.signature} alt="Signature" />}</div>
        {c.signature.name && <div className="t">{clinic.doctor_name}</div>}
        {/* Repeats who this is for beside the signature, so a second page is never anonymous. */}
        {c.signature.patient && <div className="small">{p.name} · MRN {p.mrn} · {formatDate(v.visit_date)}</div>}
        </div>
      </div>
    ),
    note: () => (c.note.trim() ? <div className="foot-note">{c.note}</div> : null),
  }

  const space = new Map(c.sections.map((s) => [s.key, s.space_before]))
  const section = (key: SectionKey) => {
    const body = draw[key]()
    if (body == null) return null
    const push = key === 'signature' && c.signature.at_foot
    return (
      <div key={key} className={`sec sec-${key}${push ? ' at-foot' : ''}`} style={space.get(key) ? { marginTop: mm(space.get(key) as number) } : undefined}>
        {body}
      </div>
    )
  }

  const vars = {
    '--w': mm(c.paper.width),
    '--h': mm(c.paper.height),
    '--mt': mm(c.margin.top),
    '--mr': mm(c.margin.right),
    '--mb': mm(c.margin.bottom),
    '--ml': mm(c.margin.left),
    '--font': `${c.font_pt}pt`,
    '--lh': String(c.line_height),
    '--gap': mm(c.gap),
    '--accent': c.accent,
    '--side': mm(c.side_width),
    '--inner-h': mm(firstPageInnerHeight(c)),
  } as CSSProperties

  return (
    <article className={`sheet${guides ? ' guides' : ''}${c.signature.at_foot ? '' : ' flow'}`} style={vars}>
      {preprinted(c) && <div className="preprint no-print" aria-hidden="true">Pre-printed letterhead area · {c.margin.top} mm left clear</div>}
      {blocks(c).map((blk, i) =>
        blk.kind === 'full' ? (
          section(blk.key)
        ) : (
          <div className="cols" key={`cols-${i}`}>
            <div className={c.side_rule ? 'side rule' : 'side'}>{blk.side.map(section)}</div>
            <div className="main">{blk.main.map(section)}</div>
          </div>
        ),
      )}
    </article>
  )
}
