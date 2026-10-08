import { describe, expect, it } from 'vitest'
import { buildSheets, exportFileName, toWorkbook } from './export'
import { sds } from './growth'
import type { ExportData, ExportOptions } from './export'
import type { Patient, Visit } from './types'

const patient = (o: Partial<Patient>): Patient => ({ id: 'p1', mrn: 10001, name: 'Aarav Sharma', dob: '2017-05-12', sex: 'M', phone: '9876543210', guardian_name: 'Mr. Rohit Sharma', guardian_relation: 'Father', address: '1 Road', allergies: '', notes: '', father_height_cm: 168, mother_height_cm: 155, created_at: '2026-01-10T05:00:00Z', condition_ids: ['ghd'], last_visit_on: null, next_review_on: null, visit_count: 0, ...o })
const visit = (o: Partial<Visit>): Visit => ({ id: 'v', patient_id: 'p1', visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2, bp: '102/68', complaint: '', history: '', assessment: 'GHD', plan: '', print_plan: true, advice: '', review_date: '2027-01-08', medicines: [], investigations: ['IGF-1', 'TSH'], tanner: null, created_at: '2026-10-08T05:00:00Z', ...o })
const gh = { name: 'Somatropin', dose: '0.7 mg', frequency: 'Once daily', route: 'Subcutaneous', duration: 'Continue', instructions: '' }

const data: ExportData = {
  conditions: [{ id: 'ghd', name: 'GH deficiency', color: 'teal' }, { id: 't1', name: 'Type 1 diabetes', color: 'orange' }],
  patients: [patient({}), patient({ id: 'p2', mrn: 10002, name: 'Riya Sen', sex: 'F', dob: '2014-07-30', condition_ids: ['t1'], father_height_cm: null, mother_height_cm: null })],
  visits: [
    visit({ id: 'v1', visit_date: '2026-07-14', height_cm: 118.7, weight_kg: 23.1, tanner: { g: 1, b: null, p: 1, testis_r: 3, testis_l: 3, signs: [] } }),
    visit({ id: 'v2', medicines: [gh, { ...gh, name: 'Cholecalciferol', dose: '1 sachet' }] }),
    visit({ id: 'v3', patient_id: 'p2', visit_date: '2026-09-25', height_cm: null, weight_kg: 41, tanner: { g: null, b: 3, p: 3, testis_r: null, testis_l: null, signs: ['Menarche'] } }),
  ],
  results: [
    { id: 'r1', patient_id: 'p1', test: 'IGF-1', value: '142', unit: 'ng/mL', result_date: '2026-04-08', flag: '', created_at: '2026-04-08T06:00:00Z' },
    { id: 'r2', patient_id: 'p1', test: 'Bone age', value: '7y 6m', unit: '', result_date: '2026-01-10', flag: '', created_at: '2026-01-10T06:00:00Z' },
    { id: 'r3', patient_id: 'p2', test: 'HbA1c', value: '8.4', unit: '%', result_date: '2026-09-25', flag: 'high', created_at: '2026-09-25T06:00:00Z' },
  ],
}
const all: ExportOptions = { sheets: ['patients', 'visits', 'growth', 'tanner', 'results', 'prescriptions'], conditionId: null, from: null, to: null, deidentify: false, today: '2026-10-08' }
const sheet = (o: Partial<ExportOptions>, name: string) => buildSheets(data, { ...all, ...o }).find((s) => s.name === name)!
const col = (s: ReturnType<typeof sheet>, header: string) => s.rows.map((r) => r[s.columns.findIndex((c) => c.header === header)])

describe('buildSheets', () => {
  it('writes one sheet per choice, in a fixed order', () => {
    expect(buildSheets(data, all).map((s) => s.name)).toEqual(['Patients', 'Visits', 'Growth', 'Tanner', 'Results', 'Prescriptions'])
    expect(buildSheets(data, { ...all, sheets: ['results', 'patients'] }).map((s) => s.name)).toEqual(['Patients', 'Results'])
  })
  it('every row has as many cells as there are columns', () => {
    for (const o of [all, { ...all, deidentify: true }]) for (const s of buildSheets(data, o)) for (const r of s.rows) expect(r.length, s.name).toBe(s.columns.length)
  })
  it('summarises each patient', () => {
    const s = sheet({}, 'Patients')
    expect(col(s, 'Name')).toEqual(['Aarav Sharma', 'Riya Sen'])
    expect(col(s, 'Condition tags')).toEqual(['GH deficiency', 'Type 1 diabetes'])
    expect(col(s, 'Age today (y)')).toEqual([9.4, 12.2])
    expect(col(s, 'Mid-parental height (cm)')).toEqual([168, null])
    expect(col(s, 'Visits')).toEqual([2, 1])
    expect((col(s, 'Last visit')[0] as Date).toISOString()).toBe('2026-10-08T00:00:00.000Z')
  })
  it('limits to a condition group', () => {
    const o = { conditionId: 't1' }
    expect(col(sheet(o, 'Patients'), 'Name')).toEqual(['Riya Sen'])
    expect(sheet(o, 'Visits').rows).toHaveLength(1)
    expect(col(sheet(o, 'Results'), 'Test')).toEqual(['HbA1c'])
  })
  it('limits visits and results to the date range but still computes velocity from earlier visits', () => {
    const o = { from: '2026-10-01', to: '2026-12-31' }
    const g = sheet(o, 'Growth')
    expect(g.rows).toHaveLength(1)
    expect(col(g, 'Height velocity (cm/yr)')).toEqual([9.8])
    expect(sheet(o, 'Results').rows).toHaveLength(0)
    expect(col(sheet(o, 'Patients'), 'Visits')).toEqual([2, 1])
  })
  it('adds SDS to the growth sheet from the reference that applies at that age', () => {
    const g = sheet({}, 'Growth')
    expect(col(g, 'Height SDS')).toEqual([sds(118.7, 'M', 'height', 3350), sds(121, 'M', 'height', 3436), null])
    expect(col(g, 'Weight SDS')).toEqual([sds(23.1, 'M', 'weight', 3350), sds(24.2, 'M', 'weight', 3436), sds(41, 'F', 'weight', 4440)])
    expect(col(g, 'BMI SDS')[2]).toBeNull()
    expect(col(g, 'Height SDS').slice(0, 2).every((z) => typeof z === 'number')).toBe(true)
    expect(col(g, 'SDS reference')).toEqual(['IAP 2015', 'IAP 2015', 'IAP 2015'])
  })
  it('gives growth, Tanner and prescription rows', () => {
    expect(col(sheet({}, 'Growth'), 'BMI')).toEqual([16.4, 16.5, null])
    const t = sheet({}, 'Tanner')
    expect(t.rows).toHaveLength(2)
    expect(col(t, 'Genital (G)')).toEqual([1, null])
    expect(col(t, 'Breast (B)')).toEqual([null, 3])
    expect(col(t, 'Other signs')).toEqual(['', 'Menarche'])
    const rx = sheet({}, 'Prescriptions')
    expect(col(rx, 'Medicine')).toEqual(['Somatropin', 'Cholecalciferol'])
    expect(col(rx, 'Dose per kg')).toEqual(['0.029 mg/kg', ''])
  })
  it('keeps numeric results as numbers and others as text', () => {
    expect(col(sheet({}, 'Results'), 'Result')).toEqual(['7y 6m', 142, 8.4])
    expect(col(sheet({}, 'Results'), 'Flag')).toEqual(['', '', 'High'])
  })
  it('de-identifies: study IDs instead of names, no DOB, guardian, phone or address', () => {
    const sheets = buildSheets(data, { ...all, deidentify: true })
    const text = JSON.stringify(sheets)
    for (const secret of ['Aarav', 'Riya', 'Sharma', '9876543210', '1 Road', '10001', '2017-05-12']) expect(text).not.toContain(secret)
    const headers = sheets.flatMap((s) => s.columns.map((c) => c.header))
    for (const h of ['Name', 'MRN', 'Date of birth', 'Guardian', 'Phone', 'Address']) expect(headers).not.toContain(h)
    expect(col(sheets[0], 'Study ID')).toEqual(['P-0001', 'P-0002'])
    expect(col(sheets[1], 'Study ID')).toEqual(['P-0001', 'P-0001', 'P-0002'])
  })
})

describe('exportFileName', () => {
  it('names the file after the group and date', () => {
    expect(exportFileName('GH deficiency', false, '2026-10-08')).toBe('gh-deficiency-2026-10-08.xlsx')
    expect(exportFileName(null, true, '2026-10-08')).toBe('all-patients-deidentified-2026-10-08.xlsx')
  })
})

describe('toWorkbook', () => {
  it('produces a real .xlsx file', async () => {
    const blob = await toWorkbook(buildSheets(data, all))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(2000)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })
})
