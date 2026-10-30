import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MotionPage } from '@/lib/motion'
import { formatCurrency, formatDate } from '@/lib/utils'
import { api } from '@/api/client'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { filterControlClass } from '@/pages/manager/financeShared'
import { PatientLink } from '@/components/shared/PatientLink'
import { creditCompanyLabel } from '@/lib/credit'

function remainingClass(remaining) {
  if (remaining < 0) return 'text-warning'
  if (remaining > 0) return 'text-success'
  return 'text-muted-foreground'
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

export default function ManagerCreditPatients() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companies, setCompanies] = useState([])
  const [detail, setDetail] = useState(null)
  const { data, loading, error, reload } = useManagerFinanceQuery(
    api.getManagerCreditPatients,
    { status, q, companyId },
    'Credit patients require the live API.'
  )

  useEffect(() => {
    let cancelled = false
    api.listCreditCompanies()
      .then((payload) => {
        if (!cancelled) setCompanies(payload.companies || [])
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const empty = !loading && !error && data && (data.summary?.patients || 0) === 0

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
      key: 'admissionId',
      header: 'Admission ID',
      render: (row) => <span className="font-mono text-xs">{row.admissionId || '—'}</span>,
    },
    {
      key: 'admissionDate',
      header: 'Admission Date',
      render: (row) => <span className="tabular-nums">{formatDate(row.admissionDate)}</span>,
    },
    {
      key: 'creditCompany',
      header: 'Credit company',
      render: (row) => creditCompanyLabel(row),
    },
    {
      key: 'creditOutstanding',
      header: 'Credit Outstanding',
      render: (row) => (
        <span className="tabular-nums font-semibold text-warning">{formatCurrency(row.creditOutstanding)}</span>
      ),
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
      key: 'depositStatus',
      header: 'Credit Status',
      render: (row) => (row.depositStatus === 'partially-paid' ? 'Partially paid' : row.depositStatus === 'unpaid' ? 'Unpaid' : row.depositStatus || 'Unpaid'),
    },
    { key: 'status', header: 'Patient Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setDetail(row)}>View details</Button>
      ),
    },
  ]

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
        <select
          className={filterControlClass}
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          aria-label="Credit company"
        >
          <option value="">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}{company.active === false ? ' (inactive)' : ''}
            </option>
          ))}
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

      <Dialog open={Boolean(detail)} onOpenChange={(next) => { if (!next) setDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Credit patient details</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient and admission</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Patient name" value={detail.patientName} />
                  <Field label="Patient ID" value={detail.patientId} />
                  <Field label="Admission ID" value={detail.admissionId} />
                  <Field label="Admission date" value={detail.admissionDate ? formatDate(detail.admissionDate) : ''} />
                  <Field label="Admission status" value={detail.status} />
                  <Field label="Address" value={detail.address} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit company</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Company name" value={creditCompanyLabel(detail)} />
                  <Field label="Company code" value={detail.creditCompanyCode} />
                  <Field label="Contact person" value={detail.creditCompanyContact} />
                  <Field label="Phone" value={detail.creditCompanyPhone} />
                  <Field label="Email" value={detail.creditCompanyEmail} />
                  <Field label="Company address" value={detail.creditCompanyAddress} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial information</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Credit outstanding" value={formatCurrency(detail.creditOutstanding)} />
                  <Field label="Current balance" value={formatCurrency(detail.remaining)} />
                  <Field label="Credit status" value={detail.depositStatus === 'partially-paid' ? 'Partially paid' : detail.depositStatus === 'paid' ? 'Paid' : 'Unpaid'} />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}
