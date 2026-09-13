import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge, DataTable } from '@/components/shared/CommonComponents'
import {
  DASHBOARD_OUTLINE_BUTTON,
  DASHBOARD_TILE,
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  SectionKicker,
} from '@/components/shared/DashboardChrome'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { useReceptionDashboard } from '@/hooks/useReceptionDashboard'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/api/client'

function isForbiddenError(message) {
  return /forbidden/i.test(message || '')
}

function locationLabel(row) {
  const parts = [row.room, row.bed].filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

function MetricTile({ label, value, subtitle, alert, onClick }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`${DASHBOARD_TILE} w-full px-4 py-4 text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${alert ? 'text-amber-500' : ''}`}>
        {value}
      </p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </button>
  )
}

export default function ReceptionDashboard() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const { data, loading, error, reload } = useReceptionDashboard()

  const actions = (
    <div className="flex flex-wrap gap-2">
      {hasPermission('admissions.create') ? (
        <Button type="button" size="sm" onClick={() => navigate('/reception/add-patient')}>
          Add Patient
        </Button>
      ) : null}
    </div>
  )

  const hero = {
    kicker: 'Reception',
    title: 'Reception Dashboard',
    description: 'Manage admitted patients, approve nurse records, and process billing',
  }

  if (loading) {
    return (
      <DashboardFrame busy>
        <DashboardHero {...hero} action={actions} />
        <DashboardPanel className="px-6 py-16 text-center text-sm text-muted-foreground">
          Synchronizing reception overview…
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
          <p className="text-sm font-medium">
            {forbidden
              ? 'You do not have permission to view the Reception Dashboard.'
              : 'The Reception Dashboard could not be loaded.'}
          </p>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{error || 'Failed to load dashboard'}</p>
          <Button type="button" onClick={reload}>
            Retry
          </Button>
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  const census = data.census || { admitted: 0, pendingDischarge: 0 }
  const pendingApprovals = data.workQueue?.pendingApprovals ?? 0
  const pendingDischarges = data.workQueue?.pendingDischarges ?? census.pendingDischarge
  const todayDeposits = data.finance?.todayDeposits
  const lowBalanceCount = data.watchlist?.lowBalanceCount
  const pendingRecords = data.pendingRecords || []
  const inpatients = data.currentInpatients || []
  const includeMoney = inpatients.some((row) => Object.prototype.hasOwnProperty.call(row, 'deposit'))
  const canReview = Boolean(data.canReview)

  const handleApprove = async (record) => {
    try {
      await api.approveRecord(record.id)
      toast({ title: 'Approved', variant: 'success' })
      reload()
    } catch (err) {
      toast({ title: 'Approve failed', description: err.message, variant: 'destructive' })
    }
  }

  const handleReject = async (record) => {
    try {
      await api.rejectRecord(record.id, 'Rejected from dashboard')
      toast({ title: 'Rejected', variant: 'success' })
      reload()
    } catch (err) {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' })
    }
  }

  const columns = [
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-sky-600 dark:text-sky-400">{row.id}</span> },
    { key: 'name', header: 'Patient Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'room', header: 'Room/Bed', render: (row) => locationLabel(row) },
    { key: 'admissionDate', header: 'Admission Date', render: (row) => formatDate(row.admissionDate) },
  ]

  if (includeMoney) {
    columns.push(
      { key: 'deposit', header: 'Deposit', render: (row) => formatCurrency(row.deposit) },
      { key: 'totalCharges', header: 'Approved Charges', render: (row) => formatCurrency(row.totalCharges) },
      {
        key: 'remaining',
        header: 'Remaining Balance',
        render: (row) => (
          <div>
            <span className={row.remaining >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
              {formatCurrency(row.remaining)}
            </span>
            {row.pendingCharges > 0 && (
              <p className="text-xs text-amber-600">+{formatCurrency(row.pendingCharges)} pending</p>
            )}
          </div>
        ),
      },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.balanceStatus} /> }
    )
  }

  columns.push({
    key: 'actions',
    header: 'Actions',
    render: (row) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/reception/patient/${row.id}`)
        }}
      >
        View
      </Button>
    ),
  })

  return (
    <DashboardFrame>
      <DashboardHero
        kicker={hero.kicker}
        title={hero.title}
        description={hero.description}
        generatedAt={data.generatedAt}
        action={actions}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Total admitted patients" value={census.admitted} subtitle="Currently in hospital" />
        <MetricTile label="Pending approvals" value={pendingApprovals} subtitle="Records to review" alert={pendingApprovals > 0} />
        {todayDeposits !== undefined && (
          <MetricTile label="Today’s deposits" value={formatCurrency(todayDeposits)} subtitle="Collected today" />
        )}
        {lowBalanceCount !== undefined && (
          <MetricTile label="Patients with low balance" value={lowBalanceCount} subtitle="Below 2× threshold" alert={lowBalanceCount > 0} />
        )}
        <MetricTile
          label="Pending discharges"
          value={pendingDischarges}
          subtitle="Awaiting clearance"
          alert={pendingDischarges > 0}
          onClick={() => navigate('/reception/pending-discharges')}
        />
      </div>

      <DashboardPanel padded={false} aria-labelledby="reception-pending-heading">
        <div className="flex flex-col gap-3 border-b border-primary/10 px-6 py-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
          <div>
            <SectionKicker>Queue</SectionKicker>
            <h2 id="reception-pending-heading" className="mt-2 text-lg font-semibold tracking-tight">
              Pending records ({pendingApprovals})
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Review nurse daily records and pharmacy returns</p>
          </div>
          <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/reception/approvals')}>
            View All
          </Button>
        </div>
        {pendingRecords.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No pending records.</p>
        ) : (
          <div className="divide-y divide-primary/10 dark:divide-white/10">
            {pendingRecords.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{record.recordName}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {record.itemCount} item(s)
                    {includeMoney ? ` · ${formatCurrency(Math.abs(record.amount))}${record.amount < 0 ? ' credit' : ''}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.patientName || record.patientId}
                    {record.recordedBy ? ` · By ${record.recordedBy}` : ''}
                    {record.recordedAt ? ` · ${formatDateTime(record.recordedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status="pending" />
                  {canReview && (
                    <>
                      <Button size="sm" variant="outline" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => handleApprove(record)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => handleReject(record)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel
        padded={false}
        className="-mx-4 rounded-none md:-mx-6 md:rounded-2xl lg:-mx-8"
        aria-labelledby="reception-admitted-heading"
      >
        <div className="flex flex-col gap-3 border-b border-primary/10 px-6 py-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
          <div>
            <SectionKicker>Census list</SectionKicker>
            <h2 id="reception-admitted-heading" className="mt-2 text-lg font-semibold tracking-tight">
              Admitted patients
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Balances reflect approved charges only</p>
          </div>
          <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/reception/patients')}>
            View All
          </Button>
        </div>
        <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&_td]:px-3 [&_th]:px-3">
          <DataTable
            columns={columns}
            data={inpatients}
            onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
            emptyState={<p className="py-10 text-center text-sm text-muted-foreground">No current inpatients.</p>}
          />
        </div>
      </DashboardPanel>
    </DashboardFrame>
  )
}
