export type Sex = 'M' | 'F'

export interface Condition {
  id: string
  name: string
  /** Key into TAG_COLORS. */
  color: string
}

export interface Patient {
  id: string
  mrn: number
  name: string
  /** ISO date, YYYY-MM-DD. */
  dob: string
  sex: Sex
  phone: string
  guardian_name: string
  guardian_relation: string
  address: string
  allergies: string
  notes: string
  father_height_cm: number | null
  mother_height_cm: number | null
  created_at: string
  condition_ids: string[]
}

/** Fields the doctor fills in; id, mrn and created_at come from the store. */
export type PatientInput = Omit<Patient, 'id' | 'mrn' | 'created_at'>

export interface SessionUser {
  email: string
  name: string
}
