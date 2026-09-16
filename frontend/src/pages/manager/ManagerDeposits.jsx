import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { PageHeader, DataTable, EmptyState } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { MotionPage } from '@/lib/motion'
import { formatCurrency, formatDate } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { FinancePeriodBar, formatClock, localToday } from '@/pages/manager/financeShared'
import { PatientLink } from '@/components/shared/PatientLink'

const dayColumns = [
  {
    key: 'time',
    header: 'Time',
    render: (row) => <span className="tabular-nums">{formatClock(row.createdAt)}</span>,
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
  {
    key: 'amount',
    header: 'Amount',
    render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>,
  },
  { key: 'method', header: 'Payment Method', render: (row) => row.method || '—' },
  { key: 'receivedBy', header: 'Recorded By', render: (row) => row.receivedBy || '—' },
]

const dailyColumns = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
  },
  {
    key: 'transactions',
    header: 'Transactions',
    render: (row) => <span className="tabular-nums">{row.transactions}</span>,
  },
  {
    key: 'total',
    header: 'Total Deposits',
    render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.total)}</span>,
  },
  {
    key: 'average',
    header: 'Average Deposit',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.average)}</span>,
  },
]

export default function ManagerDeposits() {
  const [view, setView] = useState('day')
  const [date, setDate] = useState(localToday)
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerDeposits,
    { view, date },
    'Deposits reporting requires the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.transactions || 0) === 0
  const columns = view === 'day' ? dayColumns : dailyColumns
  const tableRows = empty ? [] : data?.rows || []

  return (
    <MotionPage>
      <PageHeader title="Deposits" description="Monitor patient deposit activity and totals." />
      <FinancePeriodBar view={view} onViewChange={setView} date={date} onDateChange={setDate} data={data} />

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading deposit activity…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Deposits could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricTile label="Total deposits" value={formatCurrency(data.summary.total)} />
            <MetricTile label="Transactions" value={data.summary.transactions} />
            <MetricTile label="Average deposit" value={formatCurrency(data.summary.average)} />
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={Wallet}
                title="No deposits"
                description="There are no deposit transactions for this period."
              />
            </Card>
          ) : (
            <DataTable columns={columns} data={tableRows} />
          )}
        </>
      )}
    </MotionPage>
  )
}
