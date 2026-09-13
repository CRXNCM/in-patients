import { ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export function Forbidden() {
  const { user } = useAuth()
  const home = user?.dashboardPath || '/'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">You don’t have access to this page</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Your role does not include permission for this part of the system. If you need access, ask an administrator to update the role.
      </p>
      <Button asChild>
        <Link to={home}>Back to dashboard</Link>
      </Button>
    </div>
  )
}
