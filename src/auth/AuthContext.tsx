import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { CurrentUser, Area } from '../api/types'

export type AreaFiltro = Area | 'Todas'
const LS_AREA_FILTRO = 'mz_area_filtro'

interface AuthContextValue {
  user:             CurrentUser | null
  login:            (u: CurrentUser) => void
  logout:           () => void
  isAdmin:          boolean
  canManage:        boolean
  userArea:         Area | 'Todas'
  isAreaRestricted: boolean
  areaFiltro:       AreaFiltro
  setAreaFiltro:    (a: AreaFiltro) => void
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

function defaultAreaFiltro(rol?: string): AreaFiltro {
  if (rol === 'barista')  return 'Barra'
  if (rol === 'cocinero') return 'Cocina'
  return 'Todas'
}

function loadAreaFiltro(rol?: string): AreaFiltro {
  try {
    const saved = localStorage.getItem(LS_AREA_FILTRO) as AreaFiltro | null
    const valid: AreaFiltro[] = ['Todas', 'General', 'Barra', 'Cocina', 'Ambas']
    return saved && valid.includes(saved) ? saved : defaultAreaFiltro(rol)
  } catch {
    return defaultAreaFiltro(rol)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadSession)
  const [areaFiltro, setAreaFiltroState] = useState<AreaFiltro>(() => loadAreaFiltro(loadSession()?.rol))

  const login = useCallback((u: CurrentUser) => {
    setUser(u)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    // On login, reset area filter to role default
    const def = defaultAreaFiltro(u.rol)
    setAreaFiltroState(def)
    localStorage.setItem(LS_AREA_FILTRO, def)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LS_AREA_FILTRO)
  }, [])

  const setAreaFiltro = useCallback((a: AreaFiltro) => {
    setAreaFiltroState(a)
    localStorage.setItem(LS_AREA_FILTRO, a)
  }, [])

  const isAdmin          = user?.rol === 'admin'
  const canManage        = user?.rol === 'admin' || user?.rol === 'encargado'
  const isAreaRestricted = user?.rol === 'barista' || user?.rol === 'cocinero'
  const userArea: Area | 'Todas' =
    user?.rol === 'barista'  ? 'Barra'  :
    user?.rol === 'cocinero' ? 'Cocina' : 'Todas'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, canManage, userArea, isAreaRestricted, areaFiltro, setAreaFiltro }}>
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
