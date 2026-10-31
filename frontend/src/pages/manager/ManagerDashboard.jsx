import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { StatusBadge, DataTable } from '@/components/shared/CommonComponents'
import {
  DASHBOARD_FOLD_GRID,
  DASHBOARD_OUTLINE_BUTTON,
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  SectionKicker,
} from '@/components/shared/DashboardChrome'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useManagerDashboard } from '@/hooks/useManagerDashboard'
import { PatientLink } from '@/components/shared/PatientLink'

const CHART_STROKE = 'hsl(var(--primary))'
const DEPOSIT_FILL = 'hsl(var(--primary))'
const CHARGE_FILL = 'hsl(217, 70%, 48%)'

function periodRangeLabel(row) {
  if (!row?.startDate || !row?.endDate) return ''
  return `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`
}

function periodChartRows(comparison) {
  if (!comparison?.week || !comparison?.month) return []
  return [
    comparison.week.previous,
    comparison.week.current,
    comparison.month.previous,
    comparison.month.current,
  ].filter(Boolean)
}

function PeriodComparisonPanel({ comparison }) {
  const rows = periodChartRows(comparison)
  if (!rows.length) return null
  return (
    <DashboardPanel aria-labelledby="manager-period-heading">
      <SectionKicker>Comparison</SectionKicker>
      <h2 id="manager-period-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Last week and month vs this week and month
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This week is Monday through today. This month is the 1st through today. Last week and last month are complete periods.
      </p>
      <div className="mt-6 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={6} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip
              formatter={(value, name) => [formatCurrency(value), name]}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload
                const range = periodRangeLabel(row)
                return range ? `${label} (${range})` : label
              }}
            />
            <Legend />
            <Bar dataKey="deposits" name="Deposits" fill={DEPOSIT_FILL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="charges" name="Approved charges" fill={CHARGE_FILL} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-primary/10 bg-background/50 p-3 dark:border-white/10">
            <p className="text-sm font-medium">{row.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{periodRangeLabel(row)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Deposits</p>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.deposits)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Approved charges</p>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.charges)}</p>
          </div>
        ))}
      </div>
    </DashboardPanel>
  )
}

function isForbiddenError(message) {
  return /forbidden/i.test(message || '')
}

function StatRow({ label, value, alert }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${alert ? 'text-warning' : ''}`}>{value}</span>
    </div>
  )
}

function FinancePanel({ finance }) {
  return (
    <DashboardPanel glow aria-labelledby="manager-finance-heading">
      <SectionKicker>Ledger</SectionKicker>
      <h2 id="manager-finance-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Cash and approved charges
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Today’s deposits" value={formatCurrency(finance.deposits.today)} />
        <MetricTile label="Monthly deposits" value={formatCurrency(finance.deposits.month)} />
        <MetricTile label="Today’s charges" value={formatCurrency(finance.approvedCharges.today)} />
        <MetricTile label="Monthly charges" value={formatCurrency(finance.approvedCharges.month)} />
        {(finance.inpatientCharges || finance.emergencyCharges) && (
          <>
            <MetricTile label="Inpatient surcharge today (1.25×)" value={formatCurrency((finance.inpatientCharges || finance.emergencyCharges).today || 0)} />
            <MetricTile label="Inpatient surcharge this month (1.25×)" value={formatCurrency((finance.inpatientCharges || finance.emergencyCharges).month || 0)} />
          </>
        )}
        <MetricTile
          label="Discharge amount"
          value={formatCurrency(finance.dischargeAmount?.today || 0)}
          subtitle="Today · billed at completion"
        />
        <MetricTile
          label="Monthly discharge amount"
          value={formatCurrency(finance.dischargeAmount?.month || 0)}
          subtitle="This month · billed at completion"
        />
      </div>
      {(finance.outstandingBalance !== undefined || finance.creditAdmissions !== undefined) && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {finance.outstandingBalance !== undefined && (
            <MetricTile
              label="Outstanding balance"
              value={formatCurrency(finance.outstandingBalance)}
              alert={finance.outstandingBalance > 0}
            />
          )}
          {finance.creditAdmissions !== undefined && (
            <MetricTile label="Credit admissions" value={finance.creditAdmissions} />
          )}
        </div>
      )}
    </DashboardPanel>
  )
}

function CensusPanel({ census }) {
  return (
    <DashboardPanel aria-labelledby="manager-census-heading">
      <SectionKicker>Utilization</SectionKicker>
      <h2 id="manager-census-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Patient census
      </h2>
      <div className="mt-6 divide-y divide-primary/10 dark:divide-white/10">
        <StatRow label="Admitted" value={census.admitted} />
        <StatRow label="Pending" value={census.pendingDischarge} alert={census.pendingDischarge > 0} />
        <StatRow label="Admitted today" value={census.admittedToday} />
        <StatRow label="Discharged" value={census.dischargedToday} />
        <StatRow label="Emergency OPD active" value={census.emergencyOpdActive || 0} />
        <StatRow label="Converted from Emergency OPD" value={census.emergencyOpdConverted || 0} />
      </div>
    </DashboardPanel>
  )
}

function UtilizationPanel({ occupancy }) {
  return (
    <DashboardPanel aria-labelledby="manager-beds-heading">
      <SectionKicker>Capacity</SectionKicker>
      <h2 id="manager-beds-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Bed utilization
      </h2>
      {occupancy.total === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No beds configured</p>
      ) : (
        <div className="mt-6 divide-y divide-primary/10 dark:divide-white/10">
          <StatRow label="Occupancy" value={`${occupancy.percentage}%`} />
          <StatRow label="Occupied" value={occupancy.occupied} />
          <StatRow label="Available" value={occupancy.available} />
          <StatRow label="Maintenance" value={occupancy.maintenance} />
          {occupancy.outOfService > 0 && <StatRow label="Out of service" value={occupancy.outOfService} />}
        </div>
      )}
    </DashboardPanel>
  )
}

function categoryShare(rows) {
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  return rows.map((row) => ({
    ...row,
    percent: total === 0 ? 0 : Math.round(((Number(row.amount) || 0) / total) * 100),
  }))
}

function CategoryMix({ rows }) {
  if (!rows.length) {
    return <p className="mt-8 text-sm text-muted-foreground">No approved charges yet.</p>
  }
  return (
    <div className="mt-6 space-y-3">
      {categoryShare(rows).map((row) => (
        <div key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{row.name}</span>
            <span className="tabular-nums text-muted-foreground">{row.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${row.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RankedList({ items, empty, valueKey = 'amount' }) {
  if (!items.length) {
    return <p className="mt-8 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="mt-6 space-y-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-baseline justify-between gap-4 py-1.5">
          <p className="min-w-0 truncate text-sm font-medium">{item.name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {valueKey === 'count' ? item.count : formatCurrency(item.amount)}
          </p>
        </div>
      ))}
    </div>
  )
}

const watchColumns = [
  {
    key: 'patient',
    header: 'Patient',
    render: (row) => (
      <div className="min-w-[8rem]">
        <p className="truncate font-medium" title={row.patientName}>
          <PatientLink patientId={row.id}>{row.patientName}</PatientLink>
        </p>
        <p className="font-mono text-xs text-primary">
          <PatientLink patientId={row.id}>{row.id}</PatientLink>
        </p>
      </div>
    ),
  },
  {
    key: 'remaining',
    header: 'Balance',
    render: (row) => (
      <span className={`tabular-nums font-medium ${row.remaining < 0 ? 'text-warning' : ''}`}>
        {formatCurrency(row.remaining ?? 0)}
      </span>
    ),
  },
]

const admissionColumns = [
  {
    key: 'patient',
    header: 'Patient',
    render: (row) => (
      <div className="min-w-[8rem]">
        <p className="truncate font-medium" title={row.patientName}>
          <PatientLink patientId={row.id}>{row.patientName}</PatientLink>
        </p>
        <p className="font-mono text-xs text-primary">
          <PatientLink patientId={row.id}>{row.id}</PatientLink>
        </p>
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
]

function TablePanel({ id, kicker, title, columns, rows, empty }) {
  return (
    <DashboardPanel padded={false} aria-labelledby={id}>
      <div className="border-b border-primary/10 px-6 py-5 dark:border-white/10">
        <SectionKicker>{kicker}</SectionKicker>
        <h2 id={id} className="mt-2 text-lg font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent">
        <DataTable
          columns={columns}
          data={rows}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>}
        />
      </div>
    </DashboardPanel>
  )
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useManagerDashboard()

  const refresh = (
    <Button type="button" variant="outline" size="sm" className={`${DASHBOARD_OUTLINE_BUTTON} bg-background/60`} onClick={reload}>
      Refresh
    </Button>
  )

  const hero = {
    kicker: 'Finance',
    title: 'Executive Dashboard',
    description: 'Hospital performance & financial overview',
  }

  if (loading) {
    return (
      <DashboardFrame busy>
        <DashboardHero {...hero} action={refresh} />
        <DashboardPanel padded={false}>
          <LoadingState message="Synchronizing financial overview…" />
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  if (error || !data) {
    const forbidden = isForbiddenError(error)
    return (
      <DashboardFrame>
        <DashboardHero {...hero} />
        <DashboardPanel>
          <ErrorState
            title={
              forbidden
                ? 'You do not have permission to view the Manager Dashboard.'
                : 'The Manager Dashboard could not be loaded.'
            }
            message={error || 'Failed to load dashboard'}
            onRetry={reload}
          />
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  const finance = data.finance
  const census = data.census
  const occupancy = data.occupancy
  const chargesByCategory = data.chargesByCategory || []
  const dailyChargesTrend = data.dailyChargesTrend || []
  const topServices = data.topServices || []
  const topMedicines = data.topMedicines || []
  const watchlist = data.watchlist
  const showRecent = Array.isArray(data.recentAdmissions)
  const recentAdmissions = data.recentAdmissions || []
  const watchRows = watchlist?.lowBalancePatients || []
  const showUtil = Boolean(census || occupancy)
  const utilClass = census && occupancy ? DASHBOARD_FOLD_GRID : 'grid gap-5'
  const pairClass = DASHBOARD_FOLD_GRID
  const empty = !finance && !occupancy && !census && !watchlist && !showRecent

  return (
    <DashboardFrame>
      <DashboardHero
        kicker={hero.kicker}
        title={hero.title}
        description={hero.description}
        generatedAt={data.generatedAt}
        action={refresh}
      />

      {finance && <FinancePanel finance={finance} />}

      {finance && data.periodComparison && <PeriodComparisonPanel comparison={data.periodComparison} />}

      {showUtil && (
        <div className={utilClass}>
          {census && (
            <div className={occupancy ? 'lg:col-span-6' : undefined}>
              <CensusPanel census={census} />
            </div>
          )}
          {occupancy && (
            <div className={census ? 'lg:col-span-6' : undefined}>
              <UtilizationPanel occupancy={occupancy} />
            </div>
          )}
        </div>
      )}

      {finance && (
        <div className={pairClass}>
          <div className="lg:col-span-7">
            <DashboardPanel aria-labelledby="manager-trend-heading">
              <SectionKicker>Trend</SectionKicker>
              <h2 id="manager-trend-heading" className="mt-2 text-lg font-semibold tracking-tight">
                Approved charges — 7 days
              </h2>
              <div className="mt-6 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChargesTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="amount" stroke={CHART_STROKE} strokeWidth={2} dot={{ fill: CHART_STROKE }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DashboardPanel>
          </div>
          <div className="lg:col-span-5">
            <DashboardPanel aria-labelledby="manager-category-heading">
              <SectionKicker>Mix</SectionKicker>
              <h2 id="manager-category-heading" className="mt-2 text-lg font-semibold tracking-tight">
                Charges by category
              </h2>
              <CategoryMix rows={chargesByCategory} />
            </DashboardPanel>
          </div>
        </div>
      )}

      {(watchlist || showRecent) && (
        <div className={watchlist && showRecent ? pairClass : 'grid gap-5'}>
          {watchlist && (
            <div className={showRecent ? 'lg:col-span-6' : undefined}>
              <TablePanel
                id="manager-watch-heading"
                kicker="Attention"
                title="Balance attention"
                columns={watchColumns}
                rows={watchRows}
                empty="No stays on the balance watch list."
              />
            </div>
          )}
          {showRecent && (
            <div className={watchlist ? 'lg:col-span-6' : undefined}>
              <TablePanel
                id="manager-admissions-heading"
                kicker="Activity"
                title="Recent admissions"
                columns={admissionColumns}
                rows={recentAdmissions}
                empty="No current inpatients."
              />
            </div>
          )}
        </div>
      )}

      {finance && (
        <div className={pairClass}>
          <div className="lg:col-span-6">
            <DashboardPanel aria-labelledby="manager-services-heading">
              <SectionKicker>Services</SectionKicker>
              <h2 id="manager-services-heading" className="mt-2 text-lg font-semibold tracking-tight">
                Top services
              </h2>
              <RankedList items={topServices} empty="No approved services yet." valueKey="amount" />
            </DashboardPanel>
          </div>
          <div className="lg:col-span-6">
            <DashboardPanel aria-labelledby="manager-meds-heading">
              <SectionKicker>Pharmacy</SectionKicker>
              <h2 id="manager-meds-heading" className="mt-2 text-lg font-semibold tracking-tight">
                Top medicines
              </h2>
              <RankedList items={topMedicines} empty="No pharmacy records yet." valueKey="count" />
            </DashboardPanel>
          </div>
        </div>
      )}

      <div className="flex justify-center pb-2">
        <Button type="button" className="min-w-[12rem]" onClick={() => navigate('/manager/reports')}>
          View Reports
        </Button>
      </div>

      {empty && (
        <DashboardPanel className="text-sm text-muted-foreground">
          No dashboard sections are available for this account.
        </DashboardPanel>
      )}
    </DashboardFrame>
  )
}
