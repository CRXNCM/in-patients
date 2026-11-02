import { useState } from 'react'
import { Pill } from 'lucide-react'
import { PageHeader, DataTable, EmptyState } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionPage } from '@/lib/motion'
import { formatCurrency } from '@/lib/utils'
import { api } from '@/api/client'
import { PatientLink } from '@/components/shared/PatientLink'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { FinancePeriodBar, localToday } from '@/pages/manager/financeShared'

const medicineColumns = [
  { key: 'name', header: 'Medicine', render: (row) => row.name || '—' },
  { key: 'unit', header: 'Unit', render: (row) => row.unit || '—' },
  {
    key: 'issuedQuantity',
    header: 'Issued',
    render: (row) => <span className="tabular-nums font-medium">{row.issuedQuantity}</span>,
  },
  {
    key: 'returnedQuantity',
    header: 'Returned',
    render: (row) => <span className="tabular-nums">{row.returnedQuantity}</span>,
  },
  {
    key: 'netQuantity',
    header: 'Net out',
    render: (row) => <span className="tabular-nums font-medium">{row.netQuantity}</span>,
  },
  {
    key: 'patientCount',
    header: 'Patients',
    render: (row) => <span className="tabular-nums">{row.patientCount}</span>,
  },
  {
    key: 'issuedValue',
    header: 'Issued value',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.issuedValue || 0)}</span>,
  },
]

const patientColumns = [
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
    key: 'issuedQuantity',
    header: 'Issued',
    render: (row) => <span className="tabular-nums font-medium">{row.issuedQuantity}</span>,
  },
  {
    key: 'returnedQuantity',
    header: 'Returned',
    render: (row) => <span className="tabular-nums">{row.returnedQuantity}</span>,
  },
  {
    key: 'netQuantity',
    header: 'Net out',
    render: (row) => <span className="tabular-nums font-medium">{row.netQuantity}</span>,
  },
  {
    key: 'medicineCount',
    header: 'Different medicines',
    render: (row) => <span className="tabular-nums">{row.medicineCount}</span>,
  },
  {
    key: 'issuedValue',
    header: 'Issued value',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.issuedValue || 0)}</span>,
  },
]

export default function ManagerPharmacy() {
  const [view, setView] = useState('month')
  const [date, setDate] = useState(localToday())
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerPharmacyUsage,
    { view, date },
    'Pharmacy usage requires the live API.'
  )

  const empty = !loading && !error && data && (data.summary?.issuedQuantity || 0) === 0 && (data.summary?.returnedQuantity || 0) === 0

  return (
    <MotionPage>
      <PageHeader
        title="Pharmacy usage"
        description="Medicines handed over to the ward in the selected period. Returns that pharmacy accepted are shown separately so net out is what stayed with the patient."
      />
      <FinancePeriodBar view={view} onViewChange={setView} date={date} onDateChange={setDate} data={data} />
      {loading ? <LoadingState message="Loading pharmacy usage…" /> : null}
      {error ? <ErrorState title="Pharmacy usage could not be loaded" message={error} onRetry={reload} /> : null}
      {!loading && !error && data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Medicines issued" value={data.summary?.medicines || 0} />
            <MetricTile label="Quantity issued" value={data.summary?.issuedQuantity || 0} />
            <MetricTile label="Quantity returned" value={data.summary?.returnedQuantity || 0} />
            <MetricTile label="Net quantity out" value={data.summary?.netQuantity || 0} />
            <MetricTile label="Patients" value={data.summary?.patients || 0} subtitle={formatCurrency(data.summary?.issuedValue || 0)} />
          </div>
          {empty ? (
            <EmptyState
              icon={Pill}
              title="No pharmacy handovers"
              description="Nothing was handed over or accepted back in this period."
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top medicines</CardTitle>
                </CardHeader>
                <CardContent>
                  {(data.topMedicines || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No medicines were handed over in this period.</p>
                  ) : (
                    <DataTable columns={medicineColumns} data={data.topMedicines} />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Patients who received the most medicine</CardTitle>
                </CardHeader>
                <CardContent>
                  {(data.topPatients || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No patients received medicine in this period.</p>
                  ) : (
                    <DataTable columns={patientColumns} data={data.topPatients} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </MotionPage>
  )
}
