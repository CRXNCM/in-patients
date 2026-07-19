import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Activity, Hospital, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { hospitalSettings, users } from '@/data/mockData'
import { useAuth } from '@/context/AuthContext'
import { DEMO_PASSWORD } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { login, isAuthenticated, user, authReady } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (isAuthenticated && user?.dashboardPath) {
    return <Navigate to={user.dashboardPath} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast({ title: 'Enter email and password', variant: 'destructive' })
      return
    }
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Login failed', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Welcome back', description: `Signed in as ${email}`, variant: 'success' })
    navigate(result.path, { replace: true })
  }

  const demoAccounts = users.filter((u) => u.status === 'active')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your hospital account credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@stgabriel.et"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4 mr-2" />
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Demo accounts (password: {DEMO_PASSWORD})</p>
              <ul className="space-y-1.5 text-xs">
                {demoAccounts.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                      onClick={() => {
                        setEmail(u.email)
                        setPassword(DEMO_PASSWORD)
                      }}
                    >
                      <span className="font-medium">{u.role}</span>
                      <span className="text-muted-foreground"> — {u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          InCare · Central City Hospital · Currency: ETB
        </p>
      </div>
    </div>
  )
}
