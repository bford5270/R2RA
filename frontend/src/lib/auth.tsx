import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser } from '../types/auth'
import { api, setToken } from './api'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Token lives only in memory — not localStorage — per CUI posture.
  // Page refresh requires re-login; this is intentional for field use.
  const [user, setUser] = useState<AuthUser | null>(null)

  const login = useCallback((token: string, u: AuthUser) => {
    setToken(token)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await api.me()
      setUser(fresh)
    } catch {
      // ignore — user stays as-is
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
