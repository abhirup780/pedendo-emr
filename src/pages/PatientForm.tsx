import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TagChip } from '../components/Tag'
import { formatAge, parseISODate, todayISO } from '../lib/age'
import { store } from '../lib/store'
import type { Condition, PatientInput, Sex } from '../lib/types'

const BLANK = {
  name: '',
  dob: '',
  sex: '' as Sex | '',
  phone: '',
  guardian_name: '',
  guardian_relation: 'Father',
  address: '',
  allergies: '',
  notes: '',
  father: '',
  mother: '',
  condition_ids: [] as string[],
}

function heightOrNull(s: string): number | null | 'bad' {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 100 && n <= 230 ? Math.round(n * 10) / 10 : 'bad'
}

export default function PatientForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [f, setF] = useState(BLANK)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(!!id)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    store.listConditions().then(setConditions, (e: Error) => setError(e.message))
    if (!id) return
    store.getPatient(id).then(
      (p) => {
        if (!p) {
          setError('This patient could not be found.')
        } else {
          setF({
            name: p.name,
            dob: p.dob,
            sex: p.sex,
            phone: p.phone,
            guardian_name: p.guardian_name,
            guardian_relation: p.guardian_relation || 'Father',
            address: p.address,
            allergies: p.allergies,
            notes: p.notes,
            father: p.father_height_cm == null ? '' : String(p.father_height_cm),
            mother: p.mother_height_cm == null ? '' : String(p.mother_height_cm),
            condition_ids: p.condition_ids,
          })
        }
        setLoading(false)
      },
      (e: Error) => {
        setError(e.message)
        setLoading(false)
      },
    )
  }, [id])

  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setF((old) => ({ ...old, [k]: v }))

  const dob = parseISODate(f.dob)
  const errs = {
    name: f.name.trim() ? '' : 'Enter the patient’s name.',
    dob: !dob ? 'Enter the date of birth.' : f.dob > todayISO() ? 'Date of birth cannot be in the future.' : '',
    sex: f.sex ? '' : 'Choose boy or girl.',
    father: heightOrNull(f.father) === 'bad' ? 'Enter a height between 100 and 230 cm.' : '',
    mother: heightOrNull(f.mother) === 'bad' ? 'Enter a height between 100 and 230 cm.' : '',
  }
  const invalid = Object.values(errs).some(Boolean)
  const show = (k: keyof typeof errs) => (tried && errs[k] ? <span className="err">{errs[k]}</span> : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (invalid) return
    setBusy(true)
    setError('')
    const input: PatientInput = {
      name: f.name.trim(),
      dob: f.dob,
      sex: f.sex as Sex,
      phone: f.phone.trim(),
      guardian_name: f.guardian_name.trim(),
      guardian_relation: f.guardian_name.trim() ? f.guardian_relation : '',
      address: f.address.trim(),
      allergies: f.allergies.trim(),
      notes: f.notes.trim(),
      father_height_cm: heightOrNull(f.father) as number | null,
      mother_height_cm: heightOrNull(f.mother) as number | null,
      condition_ids: f.condition_ids,
    }
    try {
      const saved = await store.savePatient(input, id)
      nav(`/patients/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setBusy(false)
    }
  }

  if (loading) return <main className="page narrow muted">Loading…</main>

  return (
    <main className="page narrow">
      <h1>{id ? 'Edit patient' : 'New patient'}</h1>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="card pad">
          <h2 style={{ marginBottom: 12 }}>Patient</h2>
          <div className="form-grid">
            <label className="field wide">
              Full name
              <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!id} autoComplete="off" />
              {show('name')}
            </label>
            <label className="field">
              Date of birth
              <input type="date" value={f.dob} max={todayISO()} onChange={(e) => set('dob', e.target.value)} />
              {show('dob') ?? (dob && !errs.dob ? <span className="hint">Age today: {formatAge(f.dob)}</span> : null)}
            </label>
            <div className="field">
              <span id="sex-label">Sex</span>
              <div className="seg" role="group" aria-labelledby="sex-label">
                <button type="button" aria-pressed={f.sex === 'M'} onClick={() => set('sex', 'M')}>
                  Boy
                </button>
                <button type="button" aria-pressed={f.sex === 'F'} onClick={() => set('sex', 'F')}>
                  Girl
                </button>
              </div>
              {show('sex')}
            </div>
            <label className="field">
              Parent or guardian
              <input value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Relation
              <select value={f.guardian_relation} onChange={(e) => set('guardian_relation', e.target.value)}>
                <option>Father</option>
                <option>Mother</option>
                <option>Guardian</option>
              </select>
            </label>
            <label className="field">
              Phone
              <input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
            </label>
            <label className="field wide">
              Address
              <input value={f.address} onChange={(e) => set('address', e.target.value)} autoComplete="off" />
            </label>
          </div>
        </section>

        <section className="card pad">
          <h2 style={{ marginBottom: 4 }}>Condition tags</h2>
          <div className="muted" style={{ marginBottom: 12 }}>
            Tap every condition that applies. Tags drive the filters, grouping and exports.
          </div>
          <div className="tags">
            {conditions.map((c) => {
              const on = f.condition_ids.includes(c.id)
              return (
                <TagChip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  pressed={on}
                  onClick={() => set('condition_ids', on ? f.condition_ids.filter((x) => x !== c.id) : [...f.condition_ids, c.id])}
                />
              )
            })}
            {conditions.length === 0 && (
              <span className="muted">
                No tags yet. Create them under <Link to="/settings">Settings</Link>, then come back.
              </span>
            )}
          </div>
        </section>

        <section className="card pad">
          <h2 style={{ marginBottom: 12 }}>Clinical background</h2>
          <div className="form-grid">
            <label className="field">
              Father's height (cm)
              <input inputMode="decimal" value={f.father} onChange={(e) => set('father', e.target.value)} />
              {show('father')}
            </label>
            <label className="field">
              Mother's height (cm)
              <input inputMode="decimal" value={f.mother} onChange={(e) => set('mother', e.target.value)} />
              {show('mother')}
            </label>
            <label className="field wide">
              Drug allergies
              <input value={f.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Leave blank if none known" />
            </label>
            <label className="field wide">
              Notes
              <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
            </label>
          </div>
        </section>

        {tried && invalid && <div className="alert">Some details are missing or need correcting above.</div>}
        <div className="row end">
          <Link to={id ? `/patients/${id}` : '/'} className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Save patient'}
          </button>
        </div>
      </form>
    </main>
  )
}
