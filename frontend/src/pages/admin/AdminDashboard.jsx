import { ClipboardList, Pill, Users, Building2 } from 'lucide-react'
import { StatCard, PageHeader } from '@/components/shared/CommonComponents'
import { services, medicines, users, departments } from '@/data/mockData'

export default function AdminDashboard() {
  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and data management"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Services"
          value={services.length}
          subtitle={`${services.filter((s) => s.status === 'active').length} active`}
          icon={ClipboardList}
          iconClassName="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          title="Total Medicines"
          value={medicines.length}
          subtitle={`${medicines.filter((m) => m.stockStatus === 'in-stock').length} in stock`}
          icon={Pill}
          iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          title="Active Users"
          value={users.filter((u) => u.status === 'active').length}
          subtitle={`${users.length} total users`}
          icon={Users}
          iconClassName="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatCard
          title="Departments"
          value={departments.length}
          subtitle="Hospital departments"
          icon={Building2}
          iconClassName="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Recent Services</h3>
          <div className="space-y-3">
            {services.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.department}</p>
                </div>
                <span className="text-sm font-semibold text-primary">ETB {s.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Department Overview</h3>
          <div className="space-y-3">
            {departments.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${d.color}`} />
                  <p className="font-medium text-sm">{d.name}</p>
                </div>
                <span className="text-xs text-muted-foreground">{d.staff} staff · {d.services} services</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
