import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Moon, Sun, Menu, LogOut, ChevronDown, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { cn, formatDateTime } from '@/lib/utils'

const roleLabels = {
  reception: 'Reception',
  nurse: 'Nurse',
  admin: 'Administrator',
  manager: 'Manager',
}

export function TopNav({ role, sidebarCollapsed, onMenuClick }) {
  const { darkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const { user: authUser, logout } = useAuth()
  const displayName = authUser?.name || 'User'
  const displayInitials = authUser?.initials || 'U'
  const [showNotifications, setShowNotifications] = useState(false)

  const {
    notifications,
    getUnreadNotificationCount,
    getPendingCount,
    markNotificationsRead,
  } = useServiceEntries()

  const unreadCount = role === 'reception' ? getUnreadNotificationCount() : 0
  const pendingCount = role === 'reception' ? getPendingCount() : 0
  const receptionNotifications = notifications.filter((n) => n.targetRole === 'reception')

  const handleBellClick = () => {
    setShowNotifications((prev) => !prev)
    if (!showNotifications) markNotificationsRead()
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-4 transition-all duration-300 no-print',
        sidebarCollapsed ? 'left-[72px]' : 'left-64',
        'max-md:left-0'
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden sm:block max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search patients, services..." className="pl-9 bg-muted/50 border-0" />
        </div>
        {role === 'reception' && pendingCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
            onClick={() => navigate('/reception/approvals')}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            {pendingCount} Pending
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDarkMode} title="Toggle dark mode">
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="relative" onClick={handleBellClick}>
            <Bell className="h-5 w-5" />
            {role === 'reception' && (unreadCount > 0 || pendingCount > 0) && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {Math.max(unreadCount, pendingCount)}
              </span>
            )}
          </Button>

          {showNotifications && role === 'reception' && (
            <div className="absolute right-0 top-12 w-80 rounded-xl border bg-card shadow-lg z-50">
              <div className="p-3 border-b font-semibold text-sm">Notifications</div>
              <div className="max-h-72 overflow-y-auto">
                {receptionNotifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
                ) : (
                  receptionNotifications.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      className={cn(
                        'w-full text-left p-3 border-b hover:bg-muted/50 transition-colors',
                        !n.read && 'bg-amber-50/50 dark:bg-amber-950/20'
                      )}
                      onClick={() => {
                        navigate('/reception/approvals')
                        setShowNotifications(false)
                      }}
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                    </button>
                  ))
                )}
              </div>
              {pendingCount > 0 && (
                <div className="p-2 border-t">
                  <Button size="sm" className="w-full" onClick={() => { navigate('/reception/approvals'); setShowNotifications(false) }}>
                    Review {pendingCount} Pending Charges
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {displayInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:block">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout()
            navigate('/login')
          }}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
