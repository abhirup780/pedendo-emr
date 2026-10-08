import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { dropAllDrafts, idleMinutes, leaveNotice } from '../lib/device'
import { store } from '../lib/store'
import ErrorBoundary from './ErrorBoundary'
import type { SessionUser } from '../lib/types'
import { Mark, Wordmark } from './Brand'

export function DemoBanner() {
  if (store.mode !== 'demo') return null
  return (
    <div className="demo-banner" role="status">
      <span className="wide-only">Demo mode: sample data stored only in this browser. Do not enter real patients.</span>
      <span className="narrow-only">Demo: sample data only. Do not enter real patients.</span>
    </div>
  )
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

/** Signs out after a stretch with no typing, clicking or touching, so an open clinic PC locks itself. */
function useIdleSignOut() {
  useEffect(() => {
    let last = Date.now()
    const touch = () => {
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = setInterval(() => {
      const minutes = idleMinutes()
      if (minutes > 0 && Date.now() - last > minutes * 60000) {
        clearInterval(timer)
        leaveNotice(`Signed out after ${minutes} minutes without activity. Unsaved visit notes are kept in this tab.`)
        void store.signOut()
      }
    }, 15000)
    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, touch))
    }
  }, [])
}

export default function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  useIdleSignOut()
  const navigate = useNavigate()
  // Leave the page before signing out, so a patient's or visit's address is never left in the
  // address bar. (The sign-in screen does the same for every other way of being signed out.)
  const signOut = () => {
    dropAllDrafts()
    navigate('/', { replace: true })
    void store.signOut()
  }
  return (
    <>
      <DemoBanner />
      <header className="topbar">
        <Link to="/" className="brand" aria-label="AuxoEMR, patient list">
          <span className="brand-mark"><Mark /></span>
          <span className="brand-text"><Wordmark /></span>
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            Patients
          </NavLink>
          <NavLink to="/registry">
            Registry<span className="wide-only"> &amp; export</span>
          </NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="who-name">{user.name}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  )
}
