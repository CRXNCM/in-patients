import {
  FlaskConical, Pill, Scan, Stethoscope, Scissors, HeartPulse, Bed, DoorOpen, Users,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/CommonComponents'
import { departments } from '@/data/mockData'

const iconMap = {
  FlaskConical, Pill, Scan, Stethoscope, Scissors, HeartPulse, Bed, DoorOpen,
}

export default function DepartmentsPage() {
  return (
    <div>
      <PageHeader title="Departments" description="Hospital department overview and management" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {departments.map((dept) => {
          const Icon = iconMap[dept.icon] || FlaskConical
          return (
            <div key={dept.id} className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`rounded-xl p-3 ${dept.color} text-white shadow-md`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {dept.services} services
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">{dept.name}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{dept.staff} staff members</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
