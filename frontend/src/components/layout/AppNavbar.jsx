import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bed, Bell, Building2, ChevronDown, CircleHelp, LayoutGrid, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, Stethoscope, Sun, UserCog, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { usePatients } from '@/context/PatientsContext'
import { useTheme } from '@/context/ThemeContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { getPageContext } from '@/lib/navigation'
import { hasAnyPermission } from '@/lib/permissions'
import { cn, formatDateTime } from '@/lib/utils'

function useDismissable(open, onClose) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return ref
}

function PageContext({ role }) {
  const { pathname } = useLocation()
  const { getPatient } = usePatients()
  const stayId = pathname.match(/\/patient\/([^/]+)$/)?.[1]
  const entityLabel = stayId ? getPatient(stayId)?.name : undefined
  const { crumbs } = getPageContext(pathname, role, { entityLabel })

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${index}`}>
            {index > 0 && <span className="mx-1.5 text-muted-foreground/50">/</span>}
            {last || !crumb.to ? (
              <span className={last ? 'font-medium text-foreground' : 'text-muted-foreground'}>{crumb.label}</span>
            ) : (
              <Link
                to={crumb.to}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

const SEARCH_GROUP_ORDER = [
  { key: 'patients', label: 'Patients', icon: Users },
  { key: 'doctors', label: 'Doctors', icon: Stethoscope },
  { key: 'rooms', label: 'Rooms', icon: Building2 },
  { key: 'beds', label: 'Beds', icon: Bed },
  { key: 'departments', label: 'Departments', icon: LayoutGrid },
  { key: 'wards', label: 'Wards', icon: Building2 },
  { key: 'users', label: 'Users', icon: UserCog },
]

function flattenSearchItems(groups = {}) {
  return SEARCH_GROUP_ORDER.flatMap((group) => (groups[group.key]?.items || []).map((row) => ({ ...row, group: group.key })))
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const boxRef = useDismissable(open, () => setOpen(false))
  const requestId = useRef(0)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setPayload(null)
      setError(null)
      setLoading(false)
      return undefined
    }
    if (!USE_API) {
      setError('Search requires the live API.')
      setPayload(null)
      setLoading(false)
      setOpen(true)
      return undefined
    }

    setLoading(true)
    setError(null)
    setOpen(true)
    const id = ++requestId.current
    const timer = window.setTimeout(() => {
      api
        .search(q)
        .then((data) => {
          if (id !== requestId.current) return
          setPayload(data)
          setActiveIndex(0)
        })
        .catch((err) => {
          if (id !== requestId.current) return
          setPayload(null)
          setError(err.message || 'Search failed')
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false)
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [value])

  const items = flattenSearchItems(payload?.groups)
  const openResult = (row) => {
    if (!row?.route) return
    setOpen(false)
    setValue('')
    navigate(row.route)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || items.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % items.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = items[activeIndex] || items[0]
      openResult(row)
    }
  }

  return (
    <div className="relative hidden min-w-0 max-w-sm flex-1 lg:block" ref={boxRef}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          if (value.trim().length >= 2) setOpen(true)
        }}
        onKeyDown={onKeyDown}
        placeholder="Search patients, admissions, doctors..."
        aria-label="Global search"
        aria-expanded={open}
        aria-controls="global-search-results"
        autoComplete="off"
        className="h-9 border-border/80 bg-muted/40 pl-8 text-sm"
      />
      {open && value.trim().length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 max-h-80 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-md"
        >
          {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
          {!loading && error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results found</p>
          )}
          {!loading && !error && SEARCH_GROUP_ORDER.map((group) => {
            const rows = payload?.groups?.[group.key]?.items || []
            if (!rows.length) return null
            const Icon = group.icon
            return (
              <div key={group.key} className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </p>
                {rows.map((row) => {
                  const index = items.findIndex((item) => item.type === row.type && item.id === row.id)
                  const active = index === activeIndex
                  const clickable = Boolean(row.route)
                  return (
                    <button
                      key={`${row.type}-${row.id}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!clickable}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm',
                        active ? 'bg-primary/10' : 'hover:bg-muted/60',
                        !clickable && 'cursor-default opacity-80'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openResult(row)}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[row.subtitle, row.meta].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NotificationControl({ role }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useDismissable(open, () => setOpen(false))
  const reception = role === 'reception'
  const { notifications, getUnreadNotificationCount, getPendingCount, markNotificationsRead } = useServiceEntries()
  const unreadCount = reception ? getUnreadNotificationCount() : 0
  const pendingCount = reception ? getPendingCount() : 0
  const items = reception ? notifications.filter((n) => n.targetRole === 'reception') : []
  const badge = unreadCount > 0 ? unreadCount : pendingCount > 0 ? pendingCount : 0

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label={badge > 0 ? `Notifications, ${badge} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open && reception) markNotificationsRead()
        }}
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {badge}
          </span>
        )}
      </Button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-md border border-border bg-card shadow-md">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Notifications</div>
          <div className="max-h-72 overflow-y-auto">
            {!reception ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications for this account.</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              items.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'w-full border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted/60',
                    !item.read && 'bg-primary/5'
                  )}
                  onClick={() => {
                    navigate('/reception/approvals')
                    setOpen(false)
                  }}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
          {reception && pendingCount > 0 && (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => {
                  navigate('/reception/approvals')
                  setOpen(false)
                }}
              >
                Review {pendingCount} pending charges
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HelpControl() {
  const [open, setOpen] = useState(false)
  const panelRef = useDismissable(open, () => setOpen(false))

  return (
    <div className="relative hidden sm:block" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Help"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
      {open && (
        <div role="dialog" aria-label="Help" className="absolute right-0 top-11 z-50 w-64 rounded-md border border-border bg-card p-3 text-sm shadow-md">
          <p className="font-medium">Help</p>
          <p className="mt-1 text-muted-foreground">In-app help is not available yet.</p>
        </div>
      )}
    </div>
  )
}

function UserMenu({ role }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useDismissable(open, () => setOpen(false))
  const name = user?.name || 'Signed in'
  const roleLabel = user?.roleName || user?.accessRole || user?.role || 'Staff'
  const initials = user?.initials || 'U'
  const canOpenSettings = role === 'admin' && hasAnyPermission(user, ['system.view_settings', 'system.modify_settings'])

  const signOut = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 max-w-[10rem] text-left md:block">
          <span className="block truncate text-sm font-medium leading-tight">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-md border border-border bg-card py-1 shadow-md">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          {canOpenSettings && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                setOpen(false)
                navigate('/admin/settings')
              }}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          )}
          <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AppNavbar({ role, sidebarCollapsed, onToggleSidebar, onOpenMobile }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()

  return (
    <header
      className={cn(
        'no-print fixed right-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-3 sm:px-4',
        'left-0 md:transition-[left] md:duration-200 md:ease-out',
        sidebarCollapsed ? 'md:left-[4.5rem]' : 'md:left-64'
      )}
    >
      <div className="flex min-w-0 shrink items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          aria-label="Open navigation"
          onClick={onOpenMobile}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 md:inline-flex"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        <PageContext role={role} />
      </div>

      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <NotificationControl role={role} />
        <HelpControl />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleDarkMode}
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="ml-1 border-l border-border pl-2">
          <UserMenu role={role} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
