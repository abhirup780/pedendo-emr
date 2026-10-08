import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { leaveNotice } from './lib/device'
import { store } from './lib/store'
import type { SessionUser } from './lib/types'

/** undefined while the session is being restored; null when signed out. */
const AuthContext = createContext<SessionUser | null | undefined>(undefined)

/**
 * Optional: the one email address this deployment is for. A convenience that turns away a
 * wrong account at the door; the real protection is the database's row-level security and
 * switching off new sign-ups in Supabase.
 */
const ALLOWED = ((import.meta.env.VITE_ALLOWED_EMAIL as string | undefined) ?? '').trim().toLowerCase()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserRaw] = useState<SessionUser | null | undefined>(undefined)
  const setUser = (u: SessionUser | null) => {
    if (u && ALLOWED && store.mode === 'supabase' && u.email.toLowerCase() !== ALLOWED) {
      leaveNotice(`${u.email} is not the account this app is set up for. Sign in with the clinic's own email address.`)
      void store.signOut()
      setUserRaw(null)
      return
    }
    setUserRaw(u)
  }
  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
    store.getUser().then((u) => live && setUser(u), () => live && setUser(null))
    const off = store.onAuthChange((u) => setUser(u))
    return () => {
      live = false
      off()
    }
  }, [])
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export function useUser() {
  return useContext(AuthContext)
}
