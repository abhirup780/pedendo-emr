import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InvestigationPicker from '../components/InvestigationPicker'
import Results from '../components/Results'
import TannerPicker from '../components/TannerPicker'
import { ageInDays, decimalAge, formatAge, formatDate, todayISO } from '../lib/age'
import { visitSds } from '../lib/growth'
import { noReferenceReason, referenceAt, REFS } from '../lib/growth-reference'
import { addMonths, bmi, dosePerKg, EMPTY_RX, heightVelocity, validBp } from '../lib/clinical'
import { dropDraft, readDraft, saveDraft } from '../lib/device'
import { store } from '../lib/store'
import { tannerSummary } from '../lib/tanner'
import type { Investigation, Medicine, Panel, Patient, RxItem, RxTemplate, Tanner, Visit, VisitInput } from '../lib/types'

const RX_FIELDS: { key: keyof RxItem; label: string; wide?: boolean }[] = [
  { key: 'dose', label: 'Dose' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'route', label: 'Route' },
  { key: 'duration', label: 'Duration' },
  { key: 'instructions', label: 'Instructions', wide: true },
]

const BLANK = { date: '', height: '', weight: '', bp: '', complaint: '', history: '', assessment: '', plan: '', advice: '', review: '' }
/** Everything the doctor can change on the screen; what a draft holds. */
interface Editable {
  f: typeof BLANK
  meds: RxItem[]
  printPlan: boolean
  tests: string[]
  tanner: Tanner | null
}

function num(s: string, min: number, max: number): number | null | 'bad' {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= min && n <= max ? n : 'bad'
}

/**
 * Each visit gets a fresh screen. Without the key, moving from one visit straight to another
 * would carry the first one's unsaved text across and file it as a draft of the second.
 */
export default function VisitPage() {
  const { id = '', vid } = useParams()
  return <VisitScreen key={`${id}:${vid ?? 'new'}`} id={id} vid={vid} />
}

function VisitScreen({ id, vid }: { id: string; vid: string | undefined }) {
  const nav = useNavigate()
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined)
  const [visits, setVisits] = useState<Visit[]>([])
  const [catalog, setCatalog] = useState<Medicine[]>([])
  const [templates, setTemplates] = useState<RxTemplate[]>([])
  const [f, setF] = useState({ ...BLANK, date: todayISO() })
  const [printPlan, setPrintPlan] = useState(true)
  const [tests, setTests] = useState<string[]>([])
  const [tanner, setTanner] = useState<Tanner | null>(null)
  const [staging, setStaging] = useState(false)
  const [testCatalog, setTestCatalog] = useState<Investigation[]>([])
  const [panels, setPanels] = useState<Panel[]>([])
  const [meds, setMeds] = useState<RxItem[]>([])
  const [q, setQ] = useState('')
  const [tplName, setTplName] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [loaded, setLoaded] = useState(false)
  const [restoredAt, setRestoredAt] = useState('')
  const baseline = useRef<Editable | null>(null)
  const draftKey = `visit:${id}:${vid ?? 'new'}`
  const apply = (e: Editable) => {
    setF(e.f)
    setMeds(e.meds)
    setPrintPlan(e.printPlan)
    setTests(e.tests)
    setTanner(e.tanner)
  }

  useEffect(() => {
    let live = true
    setLoaded(false)
    Promise.all([store.getPatient(id), store.listVisits(id), store.listMedicines(), store.listTemplates(), store.listInvestigations(), store.listPanels()]).then(
      ([p, vs, ms, ts, inv, pn]) => {
        if (!live) return
        setPatient(p)
        setVisits(vs)
        setCatalog(ms)
        setTemplates(ts)
        setTestCatalog(inv)
        setPanels(pn)
        const v = vid ? vs.find((x) => x.id === vid) : undefined
        if (vid && !v) setError('This visit could not be found.')
        const saved: Editable = v
          ? {
              f: {
                date: v.visit_date,
                height: v.height_cm == null ? '' : String(v.height_cm),
                weight: v.weight_kg == null ? '' : String(v.weight_kg),
                bp: v.bp,
                complaint: v.complaint,
                history: v.history,
                assessment: v.assessment,
                plan: v.plan,
                advice: v.advice,
                review: v.review_date ?? '',
              },
              meds: v.medicines,
              printPlan: v.print_plan,
              tests: v.investigations,
              tanner: v.tanner,
            }
          : { f: { ...BLANK, date: todayISO() }, meds: [], printPlan: true, tests: [], tanner: null }
        baseline.current = saved
        // Notes typed earlier but never saved (a reload, a crash, an idle sign-out) come back.
        const draft = readDraft<Editable>(draftKey)
        if (draft && JSON.stringify(draft.data) !== JSON.stringify(saved)) {
          apply(draft.data)
          setRestoredAt(draft.at)
        } else {
          apply(saved)
        }
        setLoaded(true)
      },
      (e: Error) => {
        if (!live) return
        setError(e.message)
        setPatient(null)
      },
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vid])

  const current: Editable = { f, meds, printPlan, tests, tanner }
  const snapshot = JSON.stringify(current)
  const dirty = loaded && baseline.current != null && snapshot !== JSON.stringify(baseline.current)

  // Keep a draft while there are unsaved changes, and warn before the tab is closed.
  useEffect(() => {
    if (!loaded) return
    if (dirty) saveDraft(draftKey, JSON.parse(snapshot) as Editable)
    else dropDraft(draftKey)
  }, [loaded, dirty, snapshot, draftKey])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function discardDraft() {
    if (baseline.current) apply(baseline.current)
    dropDraft(draftKey)
    setRestoredAt('')
  }

  const set = (k: keyof typeof f, v: string) => setF((old) => ({ ...old, [k]: v }))
  const height = num(f.height, 20, 230)
  const weight = num(f.weight, 0.3, 300)
  const h = typeof height === 'number' ? height : null
  const w = typeof weight === 'number' ? weight : null

  // Earlier visits only: the one being edited and anything dated after it are left out.
  const earlier = useMemo(() => visits.filter((v) => v.id !== vid && v.visit_date < f.date), [visits, vid, f.date])
  const last = earlier[0]
  const lastWithHeight = earlier.find((v) => v.height_cm != null)
  const velocity = heightVelocity(h, f.date, earlier)
  const shrank = h != null && lastWithHeight?.height_cm != null && h < lastWithHeight.height_cm

  const errs = {
    date: !f.date ? 'Enter the visit date.' : f.date > todayISO() ? 'The visit date cannot be in the future.' : patient && f.date < patient.dob ? 'The visit date is before the date of birth.' : '',
    height: height === 'bad' ? 'Enter a height between 20 and 230 cm.' : '',
    weight: weight === 'bad' ? 'Enter a weight between 0.3 and 300 kg.' : '',
    bp: validBp(f.bp) ? '' : 'Write blood pressure as systolic/diastolic, e.g. 102/68.',
    review: f.review && f.review <= f.date ? 'The review date must be after the visit.' : '',
    meds: meds.some((m) => !m.name.trim()) ? 'Name every medicine, or remove the empty one.' : '',
  }
  const invalid = Object.values(errs).some(Boolean)
  const show = (k: keyof typeof errs) => (tried && errs[k] ? <span className="err">{errs[k]}</span> : null)

  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase()
    return catalog.filter((m) => !t || m.name.toLowerCase().includes(t)).slice(0, 8)
  }, [catalog, q])

  function addMed(item: RxItem) {
    setMeds((old) => [...old, { name: item.name, dose: item.dose, frequency: item.frequency, route: item.route, duration: item.duration, instructions: item.instructions }])
    setQ('')
  }
  const editMed = (i: number, k: keyof RxItem, v: string) => setMeds((old) => old.map((m, j) => (j === i ? { ...m, [k]: v } : m)))

  function applyTemplate(tid: string) {
    const t = templates.find((x) => x.id === tid)
    if (!t) return
    setMeds((old) => [...old, ...t.medicines.filter((m) => !old.some((o) => o.name === m.name))])
    if (t.advice && !f.advice.trim()) set('advice', t.advice)
  }

  async function saveTemplate() {
    if (!tplName?.trim()) return
    try {
      const existing = templates.find((t) => t.name.toLowerCase() === tplName.trim().toLowerCase())
      const saved = await store.saveTemplate({ id: existing?.id, name: tplName, medicines: meds, advice: f.advice })
      setTemplates((old) => [...old.filter((t) => t.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
      setNotice(`Template "${saved.name}" ${existing ? 'updated' : 'saved'}.`)
      setTplName(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template.')
    }
  }

  async function savePanel(name: string): Promise<string> {
    const existing = panels.find((x) => x.name.toLowerCase() === name.toLowerCase())
    const saved = await store.savePanel({ id: existing?.id, name, items: tests })
    setPanels((old) => [...old.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
    return `Panel "${saved.name}" ${existing ? 'updated' : 'saved'}.`
  }

  async function save(thenPrint: boolean) {
    setTried(true)
    if (invalid) return
    setBusy(true)
    setError('')
    const input: VisitInput = {
      patient_id: id,
      visit_date: f.date,
      height_cm: h,
      weight_kg: w,
      bp: f.bp.replace(/\s+/g, ''),
      complaint: f.complaint.trim(),
      history: f.history.trim(),
      assessment: f.assessment.trim(),
      plan: f.plan.trim(),
      print_plan: printPlan,
      investigations: tests,
      tanner,
      advice: f.advice.trim(),
      review_date: f.review || null,
      medicines: meds.map((m) => ({ name: m.name.trim(), dose: m.dose.trim(), frequency: m.frequency.trim(), route: m.route.trim(), duration: m.duration.trim(), instructions: m.instructions.trim() })),
    }
    try {
      const saved = await store.saveVisit(input, vid)
      dropDraft(draftKey)
      baseline.current = current
      nav(thenPrint ? `/patients/${id}/visits/${saved.id}/print` : `/patients/${id}`, { replace: !vid })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the visit.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!vid) return
    try {
      await store.deleteVisit(vid)
      dropDraft(draftKey)
      nav(`/patients/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the visit.')
    }
  }

  if (patient === undefined) return <main className="page muted">Loading…</main>
  if (patient === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const b = bmi(h, w)
  // Live SDS against the published reference for the child's age on the visit date.
  const ageDays = ageInDays(patient.dob, f.date)
  const z = visitSds({ visit_date: f.date, height_cm: h, weight_kg: w }, patient.dob, patient.sex)
  const heightRef = ageDays == null ? null : referenceAt(patient.sex, 'height', ageDays)
  const sdsText = (n: number | null) => (n == null ? '—' : `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)}`)
  const sameDay = visits.find((v) => v.id !== vid && v.visit_date === f.date)
  const lastStaged = earlier.find((v) => v.tanner)
  const dH = h != null && lastWithHeight?.height_cm != null ? h - lastWithHeight.height_cm : null

  return (
    <main className="page">
      <div className="row">
        <div className="grow">
          <h1 style={{ fontSize: 21 }}>
            {vid ? 'Visit' : 'New visit'} · <Link to={`/patients/${id}`}>{patient.name}</Link>
          </h1>
          <div className="muted">
            {formatAge(patient.dob, f.date)} at this visit · {patient.sex === 'M' ? 'Male' : 'Female'} · <span className="mono">MRN {patient.mrn}</span>
            {patient.allergies && <> · <strong style={{ color: 'var(--warn-fg)' }}>Allergy: {patient.allergies}</strong></>}
          </div>
        </div>
        <label className="field" style={{ flex: '0 1 190px' }}>
          Visit date
          <input type="date" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} />
          {show('date')}
        </label>
      </div>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="pill ok" role="status">{notice}</div>}
      {restoredAt && (
        <div className="note row" role="status">
          <span className="grow">Unsaved changes from {new Date(restoredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} were brought back. They are not saved yet.</span>
          <button type="button" className="btn small" onClick={discardDraft}>Discard them</button>
        </div>
      )}
      {!vid && sameDay && (
        <div className="note" role="status">
          A visit is already recorded for {formatDate(sameDay.visit_date)}. <Link to={`/patients/${id}/visits/${sameDay.id}`}>Open that visit</Link> instead of adding a second one.
        </div>
      )}
      {vid && f.date < todayISO() && <div className="note" role="status">You are editing a past visit, dated {formatDate(f.date)}. Changes replace what was recorded then.</div>}

      <form
        className="cols"
        noValidate
        onSubmit={(e: FormEvent) => { e.preventDefault(); void save(false) }}
        // Enter in a text box must never save the visit by accident; only the buttons do.
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault() }}
      >
        <div className="main">
          <section className="card pad">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 className="grow">Measurements</h2>
              {last && <span className="muted" style={{ fontSize: 13 }}>Last visit {formatDate(last.visit_date)}</span>}
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <label className="field">
                Height (cm)
                <input className="num" inputMode="decimal" value={f.height} onChange={(e) => set('height', e.target.value)} />
                {show('height')}
              </label>
              <label className="field">
                Weight (kg)
                <input className="num" inputMode="decimal" value={f.weight} onChange={(e) => set('weight', e.target.value)} />
                {show('weight')}
              </label>
              <label className="field">
                BP (mmHg)
                <input className="num" inputMode="numeric" placeholder="102/68" value={f.bp} onChange={(e) => set('bp', e.target.value)} />
                {show('bp')}
              </label>
            </div>
            <div className="calc">
              <div>
                <div className="k">Height SDS · calculated</div>
                <div className="v">{sdsText(z.height)}</div>
                <div className="k">{h == null ? 'enter a height' : heightRef ? `${REFS[heightRef.ref].short}${heightRef.posture === 'length' ? ' · length, lying down' : ''}` : ageDays == null ? 'check the visit date' : noReferenceReason('height', ageDays)}</div>
              </div>
              <div>
                <div className="k">BMI · calculated</div>
                <div className="v">{b ?? '—'}</div>
                <div className="k">kg/m²{z.bmi == null ? '' : ` · SDS ${sdsText(z.bmi)}`}</div>
              </div>
              <div>
                <div className="k">Height velocity · calculated</div>
                <div className="v">{velocity ? velocity.cmPerYear.toFixed(1) : '—'}</div>
                <div className="k">{velocity ? `cm/yr since ${formatDate(velocity.fromDate)} (${velocity.fromHeight} cm)` : 'needs a height at least 3 months earlier'}</div>
              </div>
              <div>
                <div className="k">Since last height</div>
                <div className="v">{dH == null ? '—' : `${dH >= 0 ? '+' : '−'}${Math.abs(dH).toFixed(1)}`}</div>
                <div className="k">{lastWithHeight ? `cm · was ${lastWithHeight.height_cm} on ${formatDate(lastWithHeight.visit_date)}` : 'no earlier height'}</div>
              </div>
            </div>
            {shrank && <div className="note" style={{ marginTop: 12 }}>This height is lower than the {lastWithHeight!.height_cm} cm recorded on {formatDate(lastWithHeight!.visit_date)}. Please re-check the measurement.</div>}
          </section>

          <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row">
              <div className="grow">
                <h2>Puberty</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  {tanner ? <span className="mono" style={{ color: 'var(--ink)' }}>{tannerSummary(tanner, patient.sex)}</span> : 'Not staged at this visit'}
                  {lastStaged && <> · last {tannerSummary(lastStaged.tanner, patient.sex)} on {formatDate(lastStaged.visit_date)}</>}
                </div>
              </div>
              {!tanner && lastStaged && (
                <button type="button" className="btn small" onClick={() => setTanner({ ...lastStaged.tanner!, signs: [...lastStaged.tanner!.signs] })}>Same as last</button>
              )}
              <button type="button" className="btn small outline" aria-expanded={staging} onClick={() => setStaging(!staging)}>
                {staging ? 'Hide staging' : tanner ? 'Change staging' : 'Stage now'}
              </button>
            </div>
            {staging && <TannerPicker value={tanner} onChange={setTanner} sex={patient.sex} ageYears={decimalAge(patient.dob, f.date)} />}
          </section>

          <section className="card pad">
            <h2 style={{ marginBottom: 12 }}>Clinical notes</h2>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              <label className="field">
                Chief complaint
                <textarea rows={3} value={f.complaint} onChange={(e) => set('complaint', e.target.value)} />
              </label>
              <label className="field">
                History and examination
                <textarea rows={3} value={f.history} onChange={(e) => set('history', e.target.value)} />
              </label>
              <label className="field">
                Assessment / diagnosis
                <textarea rows={3} value={f.assessment} onChange={(e) => set('assessment', e.target.value)} />
                <span className="hint">Printed on the prescription as the diagnosis.</span>
              </label>
              <div className="field">
                <label htmlFor="plan">Plan</label>
                <textarea id="plan" rows={3} value={f.plan} onChange={(e) => set('plan', e.target.value)} />
                <button type="button" className="switch compact" role="switch" aria-checked={printPlan} onClick={() => setPrintPlan(!printPlan)}>
                  <span className="track" />
                  {printPlan ? 'Printed on the prescription' : 'For your record only, not printed'}
                </button>
              </div>
            </div>
          </section>

          <InvestigationPicker catalog={testCatalog} panels={panels} value={tests} onChange={setTests} onSavePanel={savePanel} />
        </div>

        <div className="side">
          <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row">
              <h2 className="grow">Prescription</h2>
              {last && last.medicines.length > 0 && (
                <button type="button" className="btn small" onClick={() => setMeds((old) => [...old, ...last.medicines.filter((m) => !old.some((o) => o.name === m.name)).map((m) => ({ ...m }))])}>
                  Copy from {formatDate(last.visit_date)}
                </button>
              )}
              {templates.length > 0 && (
                <select aria-label="Use a template" className="btn small" value="" onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">Use template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {meds.map((m, i) => {
              const perKg = dosePerKg(m.dose, w)
              return (
                <div className="med" key={i}>
                  <div className="med-head">
                    <span className="med-no" aria-hidden="true">{i + 1}</span>
                    <input aria-label={`Medicine ${i + 1} name`} value={m.name} onChange={(e) => editMed(i, 'name', e.target.value)} />
                    <button type="button" className="icon-btn" aria-label={`Remove medicine ${i + 1}`} onClick={() => setMeds((old) => old.filter((_, j) => j !== i))}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                    </button>
                  </div>
                  <div className="med-grid">
                    {RX_FIELDS.map((fd) => (
                      <label className="field" key={fd.key} style={fd.wide ? { gridColumn: '1 / -1' } : undefined}>
                        {fd.label}
                        <input value={m[fd.key]} onChange={(e) => editMed(i, fd.key, e.target.value)} />
                        {fd.key === 'dose' && perKg && <span className="hint mono">= {perKg} per dose at {w} kg</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            {tried && errs.meds && <div className="note">{errs.meds}</div>}

            <div className="field">
              <label htmlFor="med-add">Add a medicine</label>
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <input
                  id="med-add"
                  placeholder="Type a name, or pick from your list below"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (q.trim()) addMed(suggestions.length === 1 ? suggestions[0] : { ...EMPTY_RX, name: q.trim() })
                    }
                  }}
                />
                <button type="button" className="btn" disabled={!q.trim()} onClick={() => addMed({ ...EMPTY_RX, name: q.trim() })}>
                  Add
                </button>
              </div>
            </div>
            <div className="suggest">
              {suggestions.map((s) => (
                <button type="button" key={s.id} onClick={() => addMed(s)}>+ {s.name}</button>
              ))}
              {catalog.length === 0 && <span className="muted">Your medicine list is empty. Build it under <Link to="/settings">Settings</Link>.</span>}
            </div>

            <label className="field">
              Advice
              <textarea rows={3} value={f.advice} onChange={(e) => set('advice', e.target.value)} />
            </label>

            <div className="field">
              <label htmlFor="review">Review date</label>
              <div className="row" style={{ gap: 8 }}>
                {[1, 3, 6].map((n) => (
                  <button type="button" key={n} className="btn small" onClick={() => set('review', addMonths(f.date, n) ?? '')}>
                    {n} {n === 1 ? 'month' : 'months'}
                  </button>
                ))}
                <input id="review" type="date" value={f.review} min={f.date} onChange={(e) => set('review', e.target.value)} style={{ flex: '1 1 160px', width: 'auto' }} />
              </div>
              {show('review')}
            </div>

            {tplName === null ? (
              meds.length > 0 && (
                <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => { setTplName(''); setNotice('') }}>
                  Save these medicines as a template
                </button>
              )
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Template name" placeholder="Template name" value={tplName} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void saveTemplate() } }} style={{ flex: '1 1 160px', minHeight: 40, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }} />
                <button type="button" className="btn small primary" disabled={!tplName.trim()} onClick={saveTemplate}>Save template</button>
                <button type="button" className="btn small" onClick={() => setTplName(null)}>Cancel</button>
              </div>
            )}
          </section>

          <Results patientId={id} catalog={testCatalog} mode="latest" />

        </div>

        <div className="actions">
          {tried && invalid && <div className="alert">Some entries need correcting before this visit can be saved.</div>}
          <div className="row">
            <button type="submit" className="btn outline" style={{ flex: '1 1 120px' }} disabled={busy}>
              {busy ? 'Saving…' : 'Save visit'}
            </button>
            <button type="button" className="btn primary" style={{ flex: '2 1 180px' }} disabled={busy} onClick={() => void save(true)}>
              Save and open prescription
            </button>
          </div>
          {vid && (
            <div className="row end">
              {confirming ? (
                <>
                  <span>Delete this visit and its prescription?</span>
                  <button type="button" className="btn small" onClick={() => setConfirming(false)}>Keep</button>
                  <button type="button" className="btn danger small" onClick={remove}>Delete visit</button>
                </>
              ) : (
                <button type="button" className="btn danger small" onClick={() => setConfirming(true)}>Delete visit</button>
              )}
            </div>
          )}
        </div>
      </form>
    </main>
  )
}
