import type { Clinic, Patient, Visit } from './types'

/** A made-up prescription for previewing and test-printing a layout. Not a real patient. */
export const SAMPLE_PATIENT: Patient = {
  id: 'sample', mrn: 10000, name: 'Sample Patient', dob: '2017-05-12', sex: 'M', phone: '', guardian_name: '', guardian_relation: '', address: '',
  allergies: 'Penicillin', notes: '', father_height_cm: null, mother_height_cm: null, created_at: '2026-01-10T05:00:00Z', condition_ids: [], last_visit_on: null, next_review_on: null, visit_count: 0,
}

export const SAMPLE_VISIT: Visit = {
  id: 'sample', patient_id: 'sample', visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2, bp: '102/68',
  complaint: 'Follow-up for short stature on growth hormone.',
  history: 'Doing well. No headache or limp. Injection sites healthy.',
  assessment: 'Isolated growth hormone deficiency on rhGH, good catch-up growth.\nVitamin D deficiency.',
  plan: 'Continue rhGH, dose adjusted for weight. Repeat IGF-1 before the next visit.',
  print_plan: true,
  advice: 'Balanced diet and regular physical activity.\nStore the cartridge in the refrigerator.',
  review_date: '2027-01-08',
  medicines: [
    { name: 'Somatropin (recombinant GH) 5 mg cartridge', dose: '0.7 mg', frequency: 'Once daily at bedtime', route: 'Subcutaneous', duration: 'Continue', instructions: 'Rotate injection sites.' },
    { name: 'Cholecalciferol 60,000 IU sachet', dose: '1 sachet', frequency: 'Once weekly', route: 'Oral', duration: '8 weeks', instructions: 'After food, with milk.' },
  ],
  investigations: ['IGF-1', 'TSH', 'Free T4', 'Bone age X-ray (left hand and wrist)'],
  tanner: { g: 1, b: null, p: 1, testis_r: 3, testis_l: 3, signs: [] },
  created_at: '2026-10-08T05:00:00Z',
}

/** Stands in for an empty letterhead so the preview shows where each line goes. */
export function sampleClinic(c: Clinic): Clinic {
  return {
    ...c,
    doctor_name: c.doctor_name || 'Dr. Doctor’s Name',
    qualifications: c.qualifications || 'Qualifications',
    reg_no: c.reg_no || '00000',
    clinic_name: c.clinic_name || 'Clinic name',
    address: c.address || 'Clinic address',
    phone: c.phone || '0000000000',
  }
}
