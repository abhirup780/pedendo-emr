import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from '../src/lib/backup'
import { normalize, PRESETS, STANDARD } from '../src/lib/printlayout'
import type { Store } from '../src/lib/store'
import type { PatientInput, VisitInput } from '../src/lib/types'

/**
 * What every Store must do, whichever one it is. The demo store and the Supabase store both
 * run this same list, so the demo cannot quietly behave differently from the real database.
 * `other`, when given, is a second signed-in account used to prove the two cannot see or
 * change each other's records.
 */
export function storeContract(name: string, make: () => Promise<{ store: Store; other?: Store }>) {
  const TODAY = '2026-10-08'
  const patient = (o: Partial<PatientInput> = {}): PatientInput => ({ name: 'Aarav Sharma', dob: '2017-05-12', sex: 'M', phone: '9876543210', guardian_name: 'Mr. Rohit Sharma', guardian_relation: 'Father', address: '', allergies: '', notes: '', father_height_cm: 168, mother_height_cm: 155.5, condition_ids: [], ...o })
  const visit = (patient_id: string, o: Partial<VisitInput> = {}): VisitInput => ({ patient_id, visit_date: '2026-07-14', height_cm: 118.7, weight_kg: 23.1, bp: '', complaint: '', history: '', assessment: '', plan: '', print_plan: true, advice: '', review_date: null, medicines: [], investigations: [], tanner: null, ...o })
  const rx = { name: 'Somatropin 5 mg', dose: '0.7 mg', frequency: 'Once daily', route: 'Subcutaneous', duration: 'Continue', instructions: 'Rotate sites.' }

  async function wipe(s: Store) {
    const d = await s.dump()
    for (const p of d.patients) await s.deletePatient(p.id)
    for (const x of await s.listConditions()) await s.deleteCondition(x.id)
    for (const x of await s.listMedicines()) await s.deleteMedicine(x.id)
    for (const x of await s.listTemplates()) await s.deleteTemplate(x.id)
    for (const x of await s.listInvestigations()) await s.deleteInvestigation(x.id)
    for (const x of await s.listPanels()) await s.deletePanel(x.id)
    for (const x of await s.listPrintLayouts()) await s.deletePrintLayout(x.id)
  }

  describe(`${name}: store contract`, () => {
    it('condition tags: add, rename, count, reject duplicates, delete', async () => {
      const { store: s } = await make()
      await wipe(s)
      const ghd = await s.saveCondition({ name: 'GH deficiency', color: 'teal' })
      const hypo = await s.saveCondition({ name: 'Hypothyroidism', color: 'blue' })
      await expect(s.saveCondition({ name: 'GH deficiency', color: 'pink' })).rejects.toThrow()
      await s.saveCondition({ id: hypo.id, name: 'Hypothyroid', color: 'pink' })
      expect((await s.listConditions()).map((c) => `${c.name}:${c.color}`)).toEqual(['GH deficiency:teal', 'Hypothyroid:pink'])
      const p = await s.savePatient(patient({ condition_ids: [ghd.id, hypo.id] }))
      expect(await s.conditionCounts()).toEqual({ [ghd.id]: 1, [hypo.id]: 1 })
      await s.deleteCondition(hypo.id)
      expect((await s.getPatient(p.id))!.condition_ids).toEqual([ghd.id])
    })

    it('patients: a newborn can be saved with sex not yet assigned, and assigned later', async () => {
      const { store: s } = await make()
      await wipe(s)
      const baby = await s.savePatient(patient({ name: 'Baby of Mita', dob: '2026-09-30', sex: 'U' }))
      expect(baby.sex).toBe('U')
      expect((await s.getPatient(baby.id))!.sex).toBe('U')
      const later = await s.savePatient(patient({ name: 'Baby of Mita', dob: '2026-09-30', sex: 'F' }), baby.id)
      expect(later.sex).toBe('F')
      expect(later.mrn).toBe(baby.mrn)
    })

    it('patients: MRNs, edit, search, tag filter, limit, sort, delete', async () => {
      const { store: s } = await make()
      await wipe(s)
      const tag = await s.saveCondition({ name: 'Turner syndrome', color: 'green' })
      const a = await s.savePatient(patient())
      const b = await s.savePatient(patient({ name: 'Ananya Iyer', sex: 'F', phone: '9988776655', condition_ids: [tag.id], father_height_cm: null, mother_height_cm: null }))
      const c = await s.savePatient(patient({ name: "Riya O'Sen (test), x", sex: 'F', phone: '' }))
      expect(b.mrn).toBe(a.mrn + 1)
      expect(c.mrn).toBe(a.mrn + 2)
      expect(a.mother_height_cm).toBe(155.5)
      expect(a.visit_count).toBe(0)
      expect(a.last_visit_on).toBeNull()

      const edited = await s.savePatient(patient({ name: 'Aarav S. Sharma', condition_ids: [tag.id] }), a.id)
      expect(edited.mrn).toBe(a.mrn)
      expect(edited.condition_ids).toEqual([tag.id])

      const names = async (o: Parameters<Store['listPatients']>[0]) => (await s.listPatients(o)).rows.map((p) => p.name)
      expect((await s.listPatients()).total).toBe(3)
      expect(await names({ q: 'ananya' })).toEqual(['Ananya Iyer'])
      expect(await names({ q: '99887' })).toEqual(['Ananya Iyer'])
      expect(await names({ q: String(c.mrn) })).toEqual(["Riya O'Sen (test), x"])
      expect(await names({ q: "o'sen (test), x" })).toEqual(["Riya O'Sen (test), x"])
      expect(await names({ q: 'a"b\\c,d)' })).toEqual([])
      expect((await names({ conditionId: tag.id })).sort()).toEqual(['Aarav S. Sharma', 'Ananya Iyer'])
      expect(await names({ q: 'iyer', conditionId: tag.id })).toEqual(['Ananya Iyer'])
      expect(await names({ sort: 'name' })).toEqual(['Aarav S. Sharma', 'Ananya Iyer', "Riya O'Sen (test), x"])
      const limited = await s.listPatients({ limit: 2 })
      expect(limited.rows).toHaveLength(2)
      expect(limited.total).toBe(3)
      // The tag filter must not hide a patient's other tags.
      const extra = await s.saveCondition({ name: 'Hypothyroidism', color: 'blue' })
      await s.savePatient(patient({ name: 'Ananya Iyer', sex: 'F', condition_ids: [tag.id, extra.id] }), b.id)
      expect((await s.listPatients({ conditionId: extra.id })).rows[0].condition_ids.sort()).toEqual([tag.id, extra.id].sort())

      await s.deletePatient(a.id)
      expect(await s.getPatient(a.id)).toBeNull()
      expect((await s.listPatients()).total).toBe(2)
    })

    it('visits: save, edit, order, and the summary kept on the patient', async () => {
      const { store: s } = await make()
      await wipe(s)
      const p = await s.savePatient(patient())
      const v1 = await s.saveVisit(visit(p.id, { visit_date: '2026-04-08', review_date: '2026-07-08' }))
      const v2 = await s.saveVisit(visit(p.id, { visit_date: '2026-07-14', height_cm: 121, weight_kg: 24.25, bp: '102/68', review_date: '2026-10-12', print_plan: false, medicines: [rx, { ...rx, name: 'Cholecalciferol' }], investigations: ['IGF-1', 'TSH'], tanner: { g: 1, b: null, p: 1, testis_r: 3, testis_l: 3, signs: ['Acne'] } }))
      expect(v2.weight_kg).toBe(24.25)
      expect(v2.medicines.map((m) => m.name)).toEqual(['Somatropin 5 mg', 'Cholecalciferol'])
      expect(v2.investigations).toEqual(['IGF-1', 'TSH'])
      expect(v2.tanner).toEqual({ g: 1, b: null, p: 1, testis_r: 3, testis_l: 3, signs: ['Acne'] })
      expect(v2.print_plan).toBe(false)
      expect((await s.listVisits(p.id)).map((v) => v.id)).toEqual([v2.id, v1.id])

      let seen = (await s.getPatient(p.id))!
      expect([seen.visit_count, seen.last_visit_on, seen.next_review_on]).toEqual([2, '2026-07-14', '2026-10-12'])
      expect(await s.followupCounts(TODAY)).toEqual({ overdue: 0, week: 1 })
      expect((await s.listPatients({ due: 'week', today: TODAY })).total).toBe(1)
      expect((await s.listPatients({ due: 'overdue', today: TODAY })).total).toBe(0)

      const edited = await s.saveVisit(visit(p.id, { visit_date: '2026-07-14', height_cm: null, review_date: null, tanner: null }), v2.id)
      expect([edited.id, edited.height_cm, edited.tanner, edited.review_date, edited.print_plan]).toEqual([v2.id, null, null, null, true])
      seen = (await s.getPatient(p.id))!
      expect(seen.next_review_on).toBeNull()

      await s.deleteVisit(v2.id)
      seen = (await s.getPatient(p.id))!
      expect([seen.visit_count, seen.last_visit_on, seen.next_review_on]).toEqual([1, '2026-04-08', '2026-07-08'])
      expect(await s.followupCounts(TODAY)).toEqual({ overdue: 1, week: 0 })
      expect((await s.listPatients({ due: 'overdue', today: TODAY })).rows[0].id).toBe(p.id)

      await s.deletePatient(p.id)
      expect(await s.getVisit(v1.id)).toBeNull()
    })

    it('"last seen" sorting puts never-seen patients last', async () => {
      const { store: s } = await make()
      await wipe(s)
      const never = await s.savePatient(patient({ name: 'Never Seen' }))
      const old = await s.savePatient(patient({ name: 'Seen Long Ago' }))
      const recent = await s.savePatient(patient({ name: 'Seen Recently' }))
      await s.saveVisit(visit(old.id, { visit_date: '2025-01-10' }))
      await s.saveVisit(visit(recent.id, { visit_date: '2026-09-01' }))
      expect((await s.listPatients({ sort: 'recent' })).rows.map((p) => p.id)).toEqual([recent.id, old.id, never.id])
    })

    it('results, medicines, templates, investigations, panels and letterhead', async () => {
      const { store: s } = await make()
      await wipe(s)
      const p = await s.savePatient(patient())
      await s.saveResult({ patient_id: p.id, test: 'IGF-1', value: '96', unit: 'ng/mL', result_date: '2026-01-10', flag: 'low' })
      const r2 = await s.saveResult({ patient_id: p.id, test: 'IGF-1', value: '142', unit: 'ng/mL', result_date: '2026-04-08', flag: '' })
      await s.saveResult({ patient_id: p.id, test: 'Bone age', value: '7y 6m', unit: '', result_date: '2026-01-10', flag: '' })
      const rs = await s.listResults(p.id)
      expect(rs[0].id).toBe(r2.id)
      expect(rs.map((r) => r.value).sort()).toEqual(['142', '7y 6m', '96'])
      await s.deleteResult(r2.id)
      expect(await s.listResults(p.id)).toHaveLength(2)

      const m = await s.saveMedicine(rx)
      await s.saveMedicine({ ...rx, id: m.id, dose: '' })
      await expect(s.saveMedicine(rx)).rejects.toThrow()
      expect((await s.listMedicines()).map((x) => x.dose)).toEqual([''])

      const t = await s.saveTemplate({ name: 'GH follow-up', medicines: [rx], advice: 'Keep cold.' })
      expect((await s.listTemplates())[0]).toEqual({ id: t.id, name: 'GH follow-up', medicines: [rx], advice: 'Keep cold.' })

      await s.saveInvestigation({ name: 'IGF-1', category: 'Growth and GH axis', unit: 'ng/mL' })
      await s.saveInvestigation({ name: 'TSH', category: '', unit: 'mIU/L' })
      await expect(s.saveInvestigation({ name: 'IGF-1', category: 'x', unit: '' })).rejects.toThrow()
      expect((await s.listInvestigations()).map((i) => `${i.name}:${i.category}`)).toEqual(['IGF-1:Growth and GH axis', 'TSH:General'])
      const pn = await s.savePanel({ name: 'GH monitoring', items: ['IGF-1', 'TSH'] })
      await s.savePanel({ id: pn.id, name: 'GH monitoring', items: ['IGF-1', 'TSH', 'Free T4'] })
      expect((await s.listPanels())[0].items).toEqual(['IGF-1', 'TSH', 'Free T4'])

      const c = { doctor_name: 'Dr. A', qualifications: 'MD', reg_no: '1', clinic_name: 'Clinic', address: 'Addr', phone: '1', email: 'a@b.c', logo: '', signature: 'data:image/png;base64,AAAA' }
      await s.saveClinic(c)
      await s.saveClinic({ ...c, doctor_name: 'Dr. A. B.' })
      expect(await s.getClinic()).toEqual({ ...c, doctor_name: 'Dr. A. B.' })
    })

    it('print layouts: save, edit, one default at a time, stored in full form', async () => {
      const { store: s } = await make()
      await wipe(s)
      const a = await s.savePrintLayout({ name: 'Clinic A pad', is_default: true, config: PRESETS[1].config })
      const b = await s.savePrintLayout({ name: 'Clinic B A5', is_default: false, config: PRESETS[2].config })
      expect(a.config).toEqual(PRESETS[1].config)
      await expect(s.savePrintLayout({ name: 'Clinic A pad', is_default: false, config: STANDARD })).rejects.toThrow()
      expect((await s.listPrintLayouts()).map((l) => `${l.name}:${l.is_default}`)).toEqual(['Clinic A pad:true', 'Clinic B A5:false'])

      // Making B the default takes the flag from A.
      await s.savePrintLayout({ ...b, is_default: true })
      expect((await s.listPrintLayouts()).map((l) => `${l.name}:${l.is_default}`)).toEqual(['Clinic A pad:false', 'Clinic B A5:true'])
      // Re-saving the default as default is allowed.
      const edited = await s.savePrintLayout({ ...b, is_default: true, name: 'Clinic B small pad', config: { ...b.config, font_pt: 11, margin: { ...b.config.margin, top: 44 } } })
      expect([edited.id, edited.name, edited.config.font_pt, edited.config.margin.top]).toEqual([b.id, 'Clinic B small pad', 11, 44])

      // A partial or out-of-range config comes back complete and within limits.
      const odd = await s.savePrintLayout({ name: 'Odd', is_default: false, config: { font_pt: 99, sections: [{ key: 'rx', show: true }] } as never })
      expect(odd.config).toEqual(normalize({ font_pt: 99, sections: [{ key: 'rx', show: true }] }))
      expect(odd.config.font_pt).toBe(16)

      await s.deletePrintLayout(a.id)
      expect((await s.listPrintLayouts()).map((l) => l.name)).toEqual(['Clinic B small pad', 'Odd'])
    })

    it('photograph records and consent', async () => {
      const { store: s } = await make()
      await wipe(s)
      const p = await s.savePatient(patient())
      expect(await s.getPhotoConsent(p.id)).toEqual({ on: null, by: '' })
      await s.setPhotoConsent(p.id, { on: '2026-10-08', by: 'Mr. Rohit Sharma' })
      await s.savePatient(patient({ name: 'Aarav S' }), p.id)
      expect(await s.getPhotoConsent(p.id)).toEqual({ on: '2026-10-08', by: 'Mr. Rohit Sharma' })
      const base = { patient_id: p.id, view: 'Hands', note: '', width: 1600, height: 1200, bytes: 300000 }
      const p1 = await s.addPhoto({ ...base, taken_on: '2026-07-14', file_id: 'drive-1' })
      const p2 = await s.addPhoto({ ...base, taken_on: '2026-10-08', file_id: 'drive-2' })
      expect((await s.listPhotos(p.id)).map((x) => x.id)).toEqual([p2.id, p1.id])
      await s.deletePhoto(p1.id)
      expect((await s.listPhotos(p.id)).map((x) => x.file_id)).toEqual(['drive-2'])
    })

    it('backup and restore bring everything back exactly', async () => {
      const { store: s } = await make()
      await wipe(s)
      const tag = await s.saveCondition({ name: 'GH deficiency', color: 'teal' })
      await s.saveMedicine(rx)
      await s.saveTemplate({ name: 'GH follow-up', medicines: [rx], advice: '' })
      await s.saveInvestigation({ name: 'IGF-1', category: 'Growth and GH axis', unit: 'ng/mL' })
      await s.savePanel({ name: 'GH monitoring', items: ['IGF-1'] })
      await s.savePrintLayout({ name: 'Clinic A pad', is_default: true, config: PRESETS[1].config })
      await s.savePrintLayout({ name: 'Two column', is_default: false, config: PRESETS[3].config })
      await s.saveClinic({ doctor_name: 'Dr. A', qualifications: 'MD', reg_no: '1', clinic_name: 'Clinic', address: 'Addr', phone: '1', email: 'a@b.c', logo: '', signature: 'data:image/png;base64,AAAA' })
      const a = await s.savePatient(patient({ condition_ids: [tag.id] }))
      const b = await s.savePatient(patient({ name: 'Riya Sen', sex: 'F' }))
      await s.saveVisit(visit(a.id, { review_date: '2026-10-12', medicines: [rx], investigations: ['IGF-1'], tanner: { g: 1, b: null, p: 1, testis_r: 3, testis_l: 3, signs: [] } }))
      await s.saveVisit(visit(b.id, { visit_date: '2026-06-20', height_cm: null }))
      await s.saveResult({ patient_id: a.id, test: 'IGF-1', value: '142', unit: 'ng/mL', result_date: '2026-04-08', flag: '' })
      await s.setPhotoConsent(a.id, { on: '2026-10-08', by: 'Mr. Rohit Sharma' })
      await s.addPhoto({ patient_id: a.id, taken_on: '2026-10-08', view: 'Hands', note: '', file_id: 'drive-9', width: 1600, height: 1200, bytes: 1 })

      const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((x, y) => x.id.localeCompare(y.id))
      const snapshot = async () => {
        const d = await buildBackup(s)
        return { clinic: d.clinic, conditions: sorted(d.conditions), medicines: sorted(d.medicines), templates: sorted(d.templates), investigations: sorted(d.investigations), panels: sorted(d.panels), print_layouts: sorted(d.print_layouts), patients: sorted(d.patients), visits: sorted(d.visits), results: sorted(d.results), photos: sorted(d.photos), consents: d.consents }
      }
      const before = await snapshot()
      const file = JSON.stringify(await buildBackup(s))

      await expect(s.restore(parseBackup(file))).rejects.toThrow(/already has patients/)
      expect(await snapshot()).toEqual(before)

      await wipe(s)
      expect((await s.dump()).patients).toHaveLength(0)
      await s.restore(parseBackup(file))
      expect(await snapshot()).toEqual(before)

      // The MRN counter has moved past the restored patients.
      const next = await s.savePatient(patient({ name: 'New After Restore' }))
      expect(next.mrn).toBeGreaterThan(Math.max(a.mrn, b.mrn))
    })

    it('a second account cannot see or change the first account’s records', async (ctx) => {
      const { store: s, other } = await make()
      if (!other) return ctx.skip()
      await wipe(s)
      await wipe(other)
      const tag = await s.saveCondition({ name: 'GH deficiency', color: 'teal' })
      const layout = await s.savePrintLayout({ name: 'Mine', is_default: true, config: STANDARD })
      const p = await s.savePatient(patient({ condition_ids: [tag.id] }))
      const v = await s.saveVisit(visit(p.id, { review_date: '2026-09-01' }))
      const r = await s.saveResult({ patient_id: p.id, test: 'TSH', value: '2.4', unit: '', result_date: '2026-04-08', flag: '' })
      const ph = await s.addPhoto({ patient_id: p.id, taken_on: '2026-10-08', view: 'Hands', note: '', file_id: 'drive-1', width: 1, height: 1, bytes: 1 })
      await s.setPhotoConsent(p.id, { on: '2026-10-08', by: 'Father' })
      await s.saveClinic({ doctor_name: 'Dr. A', qualifications: '', reg_no: '', clinic_name: '', address: '', phone: '', email: '', logo: '', signature: '' })

      expect((await other.listPatients()).total).toBe(0)
      expect(await other.getPatient(p.id)).toBeNull()
      expect(await other.getVisit(v.id)).toBeNull()
      expect(await other.listVisits(p.id)).toEqual([])
      expect(await other.listResults(p.id)).toEqual([])
      expect(await other.listPhotos(p.id)).toEqual([])
      expect(await other.listConditions()).toEqual([])
      expect(await other.listPrintLayouts()).toEqual([])
      expect(await other.conditionCounts()).toEqual({})
      expect(await other.followupCounts(TODAY)).toEqual({ overdue: 0, week: 0 })
      expect((await other.getClinic()).doctor_name).toBe('')
      expect((await other.getPhotoConsent(p.id)).on).toBeNull()
      const d = await other.dump()
      expect(d.patients.length + d.visits.length + d.results.length + d.photos.length).toBe(0)

      await expect(other.saveVisit(visit(p.id))).rejects.toThrow()
      await expect(other.saveResult({ patient_id: p.id, test: 'X', value: '1', unit: '', result_date: '2026-01-10', flag: '' })).rejects.toThrow()
      await expect(other.addPhoto({ patient_id: p.id, taken_on: '2026-10-08', view: 'Hands', note: '', file_id: 'x', width: 1, height: 1, bytes: 1 })).rejects.toThrow()
      await other.deletePatient(p.id)
      await other.deleteVisit(v.id)
      await other.deleteResult(r.id)
      await other.deletePhoto(ph.id)
      await other.deleteCondition(tag.id)
      await other.deletePrintLayout(layout.id)
      // Each account may have its own default; one does not unseat the other's.
      await other.savePrintLayout({ name: 'Theirs', is_default: true, config: STANDARD })
      await other.setPhotoConsent(p.id, { on: null, by: '' })
      await other.saveClinic({ doctor_name: 'Dr. B', qualifications: '', reg_no: '', clinic_name: '', address: '', phone: '', email: '', logo: '', signature: '' })

      const mine = (await s.getPatient(p.id))!
      expect(mine.condition_ids).toEqual([tag.id])
      expect([mine.visit_count, mine.next_review_on]).toEqual([1, '2026-09-01'])
      expect(await s.listResults(p.id)).toHaveLength(1)
      expect(await s.listPhotos(p.id)).toHaveLength(1)
      expect((await s.getPhotoConsent(p.id)).on).toBe('2026-10-08')
      expect((await s.getClinic()).doctor_name).toBe('Dr. A')
      expect((await s.listPrintLayouts()).map((l) => `${l.name}:${l.is_default}`)).toEqual(['Mine:true'])
    })
  })
}
