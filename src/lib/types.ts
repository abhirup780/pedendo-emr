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

/** One line of a prescription. All fields are free text the doctor can edit. */
export interface RxItem {
  name: string
  dose: string
  frequency: string
  route: string
  duration: string
  instructions: string
}

/** An entry in the doctor's own medicine list, with default directions. */
export interface Medicine extends RxItem {
  id: string
}

export interface RxTemplate {
  id: string
  name: string
  medicines: RxItem[]
  advice: string
}

export interface Visit {
  id: string
  patient_id: string
  /** ISO date, YYYY-MM-DD. */
  visit_date: string
  height_cm: number | null
  weight_kg: number | null
  /** "102/68", or empty. */
  bp: string
  complaint: string
  history: string
  assessment: string
  plan: string
  advice: string
  review_date: string | null
  medicines: RxItem[]
  created_at: string
}

export type VisitInput = Omit<Visit, 'id' | 'created_at'>

/** Printed at the top of every prescription. */
export interface Clinic {
  doctor_name: string
  qualifications: string
  reg_no: string
  clinic_name: string
  address: string
  phone: string
  email: string
}
