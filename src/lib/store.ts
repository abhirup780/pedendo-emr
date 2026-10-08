import type { Condition, Patient, PatientInput, SessionUser } from './types'
import { createDemoStore } from './store.demo'
import { createSupabaseStore } from './store.supabase'

export interface ListOptions {
  q?: string
  conditionId?: string | null
  limit?: number
}

export interface Store {
  mode: 'supabase' | 'demo'
  getUser(): Promise<SessionUser | null>
  onAuthChange(cb: (user: SessionUser | null) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>

  listConditions(): Promise<Condition[]>
  conditionCounts(): Promise<Record<string, number>>
  saveCondition(c: { id?: string; name: string; color: string }): Promise<Condition>
  deleteCondition(id: string): Promise<void>

  listPatients(opts?: ListOptions): Promise<{ rows: Patient[]; total: number }>
  getPatient(id: string): Promise<Patient | null>
  savePatient(input: PatientInput, id?: string): Promise<Patient>
  deletePatient(id: string): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Without Supabase settings the app runs in demo mode: sample data, this browser only. */
export const store: Store = url && key ? createSupabaseStore(url, key) : createDemoStore()
