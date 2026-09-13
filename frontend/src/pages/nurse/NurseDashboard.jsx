import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { StatusBadge, DataTable } from '@/components/shared/CommonComponents'
import {
  DASHBOARD_FOLD_GRID,
  DASHBOARD_OUTLINE_BUTTON,
  DASHBOARD_TILE,
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  SectionKicker,
} from '@/components/shared/DashboardChrome'
import { formatDateTime } from '@/lib/utils'
import { useNurseDashboard } from '@/hooks/useNurseDashboard'

function formatStayDay(dateStr) {
  if (!dateStr) return '—'
  const value = String(dateStr).includes('T') ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(value.getTime())) return dateStr
  return value.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' })
}

function locationLabel(row) {
  const parts = [row.room, row.bed].filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

function admissionTypeLabel(type) {
  return type === 'maternity' ? 'Maternity' : 'Normal'
}

function recordTypeLabel(type) {
  if (type === 'pharmacy_return') return 'Pharmacy Return'
  if (type === 'manual') return 'Manual'
  return 'Daily Services'
}

function doctorNames(assignedDoctors) {
  const names = (assignedDoctors || []).map((row) => row.doctorName).filter(Boolean)
  return names.length ? names.join(', ') : '—'
}

function isForbiddenError(message) {
  return /forbidden/i.test(message || '')
}

function CensusPanel({ census, myPendingRecords }) {
  const pending = census.pendingDischarge
  return (
    <DashboardPanel glow aria-labelledby="nurse-census-heading">
      <SectionKicker>Ward census</SectionKicker>
      <h2 id="nurse-census-heading" className="sr-only">
        Ward census
      </h2>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Currently admitted</p>
          <p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums text-sky-700 dark:text-sky-300">
            {census.admitted}
          </p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {[
          ['Pending discharge', pending, pending > 0],
          ['My pending records', myPendingRecords, myPendingRecords > 0],
        ].map(([label, value, alert]) => (
          <div key={label} className={`${DASHBOARD_TILE} px-3 py-3`}>
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

function NeedsAttentionPanel({ rows, onOpenStay }) {
  return (
    <DashboardPanel aria-labelledby="nurse-attention-heading">
      <SectionKicker>Queue</SectionKicker>
      <h2 id="nurse-attention-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Needs attention
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Pending discharge only</p>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No patients pending discharge.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <button
              key={row.patientId}
              type="button"
              className={`${DASHBOARD_TILE} flex w-full items-start justify-between gap-2 px-3 py-3 text-left`}
              onClick={() => onOpenStay(row.patientId)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.patientId} · {locationLabel(row)} · {formatStayDay(row.admissionDate)}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </button>
          ))}
        </div>
      )}
    </DashboardPanel>
  )
}

function CurrentInpatientsPanel({ rows, onOpenStay, onViewAll }) {
  const columns = [
    {
      key: 'patientId',
      header: 'Patient ID',
      render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.patientId}</span>,
    },
    { key: 'name', header: 'Patient', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'room', header: 'Room/Bed', render: (row) => locationLabel(row) },
    { key: 'admissionDate', header: 'Admission', render: (row) => formatStayDay(row.admissionDate) },
    { key: 'admissionType', header: 'Type', render: (row) => admissionTypeLabel(row.admissionType) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'assignedDoctors', header: 'Doctors', render: (row) => <span className="text-sm">{doctorNames(row.assignedDoctors)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={DASHBOARD_OUTLINE_BUTTON}
          onClick={(e) => {
            e.stopPropagation()
            onOpenStay(row.patientId)
          }}
        >
          Record
        </Button>
      ),
    },
  ]

  const tableRows = rows.map((row) => ({ ...row, id: row.patientId }))

  return (
    <DashboardPanel padded={false} aria-labelledby="nurse-inpatients-heading">
      <div className="flex flex-col gap-4 border-b border-primary/10 px-6 py-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
        <div>
          <SectionKicker>Census list</SectionKicker>
          <h2 id="nurse-inpatients-heading" className="mt-2 text-lg font-semibold tracking-tight">
            Current inpatients
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Hospital-wide admitted and pending-discharge stays</p>
        </div>
        <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={onViewAll}>
          View all
        </Button>
      </div>
      <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent">
        <DataTable
          columns={columns}
          data={tableRows}
          onRowClick={(row) => onOpenStay(row.patientId)}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">No current inpatients.</p>}
        />
      </div>
    </DashboardPanel>
  )
}

function RecentSubmissionsPanel({ rows, onOpenStay }) {
  return (
    <DashboardPanel aria-labelledby="nurse-submissions-heading">
      <SectionKicker>My work</SectionKicker>
      <h2 id="nurse-submissions-heading" className="mt-2 text-lg font-semibold tracking-tight">
        Recent submissions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Records you submitted</p>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No submissions recorded for your account yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((rec) => (
            <button
              key={rec.id}
              type="button"
              className={`${DASHBOARD_TILE} flex w-full items-start justify-between gap-2 px-3 py-3 text-left`}
              onClick={() => onOpenStay(rec.patientId)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{rec.recordName || 'Service record'}</p>
                <p className="text-xs text-muted-foreground">
                  {rec.patientName || rec.patientId} · {recordTypeLabel(rec.type)}
                  {rec.recordedAt ? ` · ${formatDateTime(rec.recordedAt)}` : ''}
                </p>
              </div>
              <StatusBadge status={rec.status} />
            </button>
          ))}
        </div>
      )}
    </DashboardPanel>
  )
}

export default function NurseDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useNurseDashboard()

  const openStay = (patientId) => {
    if (patientId) navigate(`/nurse/patient/${patientId}`)
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className={`${DASHBOARD_OUTLINE_BUTTON} bg-background/60`} onClick={reload}>
        Sync data
      </Button>
      <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/nurse/patients')}>
        View patients
      </Button>
    </div>
  )

  if (loading) {
    return (
      <DashboardFrame busy>
        <DashboardHero
          kicker="Nursing"
          title="Ward overview"
          description="Live inpatient census and your service records. No billing or payment access."
          action={actions}
        />
        <DashboardPanel className="px-6 py-16 text-center text-sm text-muted-foreground">
          Loading dashboard...
        </DashboardPanel>
      </DashboardFrame>
    )
  }

  if (error || !data) {
    const forbidden = isForbiddenError(error)
    return (
      <DashboardFrame>
        <DashboardHero
          kicker="Nursing"
          title="Ward overview"
          description="Live inpatient census and your service records. No billing or payment access."
        />
        <DashboardPanel>
          <p className="text-sm font-medium">
            {forbidden
              ? 'You do not have permission to view the Nurse Dashboard.'
              : 'The Nurse Dashboard could not be loaded.'}
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
  const myPendingRecords = data.workQueue?.myPendingRecords ?? 0

  return (
    <DashboardFrame>
      <DashboardHero
        kicker="Nursing"
        title="Ward overview"
        description="Live inpatient census and your service records. No billing or payment access."
        generatedAt={data.generatedAt}
        action={actions}
      />

      <div className={DASHBOARD_FOLD_GRID}>
        <div className="lg:col-span-7">
          <CensusPanel census={census} myPendingRecords={myPendingRecords} />
        </div>
        <div className="lg:col-span-5">
          <NeedsAttentionPanel rows={data.needsAttention || []} onOpenStay={openStay} />
        </div>
      </div>

      <CurrentInpatientsPanel
        rows={data.currentInpatients || []}
        onOpenStay={openStay}
        onViewAll={() => navigate('/nurse/patients')}
      />

      <RecentSubmissionsPanel rows={data.recentSubmissions || []} onOpenStay={openStay} />
    </DashboardFrame>
  )
}
