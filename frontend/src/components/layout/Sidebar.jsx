import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Pill,
  Building2,
  Bed,
  Stethoscope,
  UserCog,
  Settings,
  FileText,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Activity,
  ClipboardCheck,
  HeartPulse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { hospitalSettings } from '@/data/mockData'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { HospitalLogo } from '@/components/shared/HospitalLogo'

const roleMenus = {
  reception: [
    { label: 'Dashboard', path: '/reception', icon: LayoutDashboard },
    { label: 'Pending Approvals', path: '/reception/approvals', icon: ClipboardCheck, badge: true },
    { label: 'Patients', path: '/reception/patients', icon: Users },
    { label: 'Add Patient', path: '/reception/add-patient', icon: Users },
  ],
  nurse: [
    { label: 'Dashboard', path: '/nurse', icon: LayoutDashboard },
    { label: 'Patients', path: '/nurse/patients', icon: Users },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Services', path: '/admin/services', icon: ClipboardList },
    { label: 'Medicines', path: '/admin/medicines', icon: Pill },
    { label: 'Departments', path: '/admin/departments', icon: Building2 },
    { label: 'Room Charges', path: '/admin/room-charges', icon: Bed },
    { label: 'Doctors', path: '/admin/doctors', icon: Stethoscope },
    { label: 'Users', path: '/admin/users', icon: UserCog },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ],
  manager: [
    { label: 'Dashboard', path: '/manager', icon: LayoutDashboard },
    { label: 'Reports', path: '/manager/reports', icon: FileText },
  ],
}

export function Sidebar({ role, collapsed, onToggle }) {
  const location = useLocation()
  const menuItems = roleMenus[role] || []
  const { getPendingCount } = useServiceEntries()
  const pendingCount = role === 'reception' ? getPendingCount() : 0

  return (
    <aside
      className={cn(
        'no-print fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <HospitalLogo size="sm" className="shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">InCare</p>
            <p className="truncate text-xs text-muted-foreground">{hospitalSettings.name}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive =
            location.pathname === item.path ||
            (item.path !== `/${role}` && location.pathname.startsWith(item.path))
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white px-1">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  )
}
