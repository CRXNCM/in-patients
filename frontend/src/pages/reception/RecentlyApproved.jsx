import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, RotateCcw } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { MotionPage, MotionReveal } from '@/lib/motion'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { useLiveSync } from '@/context/LiveSyncContext'
import { PatientLink } from '@/components/shared/PatientLink'

const filterControlClass = 'h-9 rounded-md border bg-background px-3 text-sm shadow-sm'

function typeLabel(type) {
  return type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'
}

export default function RecentlyApproved() {
  const navigate = useNavigate()
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getReceptionRecentlyApproved,
    { type, q },
    'Recently approved records require the live API.'
  )
  useLiveSync(reload)

  const empty = !loading && !error && data && (data.summary?.records || 0) === 0

  const columns = [
    {
      key: 'reviewedAt',
      header: 'Approved Time',
      render: (row) => <span className="tabular-nums">{formatDateTime(row.reviewedAt)}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => (
        <div>
          <p className="font-medium">
            <PatientLink patientId={row.patientId}>{row.patientName || '—'}</PatientLink>
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            <PatientLink patientId={row.patientId}>{row.patientId}</PatientLink>
          </p>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.recordName || '—'}</p>
          <p className="text-xs text-muted-foreground">
            {row.serviceSummary || typeLabel(row.type)}
            {row.itemCount ? ` · ${row.itemCount} item(s)` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          {row.type === 'pharmacy_return' && <RotateCcw className="h-3.5 w-3.5 text-orange-600" />}
          {typeLabel(row.type)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className={cn('tabular-nums font-semibold', row.amount < 0 && 'text-success')}>
          {row.amount < 0 ? '-' : ''}
          {formatCurrency(Math.abs(row.amount))}
        </span>
      ),
    },
    {
      key: 'approvedBy',
      header: 'Approved By',
      render: (row) => row.approvedBy || '—',
    },
    {
      key: 'recordedBy',
      header: 'Recorded By',
      render: (row) => row.recordedBy || '—',
    },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="approved" /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation()
              setSelected(row)
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/reception/patient/${row.patientId}`)
            }}
          >
            View Billing
          </Button>
        </div>
      ),
    },
  ]

  return (
    <MotionPage>
      <PageHeader
        title="Recently Approved"
        description="Service records already approved for billing, newest approval first."
      />

      <MotionReveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search patient, record, or approver"
          className="sm:max-w-xs"
        />
        <select
          className={filterControlClass}
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Record type"
        >
          <option value="">All record types</option>
          <option value="daily">Daily services</option>
          <option value="return">Pharmacy returns</option>
        </select>
      </MotionReveal>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading recently approved records…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Recently approved records could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <MotionReveal className="mb-6 grid gap-4 sm:grid-cols-2">
            <MetricTile label="Approved Records" value={data.summary.records} />
            <MetricTile label="Total Amount" value={formatCurrency(data.summary.amountTotal)} />
          </MotionReveal>

          {empty ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="No recently approved records"
                description="Approved service records will appear here after reception review."
              />
            </Card>
          ) : (
            <DataTable columns={columns} data={data.rows || []} onRowClick={setSelected} />
          )}
        </>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.recordName || 'Approved record'}</DialogTitle>
            <DialogDescription>
              Approved {selected?.reviewedAt ? formatDateTime(selected.reviewedAt) : '—'}
              {selected?.approvedBy ? ` by ${selected.approvedBy}` : ''}.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Patient: </span>
                {selected.patientName || '—'}{' '}
                <span className="font-mono text-xs text-primary">{selected.patientId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Type: </span>
                {typeLabel(selected.type)}
              </p>
              <p>
                <span className="text-muted-foreground">Service: </span>
                {selected.serviceSummary || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Amount: </span>
                <span className="tabular-nums font-semibold">{formatCurrency(selected.amount)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Recorded by: </span>
                {selected.recordedBy || '—'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected?.patientId && (
              <Button onClick={() => navigate(`/reception/patient/${selected.patientId}`)}>
                View Billing
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}
