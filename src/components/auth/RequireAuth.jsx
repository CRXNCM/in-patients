import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function RequireAuth({ role }) {
  const { isAuthenticated, user, authReady } = useAuth()

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role && user.roleKey !== role) {
    return <Navigate to={user.dashboardPath} replace />
  }

  return <Outlet />
}
