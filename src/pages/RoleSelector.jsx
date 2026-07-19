import { useNavigate } from 'react-router-dom'
import { Activity, Users, Shield, BarChart3, ArrowRight, Hospital, HeartPulse } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { hospitalSettings } from '@/data/mockData'

const roles = [
  {
    id: 'reception',
    title: 'Reception',
    description: 'Approve nurse charges, manage billing, process deposits, and generate invoices.',
    icon: Users,
    color: 'bg-blue-500',
    path: '/reception',
  },
  {
    id: 'nurse',
    title: 'Nurse',
    description: 'Record patient services from admin-defined categories. Entries await reception approval before billing.',
    icon: HeartPulse,
    color: 'bg-teal-500',
    path: '/nurse',
  },
  {
    id: 'admin',
    title: 'Administrator',
    description: 'Configure hospital services, medicines, departments, room charges, doctors, and system settings.',
    icon: Shield,
    color: 'bg-indigo-500',
    path: '/admin',
  },
  {
    id: 'manager',
    title: 'Manager',
    description: 'Executive dashboard with revenue analytics, KPIs, reports, and financial oversight.',
    icon: BarChart3,
    color: 'bg-emerald-500',
    path: '/manager',
  },
]

export default function RoleSelector() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground mb-6 shadow-lg">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">MedBill Pro</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hospital In-Patient Billing & Deposit Management System
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Hospital className="h-4 w-4" />
            <span>{hospitalSettings.name}</span>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <Card
                key={role.id}
                className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 hover:border-primary/30"
                onClick={() => navigate(role.path)}
              >
                <CardHeader>
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${role.color} text-white mb-2 shadow-md`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{role.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full group-hover:gap-3 transition-all" onClick={() => navigate(role.path)}>
                    Enter Dashboard
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-12">
          Demo Application · Mock Data Only · Currency: Ethiopian Birr (ETB)
        </p>
      </div>
    </div>
  )
}
