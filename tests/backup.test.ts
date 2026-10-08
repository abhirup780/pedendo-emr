import { describe, expect, it } from 'vitest'
import { parseBackup } from '../src/lib/backup'

const good = () => ({
  app: 'pedendo-emr', format: 2, exported_at: '2026-10-08T00:00:00Z',
  clinic: { doctor_name: '', qualifications: '', reg_no: '', clinic_name: '', address: '', phone: '', email: '', logo: '', signature: '' },
  conditions: [{ id: 'c1', name: 'GHD', color: 'teal' }], medicines: [], templates: [], investigations: [], panels: [],
  patients: [{ id: 'p1', mrn: 10001, name: 'A', dob: '2017-05-12', sex: 'M', condition_ids: ['c1'] }],
  visits: [{ id: 'v1', patient_id: 'p1', visit_date: '2026-07-14', medicines: [] }],
  results: [], photos: [], consents: [],
})

describe('parseBackup', () => {
  it('accepts a good file and fills in fields added since it was made', () => {
    const b = parseBackup(JSON.stringify(good()))
    expect(b.patients[0].visit_count).toBe(0)
    expect(b.visits[0]).toMatchObject({ print_plan: true, investigations: [], tanner: null })
  })
  it('accepts the first backup format, which had no photograph records', () => {
    const old = { ...good(), format: 1 } as Record<string, unknown>
    delete old.photos
    delete old.consents
    const b = parseBackup(JSON.stringify(old))
    expect(b.photos).toEqual([])
    expect(b.consents).toEqual([])
    expect(b.print_layouts).toEqual([])
  })
  it('refuses files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/could not be read/)
    expect(() => parseBackup('{"app":"something-else"}')).toThrow(/not a backup made by this app/)
    expect(() => parseBackup(JSON.stringify({ ...good(), format: 99 }))).toThrow(/newer version/)
  })
  it('refuses incomplete or inconsistent files, saying what is wrong', () => {
    const missing = good() as Record<string, unknown>
    delete missing.visits
    expect(() => parseBackup(JSON.stringify(missing))).toThrow(/"visits" is missing/)
    const orphan = good()
    orphan.visits[0].patient_id = 'nobody'
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow(/1 visit record\(s\) belong to a patient who is not in the file/)
    const twin = good()
    twin.patients.push({ ...twin.patients[0], id: 'p2' })
    expect(() => parseBackup(JSON.stringify(twin))).toThrow(/share an MRN/)
    const tagless = good()
    tagless.patients[0].condition_ids = ['gone']
    expect(() => parseBackup(JSON.stringify(tagless))).toThrow(/condition tag that is not in the file/)
  })
})
