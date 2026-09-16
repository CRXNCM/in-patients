import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MotionPage, MotionReveal } from '@/lib/motion'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { useState } from 'react'
import { PatientLink } from '@/components/shared/PatientLink'

const filterControlClass = 'h-9 rounded-md border bg-background px-3 text-sm shadow-sm'

function remainingClass(remaining) {
  return remaining < 0 ? 'text-destructive' : 'text-warning'
}

export default function CriticalBalances() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getReceptionCriticalBalances,
    { status, q },
    'Critical balances require the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.patients || 0) === 0
  const showCredit = data?.rows?.some((row) => Object.prototype.hasOwnProperty.call(row, 'isCreditPatient'))

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
      key: 'room',
      header: 'Room',
      render: (row) => row.room || '—',
    },
    {
      key: 'bed',
      header: 'Bed',
      render: (row) => row.bed || '—',
    },
    {
      key: 'admissionDate',
      header: 'Admission Date',
      render: (row) => <span className="tabular-nums">{formatDate(row.admissionDate)}</span>,
    },
    {
      key: 'totalCharges',
      header: 'Approved Charges',
      render: (row) => <span className="tabular-nums">{formatCurrency(row.totalCharges)}</span>,
    },
    {
      key: 'depositTotal',
      header: 'Deposits',
      render: (row) => <span className="tabular-nums">{formatCurrency(row.depositTotal)}</span>,
    },
    {
      key: 'remaining',
      header: 'Current Balance',
      render: (row) => (
        <span className={cn('tabular-nums font-semibold', remainingClass(row.remaining))}>
          {formatCurrency(row.remaining)}
        </span>
      ),
    },
    { key: 'status', header: 'Patient Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(showCredit
      ? [
          {
            key: 'credit',
            header: 'Credit Status',
            render: (row) => (row.isCreditPatient ? 'Credit' : '—'),
          },
        ]
      : []),
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/reception/patient/${row.patientId}`)
          }}
        >
          <Eye className="h-4 w-4" />
          View Billing
        </Button>
      ),
    },
  ]

  return (
    <MotionPage>
      <PageHeader
        title="Critical Balances"
        description="Admitted patients whose remaining deposit is below the hospital’s critical-balance threshold."
      />

      <MotionReveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
      </MotionReveal>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading critical balances…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Critical balances could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <MotionReveal className="mb-6 grid gap-4 sm:grid-cols-2">
            <MetricTile
              label="Critical Patients"
              value={data.summary.patients}
              alert={data.summary.patients > 0}
            />
            <MetricTile
              label="Total Critical Balance"
              value={formatCurrency(data.summary.remainingTotal)}
              tone={
                data.summary.remainingTotal < 0
                  ? 'danger'
                  : data.summary.patients > 0
                    ? 'warning'
                    : 'default'
              }
            />
          </MotionReveal>

          {empty ? (
            <Card>
              <EmptyState
                icon={AlertTriangle}
                title="No critical balances"
                description="There are currently no admitted patients requiring balance attention."
              />
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={data.rows || []}
              onRowClick={(row) => navigate(`/reception/patient/${row.patientId}`)}
            />
          )}
        </>
      )}
    </MotionPage>
  )
}
