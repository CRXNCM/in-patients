import { useNavigate } from 'react-router-dom'
import { DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import {
  DASHBOARD_FOLD_GRID,
  DASHBOARD_OUTLINE_BUTTON,
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  MetricRing,
  SectionKicker,
} from '@/components/shared/DashboardChrome'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useAdminDashboard } from '@/hooks/useAdminDashboard'
import { useAuth } from '@/context/AuthContext'

const BED_SEGMENTS = [
  { key: 'occupied', label: 'Occupied', className: 'bg-sky-500' },
  { key: 'available', label: 'Available', className: 'bg-emerald-400' },
  { key: 'maintenance', label: 'Maintenance', className: 'bg-amber-400' },
  { key: 'outOfService', label: 'Out of service', className: 'bg-slate-400' },
]

function formatStayDay(dateStr) {
  if (!dateStr) return ''
  const value = String(dateStr).includes('T') ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(value.getTime())) return dateStr
  return value.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' })
}

function locationLabel(stay) {
  const parts = [stay.room, stay.bed].filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}

function admissionTypeLabel(type) {
  return type === 'maternity' ? 'Maternity' : 'Normal'
}

function CensusPanel({ census }) {
  const pending = census.pendingDischarge
  return (
    <DashboardPanel glow aria-labelledby="admin-census-heading">
      <SectionKicker>Hospital census</SectionKicker>
      <h2 id="admin-census-heading" className="sr-only">
        Hospital census
      </h2>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Currently admitted</p>
          <p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums text-sky-700 dark:text-sky-300">
            {census.currentlyAdmitted}
          </p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          ['Admitted today', census.admittedToday, false],
          ['Pending discharge', pending, pending > 0],
          ['Discharged today', census.dischargedToday, false],
        ].map(([label, value, alert]) => (
          <div
            key={label}
            className="rounded-xl border border-white/40 bg-background/50 px-3 py-3 dark:border-white/5 dark:bg-white/5"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? 'text-amber-500' : ''}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </DashboardPanel>
  )
}

function OccupancyPanel({ beds }) {
  const navigate = useNavigate()
  const { hasAnyPermission } = useAuth()
  const canOpenSetup = hasAnyPermission(['departments.view', 'wards.view', 'rooms.view', 'beds.view'])
  const total = beds.total
  const empty = total === 0
  const ariaLabel = empty
    ? 'No beds configured'
    : [
        `${beds.occupancyPercentage}% occupied per all beds`,
        `Occupied ${beds.occupied}`,
        `Available ${beds.available}`,
        `Maintenance ${beds.maintenance}`,
        `Out of service ${beds.outOfService}`,
        `Total ${total}`,
      ].join('. ')

  return (
    <DashboardPanel glow aria-labelledby="admin-beds-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionKicker>Capacity</SectionKicker>
          <h2 id="admin-beds-heading" className="mt-2 text-lg font-semibold tracking-tight">
            Bed occupancy
          </h2>
        </div>
        {canOpenSetup && (
          <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/admin/departments')}>
            Setup
          </Button>
        )}
      </div>

      {empty ? (
        <p className="mt-8 text-sm text-muted-foreground">No beds configured</p>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-6">
            <MetricRing percent={beds.occupancyPercentage} />
            <div>
              <p className="text-sm text-muted-foreground">Available now</p>
              <p className="text-4xl font-semibold tracking-tighter tabular-nums text-emerald-600 dark:text-emerald-400">
                {beds.available}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">occupied / all beds</p>
            </div>
          </div>

          <div
            className="mt-6 flex h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
            role="img"
            aria-label={ariaLabel}
          >
            {BED_SEGMENTS.map((seg) => {
              const count = beds[seg.key] || 0
              if (count <= 0) return null
              return (
                <span
                  key={seg.key}
                  className={seg.className}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              )
            })}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {BED_SEGMENTS.map((seg) => (
              <li key={seg.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${seg.className}`} aria-hidden="true" />
                  {seg.label}
                </span>
                <span className="tabular-nums font-semibold">{beds[seg.key] || 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardPanel>
  )
}

const admissionColumns = [
  {
    key: 'patient',
    header: 'Patient',
    render: (row) => (
      <div className="min-w-[10rem] max-w-xs">
        <p className="font-medium truncate" title={row.name}>{row.name}</p>
        <p className="font-mono text-xs font-medium text-sky-600 dark:text-sky-400">{row.patientId}</p>
      </div>
    ),
  },
  {
    key: 'admissionType',
    header: 'Type',
    render: (row) => admissionTypeLabel(row.admissionType),
  },
  {
    key: 'location',
    header: 'Room / Bed',
    render: (row) => {
      const label = locationLabel(row)
      return label || <span className="text-muted-foreground">—</span>
    },
  },
  {
    key: 'admissionDate',
    header: 'Admitted',
    render: (row) => formatStayDay(row.admissionDate) || <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'dischargeCompletedAt',
    header: 'Discharged',
    render: (row) => (row.dischargeCompletedAt ? formatDateTime(row.dischargeCompletedAt) : ''),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
]

function RecentAdmissionsPanel({ stays, className = '' }) {
  const showCredit = stays.some((stay) => Object.prototype.hasOwnProperty.call(stay, 'isCreditPatient'))
  const columns = showCredit
    ? [
        ...admissionColumns.slice(0, 5),
        {
          key: 'credit',
          header: 'Credit',
          render: (row) => (row.isCreditPatient ? 'Credit' : ''),
        },
        admissionColumns[5],
      ]
    : admissionColumns

  const rows = stays.map((stay) => ({ ...stay, id: stay.patientId }))

  return (
    <DashboardPanel padded={false} className={className} aria-labelledby="admin-admissions-heading">
      <div className="border-b border-primary/10 px-6 py-5 dark:border-white/10">
        <SectionKicker>Activity</SectionKicker>
        <h2 id="admin-admissions-heading" className="mt-2 text-lg font-semibold tracking-tight">
          Recent admissions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Latest 8 stays</p>
      </div>
      <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent">
        <DataTable
          columns={columns}
          data={rows}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">No recent admissions</p>}
        />
      </div>
    </DashboardPanel>
  )
}

const SETUP_FIELDS = [
  { key: 'departments', label: 'Departments' },
  { key: 'wards', label: 'Wards' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'beds', label: 'Beds' },
  { key: 'doctors', label: 'Doctors' },
  { key: 'users', label: 'Users' },
]

function SetupPanel({ setup }) {
  const navigate = useNavigate()
  const { hasPermission, hasAnyPermission } = useAuth()
  const fields = SETUP_FIELDS.filter((item) => setup[item.key] != null)
  const showSetupLink =
    ['departments', 'wards', 'rooms', 'beds'].some((key) => setup[key] != null) &&
    hasAnyPermission(['departments.view', 'wards.view', 'rooms.view', 'beds.view'])
  const showDoctorsLink = setup.doctors != null && hasAnyPermission(['doctors.view', 'doctors.manage'])
  const showUsersLink = setup.users != null && hasPermission('users.view')

  return (
    <DashboardPanel aria-labelledby="admin-setup-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionKicker>System</SectionKicker>
          <h2 id="admin-setup-heading" className="mt-2 text-lg font-semibold tracking-tight">
            Hospital configuration
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Configured records, including inactive.</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-primary/10 sm:grid-cols-3 dark:border-white/10">
        {fields.map((item, index) => (
          <div
            key={item.key}
            className={`bg-background/40 px-4 py-4 dark:bg-white/[0.03] ${index % 2 === 1 ? 'bg-background/70 dark:bg-white/[0.05]' : ''}`}
          >
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{setup[item.key]}</dd>
          </div>
        ))}
      </dl>
      {(showSetupLink || showDoctorsLink || showUsersLink) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {showSetupLink && (
            <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/admin/departments')}>
              Hospital Setup
            </Button>
          )}
          {showDoctorsLink && (
            <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/admin/doctors')}>
              Doctors
            </Button>
          )}
          {showUsersLink && (
            <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/admin/users')}>
              Users
            </Button>
          )}
        </div>
      )}
    </DashboardPanel>
  )
}

function CatalogPanel({ catalog }) {
  const navigate = useNavigate()
  const { hasAnyPermission } = useAuth()
  const showServices = hasAnyPermission(['system.view_settings', 'system.modify_settings'])

  return (
    <DashboardPanel aria-labelledby="admin-catalog-heading">
      <SectionKicker>Catalog</SectionKicker>
      <h2 id="admin-catalog-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Service catalog
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Pricing catalog size.</p>
      <dl className="mt-6 space-y-4">
        <div className="rounded-xl border border-primary/10 bg-background/50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Service categories</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{catalog.serviceCategories}</dd>
        </div>
        <div className="rounded-xl border border-primary/10 bg-background/50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Price lines</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{catalog.priceLines}</dd>
        </div>
      </dl>
      {showServices && (
        <Button type="button" variant="outline" size="sm" className={`mt-5 ${DASHBOARD_OUTLINE_BUTTON}`} onClick={() => navigate('/admin/services')}>
          Services
        </Button>
      )}
    </DashboardPanel>
  )
}

function FinanceCreditPanel({ finance, credit }) {
  const title = finance && credit ? 'Payments & credit' : finance ? 'Payments' : 'Credit admissions'
  return (
    <DashboardPanel aria-labelledby="admin-finance-heading">
      <SectionKicker>Ledger</SectionKicker>
      <h2 id="admin-finance-heading" className="mt-2 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Operational totals only. Revenue reports stay on the manager dashboard.
      </p>
      <dl className={`mt-5 grid gap-4${finance && credit ? ' sm:grid-cols-2' : ''}`}>
        {finance && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Today’s deposits</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(finance.todayDeposits)}</dd>
          </div>
        )}
        {credit && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Open credit admissions</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{credit.creditAdmissions}</dd>
          </div>
        )}
      </dl>
    </DashboardPanel>
  )
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminDashboard()
  const refresh = (
    <Button type="button" variant="outline" size="sm" className={`${DASHBOARD_OUTLINE_BUTTON} bg-background/60`} onClick={reload}>
      Sync data
    </Button>
  )

  if (loading) {
    return (
      <DashboardFrame busy>
        <DashboardHero
          title="Command overview"
          description="Live census, bed capacity, and hospital configuration."
          action={refresh}
        />
        <DashboardPanel className="px-6 py-16 text-center text-sm text-muted-foreground">
          Synchronizing hospital overview…
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  if (error || !data) {
    return (
      <DashboardFrame>
        <DashboardHero title="Command overview" description="Live census, bed capacity, and hospital configuration." />
        <DashboardPanel>
          <p className="mb-4 text-sm text-muted-foreground">{error || 'Failed to load dashboard'}</p>
          <Button type="button" onClick={reload}>Retry</Button>
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  const showCensus = Boolean(data.census)
  const showBeds = Boolean(data.beds)
  const showRecent = Array.isArray(data.recentAdmissions)
  const showSetup = Boolean(data.setup) && Object.keys(data.setup).length > 0
  const showCatalog = Boolean(data.catalog)
  const showFinance = Boolean(data.finance)
  const showCredit = Boolean(data.credit)
  const showMoney = showFinance || showCredit
  const foldClass = showCensus && showBeds ? DASHBOARD_FOLD_GRID : 'grid gap-5'
  const secondaryClass = showSetup && showCatalog ? DASHBOARD_FOLD_GRID : 'grid gap-5'

  return (
    <DashboardFrame>
      <DashboardHero
        title="Command overview"
        description="Live census, bed capacity, and hospital configuration."
        generatedAt={data.generatedAt}
        action={refresh}
      />

      {(showCensus || showBeds) && (
        <div className={foldClass}>
          {showCensus && (
            <div className={showBeds ? 'lg:col-span-7' : undefined}>
              <CensusPanel census={data.census} />
            </div>
          )}
          {showBeds && (
            <div className={showCensus ? 'lg:col-span-5' : undefined}>
              <OccupancyPanel beds={data.beds} />
            </div>
          )}
        </div>
      )}

      {showRecent && <RecentAdmissionsPanel stays={data.recentAdmissions} />}

      {(showSetup || showCatalog) && (
        <div className={secondaryClass}>
          {showSetup && (
            <div className={showCatalog ? 'lg:col-span-8' : undefined}>
              <SetupPanel setup={data.setup} />
            </div>
          )}
          {showCatalog && (
            <div className={showSetup ? 'lg:col-span-4' : undefined}>
              <CatalogPanel catalog={data.catalog} />
            </div>
          )}
        </div>
      )}

      {showMoney && (
        <FinanceCreditPanel finance={showFinance ? data.finance : null} credit={showCredit ? data.credit : null} />
      )}

      {!showCensus && !showBeds && !showRecent && !showSetup && !showCatalog && !showMoney && (
        <DashboardPanel className="text-sm text-muted-foreground">
          No dashboard sections are available for this account.
        </DashboardPanel>
      )}
    </DashboardFrame>
  )
}
