import { Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { hasAllPermissions, hasAnyPermission } from '@/lib/permissions'
import { Forbidden } from './Forbidden'

export function RequirePermission({ permission, anyOf, allOf }) {
  const { user } = useAuth()
  const requiredAll = allOf || (permission ? [permission] : [])
  const requiredAny = anyOf || []

  const allowed =
    (requiredAll.length === 0 || hasAllPermissions(user, requiredAll)) &&
    (requiredAny.length === 0 || hasAnyPermission(user, requiredAny))

  if (!allowed) return <Forbidden />
  return <Outlet />
}
