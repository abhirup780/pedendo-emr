import type { Condition, Patient, PatientInput, SessionUser } from './types'
import type { ListOptions, Store } from './store'
import { STARTER_CONDITIONS } from './tags'

/**
 * Demo store: sample patients kept in this browser's localStorage.
 * Used only when Supabase settings are missing. Never for real patients.
 */
const KEY = 'pedendo-demo-v1'

interface Db {
  signedIn: boolean
  nextMrn: number
  conditions: Condition[]
  patients: Patient[]
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
  return { signedIn: false, nextMrn: 10001 + patients.length, conditions, patients }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
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
      save()
    },
  }
}
