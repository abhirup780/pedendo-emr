import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { Condition, Patient, PatientInput, SessionUser } from './types'
import type { ListOptions, Store } from './store'

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
  }
}
