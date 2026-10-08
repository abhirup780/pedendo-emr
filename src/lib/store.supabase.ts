import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { Clinic, Condition, Medicine, Patient, PatientInput, RxItem, RxTemplate, SessionUser, Visit, VisitInput } from './types'
import type { ListOptions, Store } from './store'

const VISIT_COLS = 'id, patient_id, visit_date, height_cm, weight_kg, bp, complaint, history, assessment, plan, advice, review_date, medicines, created_at'
const MED_COLS = 'id, name, dose, frequency, route, duration, instructions'
const CLINIC_COLS = 'doctor_name, qualifications, reg_no, clinic_name, address, phone, email'
const BLANK_CLINIC: Clinic = { doctor_name: '', qualifications: '', reg_no: '', clinic_name: '', address: '', phone: '', email: '' }

function toVisit(r: Visit): Visit {
  return {
    ...r,
    height_cm: r.height_cm == null ? null : Number(r.height_cm),
    weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
    medicines: Array.isArray(r.medicines) ? r.medicines : [],
  }
}

const PATIENT_COLS =
  'id, mrn, name, dob, sex, phone, guardian_name, guardian_relation, address, allergies, notes, father_height_cm, mother_height_cm, created_at'

type Row = Omit<Patient, 'condition_ids'> & { tags: { condition_id: string }[] | null }

function toPatient(r: Row): Patient {
  const { tags, ...rest } = r
  return {
    ...rest,
    father_height_cm: rest.father_height_cm == null ? null : Number(rest.father_height_cm),
    mother_height_cm: rest.mother_height_cm == null ? null : Number(rest.mother_height_cm),
    condition_ids: (tags ?? []).map((t) => t.condition_id),
  }
}

function toUser(u: User | null | undefined): SessionUser | null {
  if (!u) return null
  const meta = u.user_metadata as { full_name?: string; name?: string } | undefined
  return { email: u.email ?? '', name: meta?.full_name ?? meta?.name ?? u.email ?? 'Doctor' }
}

/** Quote a search term so commas, brackets and quotes in it cannot alter the filter. */
function pattern(q: string): string {
  return '"%' + q.replace(/[%*]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '%"'
}

export function createSupabaseStore(url: string, key: string): Store {
  const sb = createClient(url, key)

  function fail(error: { message: string } | null): void {
    if (error) throw new Error(error.message)
  }

  return {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      return toUser(data.session?.user)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      fail(error)
    },
    async signOut() {
      const { error } = await sb.auth.signOut()
      fail(error)
    },

    async listConditions() {
      const { data, error } = await sb.from('conditions').select('id, name, color').order('name')
      fail(error)
      return (data ?? []) as Condition[]
    },
    async conditionCounts() {
      const { data, error } = await sb.from('condition_counts').select('condition_id, n')
      fail(error)
      const out: Record<string, number> = {}
      for (const r of (data ?? []) as { condition_id: string; n: number }[]) out[r.condition_id] = r.n
      return out
    },
    async saveCondition(c) {
      const body = { name: c.name.trim(), color: c.color }
      const q = c.id
        ? sb.from('conditions').update(body).eq('id', c.id)
        : sb.from('conditions').insert(body)
      const { data, error } = await q.select('id, name, color').single()
      fail(error)
      return data as Condition
    },
    async deleteCondition(id) {
      const { error } = await sb.from('conditions').delete().eq('id', id)
      fail(error)
    },

    async listPatients(opts: ListOptions = {}) {
      const limit = opts.limit ?? 200
      const filtered = !!opts.conditionId
      // "tags" returns every tag on the patient; "f" exists only to filter by one tag.
      const cols = `${PATIENT_COLS}, tags:patient_conditions(condition_id)` + (filtered ? ', f:patient_conditions!inner(condition_id)' : '')
      let q = sb.from('patients').select(cols, { count: 'exact' })
      if (filtered) q = q.eq('f.condition_id', opts.conditionId as string)
      const term = (opts.q ?? '').trim()
      if (term) {
        const parts = [`name.ilike.${pattern(term)}`, `phone.ilike.${pattern(term)}`]
        if (/^\d{1,9}$/.test(term)) parts.push(`mrn.eq.${term}`)
        q = q.or(parts.join(','))
      }
      const { data, error, count } = await q.order('created_at', { ascending: false }).limit(limit)
      fail(error)
      const rows = ((data ?? []) as unknown as Row[]).map(toPatient)
      return { rows, total: count ?? rows.length }
    },
    async getPatient(id) {
      const { data, error } = await sb
        .from('patients')
        .select(`${PATIENT_COLS}, tags:patient_conditions(condition_id)`)
        .eq('id', id)
        .maybeSingle()
      fail(error)
      return data ? toPatient(data as unknown as Row) : null
    },
    async savePatient(input: PatientInput, id?: string) {
      const { condition_ids, ...fields } = input
      const q = id ? sb.from('patients').update(fields).eq('id', id) : sb.from('patients').insert(fields)
      const { data, error } = await q.select('id').single()
      fail(error)
      const pid = (data as { id: string }).id
      const rpc = await sb.rpc('set_patient_conditions', { p_patient: pid, p_conditions: condition_ids })
      fail(rpc.error)
      const saved = await this.getPatient(pid)
      if (!saved) throw new Error('Saved, but the record could not be read back.')
      return saved
    },
    async deletePatient(id) {
      const { error } = await sb.from('patients').delete().eq('id', id)
      fail(error)
    },

    async listVisits(patientId) {
      const { data, error } = await sb
        .from('visits')
        .select(VISIT_COLS)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
      fail(error)
      return ((data ?? []) as unknown as Visit[]).map(toVisit)
    },
    async getVisit(id) {
      const { data, error } = await sb.from('visits').select(VISIT_COLS).eq('id', id).maybeSingle()
      fail(error)
      return data ? toVisit(data as unknown as Visit) : null
    },
    async saveVisit(input: VisitInput, id?: string) {
      const q = id ? sb.from('visits').update(input).eq('id', id) : sb.from('visits').insert(input)
      const { data, error } = await q.select(VISIT_COLS).single()
      fail(error)
      return toVisit(data as unknown as Visit)
    },
    async deleteVisit(id) {
      const { error } = await sb.from('visits').delete().eq('id', id)
      fail(error)
    },

    async listMedicines() {
      const { data, error } = await sb.from('medicines').select(MED_COLS).order('name')
      fail(error)
      return (data ?? []) as Medicine[]
    },
    async saveMedicine(m: RxItem & { id?: string }) {
      const { id, ...body } = m
      body.name = body.name.trim()
      const q = id ? sb.from('medicines').update(body).eq('id', id) : sb.from('medicines').insert(body)
      const { data, error } = await q.select(MED_COLS).single()
      fail(error)
      return data as Medicine
    },
    async deleteMedicine(id) {
      const { error } = await sb.from('medicines').delete().eq('id', id)
      fail(error)
    },

    async listTemplates() {
      const { data, error } = await sb.from('rx_templates').select('id, name, medicines, advice').order('name')
      fail(error)
      return (data ?? []) as RxTemplate[]
    },
    async saveTemplate(t) {
      const { id, ...body } = t
      body.name = body.name.trim()
      const q = id ? sb.from('rx_templates').update(body).eq('id', id) : sb.from('rx_templates').insert(body)
      const { data, error } = await q.select('id, name, medicines, advice').single()
      fail(error)
      return data as RxTemplate
    },
    async deleteTemplate(id) {
      const { error } = await sb.from('rx_templates').delete().eq('id', id)
      fail(error)
    },

    async getClinic() {
      const { data, error } = await sb.from('clinic_settings').select(CLINIC_COLS).maybeSingle()
      fail(error)
      return (data as Clinic | null) ?? BLANK_CLINIC
    },
    async saveClinic(c: Clinic) {
      // One row per account: the owner is filled in by the database, so a second save updates it.
      const { data, error } = await sb.from('clinic_settings').upsert(c, { onConflict: 'owner_id' }).select(CLINIC_COLS).single()
      fail(error)
      return data as Clinic
    },
  }
}
