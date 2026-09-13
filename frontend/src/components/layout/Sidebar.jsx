import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HospitalLogo } from '@/components/shared/HospitalLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { isNavItemActive, visibleNavSections } from '@/lib/navigation'

const EXPANDED_WIDTH = 'w-64'
const COLLAPSED_WIDTH = 'w-[4.5rem]'

function brandLines(hospitalName) {
  const name = String(hospitalName || '').trim() || 'Hospital'
  const parts = name.split(/\s+/)
  if (parts.length <= 2) return { title: name, subtitle: 'InCare' }
  return { title: parts.slice(0, -1).join(' '), subtitle: parts.slice(-1)[0] }
}

function SidebarBrand({ collapsed, hospitalName }) {
  const { title, subtitle } = brandLines(hospitalName)
  return (
    <div className={cn('flex h-[4.25rem] items-center border-b border-border', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
      <HospitalLogo size="sm" className="shrink-0" alt={`${hospitalName || 'Hospital'} logo`} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight tracking-tight text-foreground">{title}</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</p>
        </div>
      )}
    </div>
  )
}

function SidebarUser({ collapsed }) {
  const { user } = useAuth()
  const name = user?.name || 'Signed in'
  const roleLabel = user?.roleName || user?.accessRole || user?.role || 'Staff'
  const initials = user?.initials || 'U'

  return (
    <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-3')}>
      <div
        className={cn(
          'flex items-center rounded-md border border-border bg-muted/40',
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function Sidebar({ role, collapsed = false, onToggle, variant = 'docked', onNavigate, onClose }) {
  const location = useLocation()
  const { user } = useAuth()
  const { settings } = useBillingConfig()
  const { getPendingCount } = useServiceEntries()
  const sections = visibleNavSections(role, user)
  const pendingApprovals = role === 'reception' ? getPendingCount() : 0
  const isDrawer = variant === 'drawer'

  const badgeValue = (key) => {
    if (key === 'pendingApprovals') return pendingApprovals
    return 0
  }

  return (
    <aside
      className={cn(
        'no-print flex h-full flex-col bg-card text-foreground',
        isDrawer
          ? cn('absolute left-0 top-0 z-10 h-full border-r border-border shadow-2xl', EXPANDED_WIDTH)
          : cn(
              'fixed left-0 top-0 z-40 hidden h-screen border-r border-border md:flex',
              collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
              'transition-[width] duration-200 ease-out'
            )
      )}
    >
      <SidebarBrand collapsed={!isDrawer && collapsed} hospitalName={settings?.name} />

      {isDrawer && (
        <div className="flex items-center justify-end border-b border-border px-2 py-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2.5 py-4">
        {sections.map((section) => (
          <div key={section.id}>
            {(!collapsed || isDrawer) && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{section.label}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isNavItemActive(location.pathname, item)
                const count = item.badge ? badgeValue(item.badge) : 0
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      end={Boolean(item.end)}
                      title={collapsed && !isDrawer ? item.label : undefined}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        'relative flex items-center rounded-md text-[13px] font-medium transition-colors duration-150',
                        collapsed && !isDrawer ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2',
                        active
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                      )}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-primary" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {(isDrawer || !collapsed) && (
                        <>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {count > 0 && (
                            <span className="min-w-5 rounded bg-amber-500/90 px-1 text-center text-[10px] font-semibold text-white">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarUser collapsed={!isDrawer && collapsed} />

      {!isDrawer && onToggle && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center rounded-md py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}
    </aside>
  )
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH }
