import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { store } from './lib/store'
import type { SessionUser } from './lib/types'

/** undefined while the session is being restored; null when signed out. */
const AuthContext = createContext<SessionUser | null | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  useEffect(() => {
    let live = true
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
