import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { MotionPage } from '@/lib/motion'
import { formatCurrency, formatDate } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { FinancePeriodBar, filterControlClass, localToday } from '@/pages/manager/financeShared'
import { PatientLink } from '@/components/shared/PatientLink'

const dayColumns = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
  },
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
  { key: 'chargeType', header: 'Charge Type', render: (row) => row.chargeType || '—' },
  { key: 'description', header: 'Description', render: (row) => row.description || '—' },
  {
    key: 'amount',
    header: 'Amount',
    render: (row) => (
      <span className={`tabular-nums font-medium ${row.amount < 0 ? 'text-success' : ''}`}>
        {formatCurrency(row.amount)}
      </span>
    ),
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'recordedBy', header: 'Recorded By', render: (row) => row.recordedBy || '—' },
]

const dailyColumns = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
  },
  {
    key: 'records',
    header: 'Records',
    render: (row) => <span className="tabular-nums">{row.records}</span>,
  },
  {
    key: 'total',
    header: 'Total Charges',
    render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.total)}</span>,
  },
  {
    key: 'average',
    header: 'Average',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.average)}</span>,
  },
]

const breakdownColumns = [
  { key: 'name', header: 'Category', render: (row) => row.name },
  {
    key: 'records',
    header: 'Records',
    render: (row) => <span className="tabular-nums">{row.records}</span>,
  },
  {
    key: 'amount',
    header: 'Total',
    render: (row) => (
      <span className={`tabular-nums font-medium ${row.amount < 0 ? 'text-success' : ''}`}>
        {formatCurrency(row.amount)}
      </span>
    ),
  },
]

export default function ManagerCharges() {
  const [view, setView] = useState('day')
  const [date, setDate] = useState(localToday)
  const [category, setCategory] = useState('')
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerCharges,
    { view, date, category },
    'Revenue & Charges requires the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.records || 0) === 0
  const columns = view === 'day' ? dayColumns : dailyColumns
  const tiles = [
    { key: 'total', label: 'Total charges', value: data?.summary.total, always: true },
    { key: 'room', label: 'Room charges', value: data?.summary.room },
    { key: 'doctor', label: 'Visiting doctor charges', value: data?.summary.doctor },
    { key: 'pharmacy', label: 'Pharmacy charges', value: data?.summary.pharmacy },
    { key: 'returns', label: 'Approved returns', value: data?.summary.returns },
  ].filter((tile) => tile.always || Number(tile.value) !== 0)

  return (
    <MotionPage>
      <PageHeader
        title="Revenue & Charges"
        description="See billed approved charges and where they came from."
      />
      <FinancePeriodBar view={view} onViewChange={setView} date={date} onDateChange={setDate} data={data} />

      <div className="mb-6">
        <select
          className={filterControlClass}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Charge category"
        >
          <option value="">All charge types</option>
          {(data?.breakdown || []).map((row) => (
            <option key={row.name} value={row.name}>
              {row.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading billed charges…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Charges could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <MetricTile key={tile.key} label={tile.label} value={formatCurrency(tile.value || 0)} />
            ))}
            <MetricTile label="Approved records" value={data.summary.records} />
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={Receipt}
                title="No charges"
                description="There are no approved charges for this period."
              />
            </Card>
          ) : (
            <div className="space-y-6">
              {data.breakdown?.length > 0 && (
                <DataTable columns={breakdownColumns} data={data.breakdown} />
              )}
              <DataTable columns={columns} data={data.rows || []} />
            </div>
          )}
        </>
      )}
    </MotionPage>
  )
}
