import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { createSupabaseStore } from '../../src/lib/store.supabase'
import { storeContract } from '../contract'

/**
 * The same contract as the demo store, run against the real Supabase store talking to a local
 * Postgres + PostgREST. Skipped unless `npm run test:db` has started those and set the
 * variables below.
 */
const API = process.env.TEST_PGRST_URL
const SECRET = process.env.TEST_JWT_SECRET ?? ''
const PSQL = process.env.TEST_PSQL ?? ''
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

if (!API) {
  describe.skip('Supabase store (run with npm run test:db)', () => {
    it('needs the local database', () => {})
  })
} else {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = (sub: string) => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'authenticated', sub, exp: Math.floor(Date.now() / 1000) + 3600 })}`
    return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`
  }
  // Supabase serves PostgREST under /rest/v1; this strips the prefix for the bare server.
  const target = new URL(API)
  const proxy = http
    .createServer((req, res) => {
      const out = http.request({ host: target.hostname, port: target.port, method: req.method, path: (req.url ?? '/').replace('/rest/v1', ''), headers: { ...req.headers, host: target.host } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      req.pipe(out)
    })
    .listen(0)
  const url = `http://localhost:${(proxy.address() as { port: number }).port}`
  afterAll(() => void proxy.close())

  const store = createSupabaseStore(url, token(A))
  const other = createSupabaseStore(url, token(B))
  const sql = (q: string) => execSync(`${PSQL} -c "${q}"`)

  storeContract('Supabase store', async () => ({ store, other }))

  describe('Supabase store: database rules', () => {
    const blank = { phone: '', guardian_name: '', guardian_relation: '', address: '', allergies: '', notes: '', father_height_cm: null, mother_height_cm: null, condition_ids: [] }
    const visit = { bp: '', complaint: '', history: '', assessment: '', plan: '', print_plan: true, advice: '', review_date: null, medicines: [], investigations: [], tanner: null }

    it('rejects implausible measurements and unknown flags', async () => {
      const p = await store.savePatient({ ...blank, name: 'Rules', dob: '2017-05-12', sex: 'M' })
      await expect(store.saveVisit({ ...visit, patient_id: p.id, visit_date: '2026-10-08', height_cm: 1210, weight_kg: 24 })).rejects.toThrow(/did not accept one of the values/)
      await expect(store.saveVisit({ ...visit, patient_id: p.id, visit_date: '2026-10-08', height_cm: 121, weight_kg: 350 })).rejects.toThrow(/did not accept one of the values/)
      await expect(store.saveResult({ patient_id: p.id, test: 'X', value: '1', unit: '', result_date: '2026-01-10', flag: 'odd' as '' })).rejects.toThrow()
      await expect(store.savePatient({ ...blank, name: '  ', dob: '2017-05-12', sex: 'M' })).rejects.toThrow()
      await store.deletePatient(p.id)
    })

    it('explains a lost record in plain words', async () => {
      const p = await store.savePatient({ ...blank, name: 'Gone', dob: '2017-05-12', sex: 'M' })
      const v = await store.saveVisit({ ...visit, patient_id: p.id, visit_date: '2026-10-08', height_cm: 121, weight_kg: 24 })
      await store.deleteVisit(v.id)
      await expect(store.saveVisit({ ...visit, patient_id: p.id, visit_date: '2026-10-08', height_cm: 122, weight_kg: 24 }, v.id)).rejects.toThrow(/no longer exists/)
      await store.deletePatient(p.id)
    })

    it('reads past the 1,000-row page limit without repeating or skipping rows', async () => {
      const p = await store.savePatient({ ...blank, name: 'Bulk', dob: '2017-05-12', sex: 'M' })
      sql(`insert into patients (owner_id, name, dob, sex) select '${A}', 'Bulk ' || g, '2015-01-01', 'F' from generate_series(1, 1250) g; insert into visits (owner_id, patient_id, visit_date, height_cm) select '${A}', '${p.id}', date '2019-01-01' + g, 100 + g * 0.01 from generate_series(1, 2300) g; insert into results (owner_id, patient_id, test, value, result_date) select '${A}', '${p.id}', 'TSH', '2.' || g, date '2019-01-01' + g from generate_series(1, 1001) g;`)
      const d = await store.dump()
      expect(d.visits.filter((v) => v.patient_id === p.id)).toHaveLength(2300)
      expect(new Set(d.visits.map((v) => v.id)).size).toBe(d.visits.length)
      expect(d.results.filter((r) => r.patient_id === p.id)).toHaveLength(1001)
      expect(d.patients.filter((x) => x.name.startsWith('Bulk'))).toHaveLength(1251)
      expect(new Set(d.patients.map((x) => x.mrn)).size).toBe(d.patients.length)
      // The trigger kept the summary right through a bulk insert.
      expect((await store.getPatient(p.id))!.visit_count).toBe(2300)
      expect((await store.listPatients({ q: 'Bulk', limit: 200 })).total).toBe(1251)
      sql(`delete from patients where owner_id = '${A}'`)
    }, 60000)

    it('fills the visit summary for visits that existed before the follow-up migration', async () => {
      const p = await store.savePatient({ ...blank, name: 'Backfill', dob: '2017-05-12', sex: 'M' })
      await store.saveVisit({ ...visit, patient_id: p.id, visit_date: '2026-07-14', height_cm: 118, weight_kg: 23, review_date: '2026-10-14' })
      sql(`update patients set last_visit_on = null, next_review_on = null, visit_count = 0 where id = '${p.id}'`)
      // The backfill statement from migration 0007, run again.
      sql(`update patients p set last_visit_on = s.last_visit_on, visit_count = s.visit_count, next_review_on = (select v.review_date from visits v where v.patient_id = p.id order by v.visit_date desc, v.created_at desc limit 1) from (select patient_id, max(visit_date) as last_visit_on, count(*) as visit_count from visits group by patient_id) s where s.patient_id = p.id`)
      const seen = (await store.getPatient(p.id))!
      expect([seen.visit_count, seen.last_visit_on, seen.next_review_on]).toEqual([1, '2026-07-14', '2026-10-14'])
      await store.deletePatient(p.id)
    })
  })
}
