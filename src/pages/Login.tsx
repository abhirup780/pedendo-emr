import { useState } from 'react'
import { DemoBanner } from '../components/Shell'
import { store } from '../lib/store'

export default function Login() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    setError('')
    try {
      await store.signIn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.')
      setBusy(false)
    }
  }
  return (
    <>
      <DemoBanner />
      <main className="login">
        <div className="card">
          <h1>Pediatric Endocrinology</h1>
          <div className="muted">Patient records and prescriptions. Sign in with the clinic's Google account.</div>
          {error && <div className="alert">{error}</div>}
          <button type="button" className="btn primary" onClick={go} disabled={busy}>
            {store.mode === 'demo' ? 'Open the demo' : 'Sign in with Google'}
          </button>
        </div>
      </main>
    </>
  )
}
