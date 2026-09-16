import { useState } from 'react'
import { Archive } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MotionPage, MotionReveal } from '@/lib/motion'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { FinancePeriodBar, localToday } from '@/pages/manager/financeShared'
import { PatientLink } from '@/components/shared/PatientLink'

function remainingTone(remaining) {
  if (remaining < 0) return 'text-destructive'
  if (remaining > 0) return 'text-success'
  return ''
}

const columns = [
  {
    key: 'patient',
    header: 'Patient',
    render: (row) => (
      <PatientLink patientId={row.patientId} className="font-medium">
        {row.patientName || '—'}
      </PatientLink>
    ),
  },
  {
    key: 'patientId',
    header: 'Patient ID',
    render: (row) => (
      <PatientLink patientId={row.patientId} className="font-mono text-sm">
        {row.patientId}
      </PatientLink>
    ),
  },
  {
    key: 'admissionDate',
    header: 'Admission Date',
    render: (row) => <span className="tabular-nums">{formatDate(row.admissionDate)}</span>,
  },
  {
    key: 'dischargedAt',
    header: 'Discharge Date',
    render: (row) => <span className="tabular-nums">{formatDateTime(row.dischargedAt)}</span>,
  },
  {
    key: 'location',
    header: 'Room / Bed',
    render: (row) => (row.room || row.bed ? `${row.room || '—'} / ${row.bed || '—'}` : '—'),
  },
  {
    key: 'grandTotal',
    header: 'Grand Total',
    render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.grandTotal)}</span>,
  },
  {
    key: 'deposits',
    header: 'Total Deposits',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.deposits)}</span>,
  },
  {
    key: 'remaining',
    header: 'Remaining Balance',
    render: (row) => (
      <span className={cn('tabular-nums font-semibold', remainingTone(row.remaining))}>
        {formatCurrency(row.remaining)}
      </span>
    ),
  },
  { key: 'status', header: 'Discharge Status', render: (row) => <StatusBadge status={row.status} /> },
]

export default function ManagerDischarged() {
  const [view, setView] = useState('week')
  const [date, setDate] = useState(localToday)
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerDischargedPatients,
    { view, date, q },
    'Discharged patients reporting requires the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.patients || 0) === 0
  const remaining = data?.summary?.remaining || 0

  return (
    <MotionPage>
      <PageHeader
        title="Discharged Patients"
        description="Completed stays and the final approved charges, deposits, and remaining balance recorded at discharge."
      />

      <MotionReveal>
        <FinancePeriodBar view={view} onViewChange={setView} date={date} onDateChange={setDate} data={data} />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or patient ID"
          className="mb-6 sm:max-w-xs"
        />
      </MotionReveal>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading discharged patients…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Discharged patients could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <MotionReveal className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricTile label="Grand Total" value={formatCurrency(data.summary.grandTotal)} />
            <MetricTile label="Total Deposits" value={formatCurrency(data.summary.deposits)} tone="success" />
            <MetricTile
              label="Remaining Balance"
              value={formatCurrency(remaining)}
              tone={remaining < 0 ? 'danger' : remaining > 0 ? 'success' : 'default'}
            />
          </MotionReveal>

          {empty ? (
            <Card>
              <EmptyState
                icon={Archive}
                title="No discharged patients"
                description={
                  data.startDate && data.endDate && data.startDate !== data.endDate
                    ? `There are no discharged patients from ${formatDate(data.startDate)} to ${formatDate(data.endDate)}. Try a wider period.`
                    : `There are no discharged patients on ${formatDate(data.date || date)}. Try week or month if the stay was completed on another day.`
                }
              />
            </Card>
          ) : (
            <DataTable columns={columns} data={data.rows || []} />
          )}
        </>
      )}
    </MotionPage>
  )
}
