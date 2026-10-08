import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DemoBanner } from '../components/Shell'
import { clearNotice, peekNotice } from '../lib/device'
import { store } from '../lib/store'
import { Curves, Mark, Wordmark } from '../components/Brand'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  /** 'code' once the password was accepted and the authenticator app's code is wanted. */
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice] = useState(peekNotice)
  const codeBox = useRef<HTMLInputElement>(null)
  useEffect(() => clearNotice(), [])
  useEffect(() => {
    if (step === 'code') codeBox.current?.focus()
  }, [step])

  async function go(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (step === 'code') {
        await store.verifyCode(code)
      } else if ((await store.signIn(email, password)) === 'code') {
        setStep('code')
        setPassword('')
      }
      // The app may have turned this account away the moment it signed in (see AuthProvider).
      const refused = peekNotice()
      if (refused) {
        clearNotice()
        setError(refused)
        setPassword('')
        setCode('')
        setStep('password')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    }
    setBusy(false)
  }

  async function startAgain() {
    await store.signOut().catch(() => {})
    setStep('password')
    setCode('')
    setError('')
  }

  const demo = store.mode === 'demo'
  return (
    <>
      <DemoBanner />
      <main className="signin">
        <div className="signin-art">
          <h1>
            <Mark size={38} />
            <Wordmark />
          </h1>
          <p>Patient records, growth charts and prescriptions for the pediatric endocrinology clinic.</p>
          <Curves />
        </div>
        <div className="signin-form">
        <form className="card" onSubmit={(e) => void go(e)}>
          <h2>{demo ? 'Demo' : step === 'code' ? 'Second step' : 'Sign in'}</h2>
          <div className="muted">
            {demo ? 'This is the demo: no sign-in is needed.' : step === 'code' ? 'Enter the six-digit code from the authenticator app on your phone.' : 'Use the clinic email and password.'}
          </div>
          {notice && <div className="note" role="status">{notice}</div>}
          {error && <div className="alert" role="alert">{error}</div>}
          {!demo && step === 'password' && (
            <>
              <label className="field">
                Email
                <input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                Password
                <input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            </>
          )}
          {!demo && step === 'code' && (
            <label className="field">
              Code
              <input ref={codeBox} className="num" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
            </label>
          )}
          <button type="submit" className="btn primary" disabled={busy || (step === 'code' && code.length !== 6)}>
            {demo ? 'Open the demo' : busy ? 'Checking…' : step === 'code' ? 'Confirm code' : 'Sign in'}
          </button>
          {!demo && step === 'code' && (
            <button type="button" className="btn" onClick={() => void startAgain()}>Use a different account</button>
          )}
          {!demo && step === 'password' && (
            <div className="muted" style={{ fontSize: 13 }}>Forgotten the password? It is reset from the Supabase dashboard, under Authentication, Users.</div>
          )}
        </form>
        </div>
      </main>
    </>
  )
}
