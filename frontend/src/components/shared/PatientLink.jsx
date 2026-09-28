import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export function patientProfilePath(patientId, roleKey) {
  if (!patientId) return null
  const id = encodeURIComponent(patientId)
  const role = String(roleKey || '').toLowerCase()
  if (role === 'reception') return `/reception/patient/${id}`
  if (role === 'nurse') return `/nurse/patient/${id}`
  return `/patients/${id}`
}

export function PatientLink({ patientId, children, className, title }) {
  const { user, hasPermission } = useAuth()
  const location = useLocation()
  const path = patientProfilePath(patientId, user?.roleKey)

  if (!path || !hasPermission('patients.view')) {
    return <span className={className} title={title}>{children}</span>
  }

  return (
    <Link
      to={path}
      state={{ from: `${location.pathname}${location.search}` }}
      title={title}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        className
      )}
    >
      {children}
    </Link>
  )
}
