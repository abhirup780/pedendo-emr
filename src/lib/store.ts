import type { Backup, Clinic, Condition, Dump, Investigation, Medicine, Panel, Patient, PatientInput, Photo, PhotoConsent, PhotoInput, Result, ResultInput, RxItem, RxTemplate, SessionUser, Visit, VisitInput } from './types'
import { createDemoStore } from './store.demo'
import { createSupabaseStore } from './store.supabase'

export type PatientSort = 'recent' | 'registered' | 'name'
/** 'overdue': review date has passed with no visit since. 'week': review due within 7 days. */
export type DueFilter = 'overdue' | 'week'

export interface ListOptions {
  q?: string
  conditionId?: string | null
  limit?: number
  sort?: PatientSort
  due?: DueFilter | null
  /** The device's date (YYYY-MM-DD); needed for `due`. */
  today?: string
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
  /** How many patients have a review overdue, and due within the next 7 days. */
  followupCounts(today: string): Promise<{ overdue: number; week: number }>
  getPatient(id: string): Promise<Patient | null>
  savePatient(input: PatientInput, id?: string): Promise<Patient>
  deletePatient(id: string): Promise<void>

  /** Newest first. */
  listVisits(patientId: string): Promise<Visit[]>
  getVisit(id: string): Promise<Visit | null>
  saveVisit(input: VisitInput, id?: string): Promise<Visit>
  deleteVisit(id: string): Promise<void>

  listMedicines(): Promise<Medicine[]>
  saveMedicine(m: RxItem & { id?: string }): Promise<Medicine>
  deleteMedicine(id: string): Promise<void>

  listTemplates(): Promise<RxTemplate[]>
  saveTemplate(t: Omit<RxTemplate, 'id'> & { id?: string }): Promise<RxTemplate>
  deleteTemplate(id: string): Promise<void>

  listInvestigations(): Promise<Investigation[]>
  saveInvestigation(i: Omit<Investigation, 'id'> & { id?: string }): Promise<Investigation>
  deleteInvestigation(id: string): Promise<void>

  listPanels(): Promise<Panel[]>
  savePanel(p: Omit<Panel, 'id'> & { id?: string }): Promise<Panel>
  deletePanel(id: string): Promise<void>

  /** Newest first. */
  listResults(patientId: string): Promise<Result[]>
  saveResult(input: ResultInput): Promise<Result>
  deleteResult(id: string): Promise<void>

  /** Newest first. */
  listPhotos(patientId: string): Promise<Photo[]>
  addPhoto(input: PhotoInput): Promise<Photo>
  deletePhoto(id: string): Promise<void>
  getPhotoConsent(patientId: string): Promise<PhotoConsent>
  setPhotoConsent(patientId: string, consent: PhotoConsent): Promise<void>

  /** Every patient, visit and result of this account, for export and backup. */
  dump(): Promise<Dump>
  /**
   * Loads a backup into this account. Refuses unless the account has no patients; the
   * account's own tags, medicine list, templates and investigation list are replaced.
   */
  restore(backup: Backup): Promise<void>

  getClinic(): Promise<Clinic>
  saveClinic(c: Clinic): Promise<Clinic>
}

export const EMPTY_CLINIC: Clinic = { doctor_name: '', qualifications: '', reg_no: '', clinic_name: '', address: '', phone: '', email: '', logo: '', signature: '' }

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Without Supabase settings the app runs in demo mode: sample data, this browser only. */
export const store: Store = url && key ? createSupabaseStore(url, key) : createDemoStore()
