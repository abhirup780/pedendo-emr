import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseStore } from '../../src/lib/store.supabase'
import { photoPath } from '../../src/lib/photofiles'
import { storeContract } from '../contract'

/**
 * The same contract as the demo store, run against the real Supabase store talking to a local
 * Postgres behind PostgREST and Supabase's own auth server. Skipped unless `npm run test:db`
 * has started those and set the variables below. Both accounts sign in with an email and
 * password, exactly as the doctor will.
 */
const API = process.env.TEST_PGRST_URL
const AUTH = process.env.TEST_AUTH_URL ?? ''
const SECRET = process.env.TEST_JWT_SECRET ?? ''
const PSQL = process.env.TEST_PSQL ?? ''

if (!API) {
  describe.skip('Supabase store (run with npm run test:db)', () => {
    it('needs the local database', () => {})
  })
} else {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  /** A key such as Supabase issues for a project: `anon` for the app, `service_role` for the dashboard. */
  const key = (role: string) => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, exp: Math.floor(Date.now() / 1000) + 3600 })}`
    return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`
  }
  // Supabase serves the database under /rest/v1 and sign-in under /auth/v1; this does the same.
  const routes = [['/rest/v1', new URL(API)], ['/auth/v1', new URL(AUTH)]] as const
  const proxy = http
    .createServer((req, res) => {
      const [prefix, target] = routes.find(([p]) => (req.url ?? '').startsWith(p)) ?? routes[0]
      const out = http.request({ host: target.hostname, port: target.port, method: req.method, path: (req.url ?? '/').replace(prefix, ''), headers: { ...req.headers, host: target.host } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      req.pipe(out)
    })
    .listen(0)
  const url = `http://localhost:${(proxy.address() as { port: number }).port}`
  afterAll(() => void proxy.close())

  /** A separate browser, as far as Supabase can tell. */
  const browser = () => createSupabaseStore(createClient(url, key('anon')))
  /** What the dashboard's "Add user" does. Returns the new account's id. */
  async function addUser(email: string, password: string): Promise<string> {
    const res = await fetch(`${AUTH}/admin/users`, { method: 'POST', headers: { Authorization: `Bearer ${key('service_role')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) })
    if (!res.ok) throw new Error(`Could not add ${email}: ${await res.text()}`)
    return ((await res.json()) as { id: string }).id
  }
  const sql = (q: string) => execSync(`${PSQL} -At`, { input: q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim()

  /** The six-digit code an authenticator app would show for this secret (RFC 6238). */
  function totp(secret: string, at = Date.now()): string {
    const bits = [...secret.replace(/=+$/, '').toUpperCase()].map((c) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0')).join('')
    const keyBytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)))
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)))
    const mac = crypto.createHmac('sha1', keyBytes).update(counter).digest()
    const at4 = mac[mac.length - 1] & 15
    return String((mac.readUInt32BE(at4) & 0x7fffffff) % 1e6).padStart(6, '0')
  }

  const PASSWORD = 'correct horse battery staple'
  const store = browser()
  const other = browser()
  let A = ''
  let B = ''
  beforeAll(async () => {
    A = await addUser('doctor@clinic.test', PASSWORD)
    B = await addUser('someone.else@clinic.test', PASSWORD)
    expect(await store.signIn('doctor@clinic.test', PASSWORD)).toBe('ok')
    expect(await other.signIn('someone.else@clinic.test', PASSWORD)).toBe('ok')
  })

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

  describe('Supabase store: sign-in', () => {
    const blank = { phone: '', guardian_name: '', guardian_relation: '', address: '', allergies: '', notes: '', father_height_cm: null, mother_height_cm: null, condition_ids: [] }

    it('signs in with the email and password, and says so plainly when they are wrong', async () => {
      const b = browser()
      expect(await b.getUser()).toBeNull()
      await expect(b.signIn('doctor@clinic.test', 'not the password')).rejects.toThrow(/email or password is not right/)
      await expect(b.signIn('nobody@clinic.test', PASSWORD)).rejects.toThrow(/email or password is not right/)
      expect(await b.getUser()).toBeNull()
      expect(await b.signIn(' doctor@clinic.test ', PASSWORD)).toBe('ok')
      expect((await b.getUser())?.email).toBe('doctor@clinic.test')
      await b.signOut()
      expect(await b.getUser()).toBeNull()
      // Signing out in one browser leaves the others signed in.
      expect((await store.getUser())?.email).toBe('doctor@clinic.test')
      await store.listConditions()
    })

    it('turns away anyone who is not signed in', async () => {
      const b = browser()
      // Refused outright here; on Supabase the same request comes back empty. Either is a no.
      expect(await b.listPatients().then((r) => r.total, () => 0)).toBe(0)
      await expect(b.savePatient({ ...blank, name: 'Nobody', dob: '2017-05-12', sex: 'M' })).rejects.toThrow()
    })

    it('does not let strangers make themselves an account', async () => {
      const res = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers: { apikey: key('anon'), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'stranger@example.test', password: PASSWORD }) })
      expect(res.ok).toBe(false)
    })

    it('authenticator app: once set up, the password alone opens nothing', async () => {
      const p = await store.savePatient({ ...blank, name: 'Two Step', dob: '2017-05-12', sex: 'M' })
      expect(await store.twoStep()).toEqual({ on: false, enforced: false })
      // A second device, signed in before the authenticator exists.
      const early = browser()
      expect(await early.signIn('doctor@clinic.test', PASSWORD)).toBe('ok')
      expect((await early.getPatient(p.id))?.name).toBe('Two Step')

      // A set-up begun and abandoned must not block the next try.
      await store.startTwoStep()
      const setup = await store.startTwoStep()
      expect(setup.qr).toMatch(/^data:image\/svg\+xml/)
      expect(setup.secret).toMatch(/^[A-Z2-7]{16,}$/)
      await expect(store.confirmTwoStep(setup.id, '000000')).rejects.toThrow(/code was not accepted/)
      expect((await store.twoStep()).on).toBe(false)
      await store.confirmTwoStep(setup.id, totp(setup.secret))
      expect(await store.twoStep()).toEqual({ on: true, enforced: true })
      // The browser that set it up carries on working.
      expect((await store.getPatient(p.id))?.name).toBe('Two Step')

      // The device that was already signed in is refused by the database from this moment, and
      // the app notices and signs it out rather than showing an empty practice.
      expect(await early.getPatient(p.id)).toBeNull()
      expect(await early.getUser()).toBeNull()
      expect(await early.signIn('doctor@clinic.test', PASSWORD)).toBe('code')

      // Another browser with only the password: asked for the code, signed in as nobody,
      // and refused by the database itself, not just by the screens.
      const b = browser()
      const seen: (string | null)[] = []
      b.onAuthChange((u) => seen.push(u?.email ?? null))
      expect(await b.signIn('doctor@clinic.test', PASSWORD)).toBe('code')
      expect(await b.getUser()).toBeNull()
      expect(seen.every((e) => e === null)).toBe(true)
      expect(await b.getPatient(p.id)).toBeNull()
      expect((await b.listPatients()).total).toBe(0)
      await expect(b.savePatient({ ...blank, name: 'Sneak', dob: '2017-05-12', sex: 'M' })).rejects.toThrow()
      await expect(b.saveVisit({ patient_id: p.id, visit_date: '2026-10-08', height_cm: 120, weight_kg: 24, bp: '', complaint: '', history: '', assessment: '', plan: '', print_plan: true, advice: '', review_date: null, medicines: [], investigations: [], tanner: null })).rejects.toThrow()
      await b.deletePatient(p.id)
      expect((await store.getPatient(p.id))?.name).toBe('Two Step')
      // Nor can it switch the second step off.
      await expect(b.stopTwoStep()).rejects.toThrow()
      expect((await store.twoStep()).on).toBe(true)

      await expect(b.verifyCode('000000')).rejects.toThrow(/code was not accepted/)
      expect(await b.getUser()).toBeNull()
      await b.verifyCode(totp(setup.secret))
      expect((await b.getUser())?.email).toBe('doctor@clinic.test')
      expect(seen.at(-1)).toBe('doctor@clinic.test')
      expect((await b.getPatient(p.id))?.name).toBe('Two Step')

      // The other account is untouched by all this.
      expect(await other.twoStep()).toEqual({ on: false, enforced: false })
      await other.listConditions()

      // Switched off again, the password is enough once more.
      await b.stopTwoStep()
      expect(await b.twoStep()).toEqual({ on: false, enforced: false })
      const c = browser()
      expect(await c.signIn('doctor@clinic.test', PASSWORD)).toBe('ok')
      expect((await c.getPatient(p.id))?.name).toBe('Two Step')
      await store.signIn('doctor@clinic.test', PASSWORD)
      await store.deletePatient(p.id)
    }, 90000)

    it('changes the password', async () => {
      const b = browser()
      await b.signIn('someone.else@clinic.test', PASSWORD)
      await expect(b.changePassword('abc')).rejects.toThrow(/too short/)
      await b.changePassword('a much longer new password')
      const c = browser()
      await expect(c.signIn('someone.else@clinic.test', PASSWORD)).rejects.toThrow(/not right/)
      expect(await c.signIn('someone.else@clinic.test', 'a much longer new password')).toBe('ok')
      await c.changePassword(PASSWORD)
    })
  })

  describe('Photograph files: who may touch what', () => {
    // The storage server is not run here; these are the rules of migration 0013, tried the
    // way that server applies them: as the signed-in account, on its own table.
    const as = (sub: string, aal: string, q: string) =>
      sql(`begin; set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub, role: 'authenticated', aal })}', true); ${q}; commit;`)
    const put = (sub: string, name: string, aal = 'aal1') => as(sub, aal, `insert into storage.objects (bucket_id, name, owner_id) values ('photos', '${name}', '${sub}')`)
    const names = (sub: string, aal = 'aal1') => as(sub, aal, `select 'names=' || coalesce(string_agg(name, ',' order by name), '') from storage.objects where bucket_id = 'photos'`).split('\n').find((l) => l.startsWith('names='))?.slice(6)

    it('the place for photographs is private, small files only, JPEG only', () => {
      expect(sql(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photos'`)).toBe('f|2097152|{image/jpeg}')
    })

    it('an account reads, adds and removes only under its own id', () => {
      const mine = photoPath(A, 'patient-1', 'one')
      put(A, mine)
      put(B, photoPath(B, 'patient-9', 'theirs'))
      expect(() => put(B, photoPath(A, 'patient-1', 'planted'))).toThrow(/row-level security/)
      expect(() => put(A, 'loose-file.jpg')).toThrow(/row-level security/)
      expect(names(A)).toBe(mine)
      expect(names(B)).toBe(photoPath(B, 'patient-9', 'theirs'))
      as(B, 'aal1', `delete from storage.objects where name = '${mine}'`)
      expect(names(A)).toBe(mine)
      as(A, 'aal1', `delete from storage.objects where name = '${mine}'`)
      expect(names(A)).toBe('')
      // Nobody may overwrite a file in place: there is no rule that allows an update.
      as(B, 'aal1', `update storage.objects set name = '${photoPath(B, 'patient-9', 'renamed')}'`)
      expect(names(B)).toBe(photoPath(B, 'patient-9', 'theirs'))
      sql(`delete from storage.objects`)
    })

    it('with an authenticator app set up, files too need the code', () => {
      const mine = photoPath(A, 'patient-1', 'two')
      put(A, mine)
      sql(`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values (gen_random_uuid(), '${A}', 'test', 'totp', 'verified', now(), now())`)
      expect(names(A, 'aal1')).toBe('')
      expect(() => put(A, photoPath(A, 'patient-1', 'three'), 'aal1')).toThrow(/row-level security/)
      expect(names(A, 'aal2')).toBe(mine)
      put(A, photoPath(A, 'patient-1', 'three'), 'aal2')
      sql(`delete from auth.mfa_factors where user_id = '${A}'; delete from storage.objects`)
    })
  })
}
