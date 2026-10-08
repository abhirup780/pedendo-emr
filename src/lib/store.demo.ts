import type { Clinic, Condition, Investigation, Medicine, Panel, Patient, PatientInput, Result, ResultInput, RxItem, RxTemplate, SessionUser, Visit, VisitInput } from './types'
import { STARTER_INVESTIGATIONS, STARTER_PANELS } from './investigations'
import type { ListOptions, Store } from './store'
import { STARTER_MEDICINES } from './medicines'
import { STARTER_CONDITIONS } from './tags'

/**
 * Demo store: sample patients kept in this browser's localStorage.
 * Used only when Supabase settings are missing. Never for real patients.
 */
const KEY = 'pedendo-demo-v4'

interface Db {
  signedIn: boolean
  nextMrn: number
  conditions: Condition[]
  patients: Patient[]
  visits: Visit[]
  medicines: Medicine[]
  templates: RxTemplate[]
  clinic: Clinic
  investigations: Investigation[]
  panels: Panel[]
  results: Result[]
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

function seed(): Db {
  const conditions: Condition[] = STARTER_CONDITIONS.map((c) => ({ id: uid(), ...c }))
  const id = (name: string) => conditions.find((c) => c.name === name)!.id
  const sample: [string, string, 'M' | 'F', string, string, string[]][] = [
    ['Aarav Sharma', '2017-05-12', 'M', '9876543210', 'Mr. Rohit Sharma', ['GH deficiency']],
    ['Riya Sen', '2014-07-30', 'F', '9811122233', 'Mrs. Mita Sen', ['Type 1 diabetes']],
    ['Arjun Das', '2019-01-22', 'M', '9870012345', 'Mr. Subir Das', ['Hypothyroidism']],
    ['Ananya Iyer', '2016-08-19', 'F', '9988776655', 'Mrs. Lakshmi Iyer', ['Turner syndrome', 'Hypothyroidism']],
    ['Vivaan Kapoor', '2021-03-27', 'M', '9812233445', 'Mr. Anil Kapoor', ['CAH']],
    ['Meera Joshi', '2013-06-25', 'F', '9876654321', 'Mrs. Rekha Joshi', ['Type 1 diabetes', 'Hypothyroidism']],
    ['Kabir Ahmed', '2018-09-14', 'M', '9955443322', 'Mr. Imran Ahmed', ['Obesity']],
    ['Ira Nair', '2019-02-20', 'F', '9811009988', 'Mrs. Priya Nair', ['Precocious puberty']],
  ]
  const patients: Patient[] = sample.map((s, i) => ({
    id: uid(),
    mrn: 10001 + i,
    name: s[0],
    dob: s[1],
    sex: s[2],
    phone: s[3],
    guardian_name: s[4],
    guardian_relation: s[4].startsWith('Mr.') ? 'Father' : 'Mother',
    address: '',
    allergies: '',
    notes: '',
    father_height_cm: i === 0 ? 168 : null,
    mother_height_cm: i === 0 ? 155 : null,
    created_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    condition_ids: s[5].map(id),
  }))
  const medicines: Medicine[] = STARTER_MEDICINES.map((m) => ({ id: uid(), ...m }))
  const gh = (dose: string): RxItem => ({ ...STARTER_MEDICINES[0], dose })
  const aarav = patients[0].id
  const v = (date: string, h: number, w: number, dose: string, assessment: string): Visit => ({
    id: uid(),
    patient_id: aarav,
    visit_date: date,
    height_cm: h,
    weight_kg: w,
    bp: '100/66',
    complaint: 'Follow-up for short stature on growth hormone.',
    history: 'Doing well. No headache or limp. Injection sites healthy.',
    assessment,
    plan: 'Continue rhGH, dose adjusted for weight.',
    print_plan: true,
    advice: 'Balanced diet and regular physical activity.',
    review_date: null,
    medicines: [gh(dose)],
    investigations: date === '2026-07-14' ? ['IGF-1', 'TSH', 'Free T4'] : [],
    tanner: { g: 1, b: null, p: 1, testis_r: date < '2026-04-01' ? 2 : 3, testis_l: date < '2026-04-01' ? 2 : 3, signs: [] },
    created_at: `${date}T05:00:00.000Z`,
  })
  const visits: Visit[] = [
    v('2026-01-10', 114.2, 20.9, '0.6 mg', 'Isolated GH deficiency. rhGH started today.'),
    v('2026-04-08', 116.3, 22.0, '0.6 mg', 'GH deficiency on rhGH, growing well.'),
    v('2026-07-14', 118.7, 23.1, '0.7 mg', 'GH deficiency on rhGH, good catch-up growth.'),
  ]
  const templates: RxTemplate[] = [
    { id: uid(), name: 'GH therapy follow-up', medicines: [gh('')], advice: 'Store the cartridge in the refrigerator (2–8 °C). Bring the injection diary to the next visit.' },
  ]
  const clinic: Clinic = {
    doctor_name: 'Dr. Demo Doctor',
    qualifications: 'MD (Pediatrics), DM (Pediatric Endocrinology)',
    reg_no: 'REG 00000',
    clinic_name: 'Sample Children’s Clinic',
    address: '1 Example Road, Kolkata 700001',
    phone: '0000000000',
    email: 'clinic@example.com',
  }
  const investigations: Investigation[] = STARTER_INVESTIGATIONS.flatMap((g) => g.items.map(([name, unit]) => ({ id: uid(), name, category: g.category, unit })))
  const panels: Panel[] = STARTER_PANELS.map((p) => ({ id: uid(), ...p }))
  const res = (test: string, value: string, unit: string, date: string, flag: Result['flag'] = ''): Result => ({ id: uid(), patient_id: aarav, test, value, unit, result_date: date, flag, created_at: `${date}T06:00:00.000Z` })
  const results: Result[] = [
    res('IGF-1', '96', 'ng/mL', '2026-01-10', 'low'),
    res('TSH', '2.9', 'mIU/L', '2026-01-10'),
    res('Bone age X-ray (left hand and wrist)', '7y 6m', '', '2026-01-10'),
    res('IGF-1', '142', 'ng/mL', '2026-04-08'),
    res('TSH', '2.4', 'mIU/L', '2026-04-08'),
    res('Free T4', '1.2', 'ng/dL', '2026-04-08'),
    res('25-OH vitamin D', '18', 'ng/mL', '2026-07-14', 'low'),
  ]
  return { signedIn: false, nextMrn: 10001 + patients.length, conditions, patients, visits, medicines, templates, clinic, investigations, panels, results }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      db.visits = db.visits.map((v) => ({ ...v, print_plan: v.print_plan !== false }))
      return db
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return seed()
}

const DEMO_USER: SessionUser = { email: 'demo@example.com', name: 'Demo doctor' }

export function createDemoStore(): Store {
  let db = load()
  const listeners = new Set<(u: SessionUser | null) => void>()
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }
  const user = () => (db.signedIn ? DEMO_USER : null)
  const emit = () => listeners.forEach((l) => l(user()))

  return {
    mode: 'demo',
    async getUser() {
      return user()
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signIn() {
      db.signedIn = true
      save()
      emit()
    },
    async signOut() {
      db.signedIn = false
      save()
      emit()
    },

    async listConditions() {
      return [...db.conditions].sort((a, b) => a.name.localeCompare(b.name))
    },
    async conditionCounts() {
      const out: Record<string, number> = {}
      for (const p of db.patients) for (const c of p.condition_ids) out[c] = (out[c] ?? 0) + 1
      return out
    },
    async saveCondition(c) {
      const name = c.name.trim()
      if (!name) throw new Error('Give the tag a name.')
      if (db.conditions.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== c.id))
        throw new Error(`A tag called "${name}" already exists.`)
      let saved: Condition
      if (c.id) {
        saved = { id: c.id, name, color: c.color }
        db.conditions = db.conditions.map((x) => (x.id === c.id ? saved : x))
      } else {
        saved = { id: uid(), name, color: c.color }
        db.conditions.push(saved)
      }
      save()
      return saved
    },
    async deleteCondition(id) {
      db.conditions = db.conditions.filter((c) => c.id !== id)
      db.patients = db.patients.map((p) => ({ ...p, condition_ids: p.condition_ids.filter((c) => c !== id) }))
      save()
    },

    async listPatients(opts: ListOptions = {}) {
      const term = (opts.q ?? '').trim().toLowerCase()
      let rows = db.patients.filter((p) => !opts.conditionId || p.condition_ids.includes(opts.conditionId))
      if (term) rows = rows.filter((p) => p.name.toLowerCase().includes(term) || p.phone.includes(term) || String(p.mrn) === term)
      rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
      return { rows: rows.slice(0, opts.limit ?? 200), total: rows.length }
    },
    async getPatient(id) {
      return db.patients.find((p) => p.id === id) ?? null
    },
    async savePatient(input: PatientInput, id?: string) {
      let saved: Patient
      if (id) {
        const old = db.patients.find((p) => p.id === id)
        if (!old) throw new Error('Patient not found.')
        saved = { ...old, ...input }
        db.patients = db.patients.map((p) => (p.id === id ? saved : p))
      } else {
        saved = { ...input, id: uid(), mrn: db.nextMrn++, created_at: new Date().toISOString() }
        db.patients.push(saved)
      }
      save()
      return saved
    },
    async deletePatient(id) {
      db.patients = db.patients.filter((p) => p.id !== id)
      db.visits = db.visits.filter((v) => v.patient_id !== id)
      db.results = db.results.filter((r) => r.patient_id !== id)
      save()
    },

    async listVisits(patientId) {
      return db.visits
        .filter((v) => v.patient_id === patientId)
        .sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at))
    },
    async getVisit(id) {
      return db.visits.find((v) => v.id === id) ?? null
    },
    async saveVisit(input: VisitInput, id?: string) {
      let saved: Visit
      if (id) {
        const old = db.visits.find((v) => v.id === id)
        if (!old) throw new Error('Visit not found.')
        saved = { ...old, ...input }
        db.visits = db.visits.map((v) => (v.id === id ? saved : v))
      } else {
        saved = { ...input, id: uid(), created_at: new Date().toISOString() }
        db.visits.push(saved)
      }
      save()
      return saved
    },
    async deleteVisit(id) {
      db.visits = db.visits.filter((v) => v.id !== id)
      save()
    },

    async listMedicines() {
      return [...db.medicines].sort((a, b) => a.name.localeCompare(b.name))
    },
    async saveMedicine(m) {
      const name = m.name.trim()
      if (!name) throw new Error('Give the medicine a name.')
      if (db.medicines.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== m.id)) throw new Error(`"${name}" is already in your list.`)
      const saved: Medicine = { ...m, name, id: m.id ?? uid() }
      db.medicines = m.id ? db.medicines.map((x) => (x.id === m.id ? saved : x)) : [...db.medicines, saved]
      save()
      return saved
    },
    async deleteMedicine(id) {
      db.medicines = db.medicines.filter((m) => m.id !== id)
      save()
    },

    async listTemplates() {
      return [...db.templates].sort((a, b) => a.name.localeCompare(b.name))
    },
    async saveTemplate(t) {
      const name = t.name.trim()
      if (!name) throw new Error('Give the template a name.')
      if (db.templates.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== t.id)) throw new Error(`A template called "${name}" already exists.`)
      const saved: RxTemplate = { ...t, name, id: t.id ?? uid() }
      db.templates = t.id ? db.templates.map((x) => (x.id === t.id ? saved : x)) : [...db.templates, saved]
      save()
      return saved
    },
    async deleteTemplate(id) {
      db.templates = db.templates.filter((t) => t.id !== id)
      save()
    },

    async listInvestigations() {
      return [...db.investigations].sort((a, b) => a.name.localeCompare(b.name))
    },
    async saveInvestigation(i) {
      const name = i.name.trim()
      if (!name) throw new Error('Give the investigation a name.')
      if (db.investigations.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== i.id)) throw new Error(`"${name}" is already in your list.`)
      const saved: Investigation = { id: i.id ?? uid(), name, category: i.category.trim() || 'General', unit: i.unit }
      db.investigations = i.id ? db.investigations.map((x) => (x.id === i.id ? saved : x)) : [...db.investigations, saved]
      save()
      return saved
    },
    async deleteInvestigation(id) {
      db.investigations = db.investigations.filter((i) => i.id !== id)
      save()
    },

    async listPanels() {
      return [...db.panels].sort((a, b) => a.name.localeCompare(b.name))
    },
    async savePanel(p) {
      const name = p.name.trim()
      if (!name) throw new Error('Give the panel a name.')
      if (db.panels.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== p.id)) throw new Error(`A panel called "${name}" already exists.`)
      const saved: Panel = { id: p.id ?? uid(), name, items: [...p.items] }
      db.panels = p.id ? db.panels.map((x) => (x.id === p.id ? saved : x)) : [...db.panels, saved]
      save()
      return saved
    },
    async deletePanel(id) {
      db.panels = db.panels.filter((p) => p.id !== id)
      save()
    },

    async listResults(patientId) {
      return db.results
        .filter((r) => r.patient_id === patientId)
        .sort((a, b) => b.result_date.localeCompare(a.result_date) || b.created_at.localeCompare(a.created_at))
    },
    async saveResult(input: ResultInput) {
      const saved: Result = { ...input, id: uid(), created_at: new Date().toISOString() }
      db.results.push(saved)
      save()
      return saved
    },
    async deleteResult(id) {
      db.results = db.results.filter((r) => r.id !== id)
      save()
    },

    async getClinic() {
      return db.clinic
    },
    async saveClinic(c) {
      db.clinic = { ...c }
      save()
      return db.clinic
    },
  }
}
