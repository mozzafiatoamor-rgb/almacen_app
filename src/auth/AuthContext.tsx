import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { CurrentUser } from '../api/types'

interface AuthContextValue {
  user:    CurrentUser | null
  login:   (u: CurrentUser) => void
  logout:  () => void
  isAdmin:    boolean
  canManage:  boolean
}

const SESSION_KEY = 'mozz_currentUser'

function loadSession(): CurrentUser | null {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    return s ? (JSON.parse(s) as CurrentUser) : null
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadSession)

  const login = useCallback((u: CurrentUser) => {
    setUser(u)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  const isAdmin   = user?.rol === 'admin'
  const canManage = user?.rol === 'admin' || user?.rol === 'encargado'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, canManage }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
