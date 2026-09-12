import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { cn } from '@/lib/utils'

export function AppLayout({ role }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={role}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r">
            <Sidebar role={role} collapsed={false} onToggle={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <TopNav
        role={role}
        sidebarCollapsed={sidebarCollapsed}
        onMenuClick={() => setMobileOpen(true)}
      />

      <main
        className={cn(
          'pt-16 transition-all duration-300 min-h-screen',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-64'
        )}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
