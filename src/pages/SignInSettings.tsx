import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useUser } from '../auth'
import { store } from '../lib/store'

/** Shortest password the app will set. The sign-in service has its own, lower, floor. */
export const MIN_PASSWORD = 10

function Password() {
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters. Three or four unrelated words work well.`)
    if (next !== again) return setError('The two entries are not the same.')
    setBusy(true)
    try {
      await store.changePassword(next)
      setNext('')
      setAgain('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.')
    }
    setBusy(false)
  }

  return (
    <form className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => void save(e)}>
      <div>
        <h2>Password</h2>
        <div className="muted">Changing it signs every other device out within the hour; this one stays signed in.</div>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      {done && <div className="pill ok" role="status">Password changed.</div>}
      <div className="row">
        <label className="field" style={{ flex: '1 1 220px' }}>
          New password
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 220px' }}>
          The same again
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
      </div>
      <div className="row end">
        <button type="submit" className="btn primary" disabled={busy || !next || !again}>Change password</button>
      </div>
    </form>
  )
}

function TwoStep() {
  const [state, setState] = useState<{ on: boolean; enforced: boolean } | null>(null)
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    store.twoStep().then(setState, (e: Error) => setError(e.message))
  }, [])

  async function run(job: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    setBusy(false)
  }

  const begin = () => run(async () => setSetup(await store.startTwoStep()))
  const confirm = (e: FormEvent) => {
    e.preventDefault()
    if (!setup) return
    void run(async () => {
      await store.confirmTwoStep(setup.id, code)
      setSetup(null)
      setCode('')
      setState(await store.twoStep())
    })
  }
  const turnOff = () => run(async () => {
    await store.stopTwoStep()
    setConfirmOff(false)
    setState(await store.twoStep())
  })

  return (
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2>Authenticator app (second step)</h2>
        <div className="muted">
          With this on, signing in needs the password and a six-digit code from an app on your phone, such as Google Authenticator, Microsoft Authenticator or Aegis. A stolen or guessed password is then not enough to open the records. Turning it on signs other devices out; they sign in again with the code.
        </div>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      {state === null && !error && <div className="muted">Checking…</div>}

      {state?.on && (
        <>
          <div className="row">
            <span className="pill ok">On: every sign-in asks for the code</span>
            <span className="grow" />
            {!confirmOff && <button type="button" className="btn" disabled={busy} onClick={() => setConfirmOff(true)}>Turn off</button>}
          </div>
          {!state.enforced && (
            <div className="alert">The database is not checking the code yet, only this app is. Run migration 0013 in Supabase (see docs/SETUP.md) and reload this page. If it has been run already, report this message: the records are then protected by the password only.</div>
          )}
          {confirmOff && (
            <div className="row">
              <span className="grow">Turn the second step off? The password alone will then open the records.</span>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirmOff(false)}>Keep it on</button>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void turnOff()}>Turn off</button>
            </div>
          )}
          <div className="muted" style={{ fontSize: 13 }}>
            Lost or changed the phone? Nobody can sign in without the code, so it is removed from the Supabase dashboard (docs/SETUP.md, "Lost phone"), and then set up again here.
          </div>
        </>
      )}

      {state && !state.on && !setup && (
        <div className="row">
          <span className="pill warn">Off: the password alone opens the records</span>
          <span className="grow" />
          <button type="button" className="btn primary" disabled={busy} onClick={() => void begin()}>Set up an authenticator app</button>
        </div>
      )}

      {setup && (
        <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={confirm}>
          <ol className="steps">
            <li>Open the authenticator app on your phone and choose to add an account.</li>
            <li>
              Scan this square with the phone's camera.
              <div className="qr"><img src={setup.qr} width={184} height={184} alt="QR code to scan with the authenticator app" /></div>
              <span className="muted" style={{ fontSize: 13 }}>Cannot scan? Type this key into the app instead: </span>
              <span className="mono secret">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</span>
            </li>
            <li>
              <label className="field" style={{ maxWidth: 320 }}>
                Type the six-digit code the app now shows
                <input className="num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
              </label>
            </li>
          </ol>
          <div className="row end">
            <button type="button" className="btn" disabled={busy} onClick={() => { setSetup(null); setCode(''); setError('') }}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || code.length !== 6}>Turn on</button>
          </div>
        </form>
      )}
    </section>
  )
}

export default function SignInSettings() {
  const user = useUser()
  if (store.mode === 'demo')
    return (
      <section className="card pad">
        <h2>Sign-in</h2>
        <div className="muted">The demo has no accounts. In real use this is where the password is changed and the authenticator app is set up.</div>
      </section>
    )
  return (
    <>
      <section className="card pad">
        <h2>Sign-in</h2>
        <div className="muted">Signed in as <span className="mono">{user?.email}</span>. The account itself is made, and a forgotten password reset, in the Supabase dashboard.</div>
      </section>
      <Password />
      <TwoStep />
    </>
  )
}
