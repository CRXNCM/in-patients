import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export function patientProfilePath(patientId) {
  return patientId ? `/patients/${encodeURIComponent(patientId)}` : null
}

export function PatientLink({ patientId, children, className, title }) {
  const { hasPermission } = useAuth()
  const location = useLocation()
  const path = patientProfilePath(patientId)

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
