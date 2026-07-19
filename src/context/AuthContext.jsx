import * as React from 'react'
import { users } from '@/data/mockData'
import { api, setToken, USE_API } from '@/api/client'

const AuthContext = React.createContext(null)

const ROLE_ROUTES = {
  Reception: '/reception',
  Nurse: '/nurse',
  Admin: '/admin',
  Manager: '/manager',
}

const DEMO_PASSWORD = 'password'

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function toSessionUser(user) {
  const roleKey = user.role.toLowerCase()
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleKey,
    dashboardPath: user.dashboardPath || ROLE_ROUTES[user.role],
    initials: user.initials || getInitials(user.name),
  }
}

function saveSession(user) {
  sessionStorage.setItem('medbill_user', JSON.stringify(user))
}

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(() => {
    if (USE_API) return null
    try {
      const saved = sessionStorage.getItem('medbill_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [authReady, setAuthReady] = React.useState(!USE_API)

  React.useEffect(() => {
    if (!USE_API) return undefined

    const token = sessionStorage.getItem('medbill_token')
    const savedUser = sessionStorage.getItem('medbill_user')

    if (!token) {
      if (savedUser) sessionStorage.removeItem('medbill_user')
      setUser(null)
      setAuthReady(true)
      return undefined
    }

    api
      .me()
      .then((data) => {
        const sessionUser = toSessionUser(data)
        setUser(sessionUser)
        saveSession(sessionUser)
      })
      .catch(() => {
        setUser(null)
        setToken(null)
        sessionStorage.removeItem('medbill_user')
      })
      .finally(() => setAuthReady(true))

    return undefined
  }, [])

  const login = React.useCallback(async (email, password) => {
    if (USE_API) {
      try {
        const data = await api.login(email, password)
        setToken(data.token)
        const sessionUser = toSessionUser(data.user)
        setUser(sessionUser)
        saveSession(sessionUser)
        return { success: true, path: sessionUser.dashboardPath }
      } catch (err) {
        return { error: err.message || 'Invalid email or password' }
      }
    }

    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!found || password !== DEMO_PASSWORD) {
      return { error: 'Invalid email or password' }
    }
    if (found.status !== 'active') {
      return { error: 'This account is inactive. Contact your administrator.' }
    }
    const sessionUser = toSessionUser(found)
    setUser(sessionUser)
    saveSession(sessionUser)
    return { success: true, path: sessionUser.dashboardPath }
  }, [])

  const logout = React.useCallback(() => {
    setUser(null)
    setToken(null)
    sessionStorage.removeItem('medbill_user')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authReady,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ROLE_ROUTES, DEMO_PASSWORD }
