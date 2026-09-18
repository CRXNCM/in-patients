import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MotionPage } from '@/lib/motion'
import { formatCurrency, formatDate } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { filterControlClass } from '@/pages/manager/financeShared'
import { PatientLink } from '@/components/shared/PatientLink'

function remainingClass(remaining) {
  if (remaining < 0) return 'text-warning'
  if (remaining > 0) return 'text-success'
  return 'text-muted-foreground'
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
    key: 'depositTotal',
    header: 'Deposit',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.depositTotal)}</span>,
  },
  {
    key: 'totalCharges',
    header: 'Approved Charges',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.totalCharges)}</span>,
  },
  {
    key: 'remaining',
    header: 'Current Balance',
    render: (row) => (
      <span className={`tabular-nums font-medium ${remainingClass(row.remaining)}`}>
        {formatCurrency(row.remaining)}
      </span>
    ),
  },
  {
    key: 'creditOutstanding',
    header: 'Credit Outstanding',
    render: (row) => (
      <span className="tabular-nums font-semibold text-warning">{formatCurrency(row.creditOutstanding)}</span>
    ),
  },
  {
    key: 'depositStatus',
    header: 'Credit Status',
    render: (row) => (row.depositStatus === 'partially-paid' ? 'Partially paid' : row.depositStatus || 'Credit'),
  },
  { key: 'status', header: 'Patient Status', render: (row) => <StatusBadge status={row.status} /> },
]

export default function ManagerCreditPatients() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerCreditPatients,
    { status, q },
    'Credit patients require the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.patients || 0) === 0

  return (
    <MotionPage>
      <PageHeader
        title="Credit Patients"
        description="Current stays admitted on credit."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or patient ID"
          className="sm:max-w-xs"
        />
        <select
          className={filterControlClass}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Patient status"
        >
          <option value="">All current stays</option>
          <option value="admitted">Admitted</option>
          <option value="pending-discharge">Pending discharge</option>
        </select>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading credit patients…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Credit patients could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Credit patients" value={data.summary.patients} />
            <MetricTile
              label="Total credit outstanding"
              value={formatCurrency(data.summary.creditOutstanding)}
              alert={data.summary.creditOutstanding > 0}
            />
            <MetricTile label="Average credit balance" value={formatCurrency(data.summary.average)} />
            <MetricTile label="Billing outstanding" value={formatCurrency(data.summary.billingOutstanding)} />
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={CreditCard}
                title="No credit patients"
                description="No current stays are marked as credit patients."
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
