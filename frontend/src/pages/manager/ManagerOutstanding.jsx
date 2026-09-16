import { useState } from 'react'
import { Scale } from 'lucide-react'
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
    header: 'Room / Bed',
    render: (row) => (row.room || row.bed ? `${row.room || '—'} · ${row.bed || '—'}` : '—'),
  },
  {
    key: 'admissionDate',
    header: 'Admission Date',
    render: (row) => <span className="tabular-nums">{formatDate(row.admissionDate)}</span>,
  },
  {
    key: 'outstanding',
    header: 'Current Balance',
    render: (row) => (
      <span className="tabular-nums font-semibold text-warning">{formatCurrency(row.outstanding)}</span>
    ),
  },
  { key: 'status', header: 'Patient Status', render: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'credit',
    header: 'Credit Status',
    render: (row) =>
      row.isCreditPatient === undefined ? '—' : row.isCreditPatient ? 'Credit' : '—',
  },
]

export default function ManagerOutstanding() {
  const [status, setStatus] = useState('')
  const [credit, setCredit] = useState('')
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerOutstanding,
    { status, credit, q },
    'Outstanding balances require the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.patients || 0) === 0
  const showCredit = data?.rows?.some((row) => Object.prototype.hasOwnProperty.call(row, 'isCreditPatient'))
  const tableColumns = showCredit ? columns : columns.filter((col) => col.key !== 'credit')

  return (
    <MotionPage>
      <PageHeader
        title="Outstanding Balances"
        description="Current stays that still owe money after approved charges and deposits."
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
        <select
          className={filterControlClass}
          value={credit}
          onChange={(event) => setCredit(event.target.value)}
          aria-label="Credit status"
        >
          <option value="">All credit statuses</option>
          <option value="true">Credit patients</option>
          <option value="false">Not credit</option>
        </select>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading outstanding balances…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Outstanding balances could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Total outstanding" value={formatCurrency(data.summary.total)} alert={data.summary.total > 0} />
            <MetricTile label="Patients with balance" value={data.summary.patients} />
            <MetricTile label="Average outstanding" value={formatCurrency(data.summary.average)} />
            <MetricTile label="High balance" value={data.summary.highBalance} alert={data.summary.highBalance > 0} />
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={Scale}
                title="No outstanding balances"
                description="No current stays have an unpaid balance after approved charges."
              />
            </Card>
          ) : (
            <DataTable columns={tableColumns} data={data.rows || []} />
          )}
        </>
      )}
    </MotionPage>
  )
}
