import * as React from 'react'
import { users } from '@/data/mockData'
import { api, setToken, USE_API } from '@/api/client'
import { hasAllPermissions, hasAnyPermission, hasPermission } from '@/lib/permissions'

const AuthContext = React.createContext(null)

const ROLE_ROUTES = {
  Reception: '/reception',
  Nurse: '/nurse',
  Admin: '/admin',
  Manager: '/manager',
  Pharmacist: '/pharmacist',
  Laboratory: '/laboratory',
}

const FRONTEND_WORKFLOW_ROLES = ['Pharmacist', 'Laboratory']

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

function sessionSignature(user) {
  if (!user) return ''
  const permissions = Array.isArray(user.permissions) ? [...user.permissions].sort() : []
  return JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleName: user.roleName,
    roleKey: user.roleKey,
    roleId: user.roleId,
    roleSlug: user.roleSlug,
    dashboardPath: user.dashboardPath,
    permissions,
  })
}

function toSessionUser(user) {
  const accessRole = user.accessRole || user.role
  const roleKey = String(accessRole || '').toLowerCase()
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: accessRole,
    roleName: user.roleName || user.role,
    accessRole,
    roleKey,
    roleId: user.roleId || null,
    roleSlug: user.roleSlug || null,
    dashboardPath: user.dashboardPath || ROLE_ROUTES[accessRole],
    initials: user.initials || getInitials(user.name),
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  }
}

function saveSession(user) {
  sessionStorage.setItem('medbill_user', JSON.stringify(user))
}

function readStoredUser() {
  try {
    const saved = sessionStorage.getItem('medbill_user')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function readOfflineWorkflowUser() {
  if (sessionStorage.getItem('medbill_token')) return null
  const saved = readStoredUser()
  if (saved?.roleKey === 'pharmacist' || saved?.roleKey === 'laboratory') return saved
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(() => {
    if (USE_API) return readOfflineWorkflowUser()
    return readStoredUser()
  })
  const [authReady, setAuthReady] = React.useState(() => !USE_API || !sessionStorage.getItem('medbill_token'))

  const applySession = React.useCallback((data) => {
    const sessionUser = toSessionUser(data)
    setUser((current) => (sessionSignature(current) === sessionSignature(sessionUser) ? current : sessionUser))
    saveSession(sessionUser)
    return sessionUser
  }, [])

  const refreshPermissions = React.useCallback(async () => {
    if (!USE_API || !sessionStorage.getItem('medbill_token')) return null
    const data = await api.me()
    return applySession(data)
  }, [applySession])

  React.useEffect(() => {
    if (!USE_API) return undefined

    const token = sessionStorage.getItem('medbill_token')
    const savedUser = sessionStorage.getItem('medbill_user')

    if (!token) {
      const offline = readOfflineWorkflowUser()
      if (offline) {
        setUser(offline)
        setAuthReady(true)
        return undefined
      }
      if (savedUser) sessionStorage.removeItem('medbill_user')
      setUser(null)
      setAuthReady(true)
      return undefined
    }

    refreshPermissions()
      .catch(() => {
        setUser(null)
        setToken(null)
        sessionStorage.removeItem('medbill_user')
      })
      .finally(() => setAuthReady(true))

    const onFocus = () => {
      refreshPermissions().catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => {
      refreshPermissions().catch(() => {})
    }, 15000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [refreshPermissions])

  const login = React.useCallback(async (email, password) => {
    if (USE_API) {
      try {
        const data = await api.login(email, password)
        setToken(data.token)
        const sessionUser = applySession(data.user)
        return { success: true, path: sessionUser.dashboardPath }
      } catch (err) {
        const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (
          found
          && FRONTEND_WORKFLOW_ROLES.includes(found.role)
          && password === DEMO_PASSWORD
          && found.status === 'active'
        ) {
          setToken(null)
          const sessionUser = toSessionUser(found)
          setUser(sessionUser)
          saveSession(sessionUser)
          return { success: true, path: sessionUser.dashboardPath }
        }
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
  }, [applySession])

  const logout = React.useCallback(() => {
    setUser(null)
    setToken(null)
    sessionStorage.removeItem('medbill_user')
  }, [])

  const can = React.useCallback((key) => hasPermission(user, key), [user])
  const canAny = React.useCallback((keys) => hasAnyPermission(user, keys), [user])
  const canAll = React.useCallback((keys) => hasAllPermissions(user, keys), [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authReady,
        login,
        logout,
        refreshPermissions,
        hasPermission: can,
        hasAnyPermission: canAny,
        hasAllPermissions: canAll,
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
