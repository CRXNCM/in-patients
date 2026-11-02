import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import {
  DASHBOARD_OUTLINE_BUTTON,
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  SectionKicker,
} from '@/components/shared/DashboardChrome'
import { MetricTile } from '@/components/shared/MetricTile'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { PatientLink } from '@/components/shared/PatientLink'
import { useCreditPatientRows } from '@/hooks/useCreditPatientRows'
import { creditCompanyLabel, creditStatusLabel } from '@/lib/credit'
import { stayLocationLabel } from '@/lib/admissions'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function CreditReceptionDashboard() {
  const navigate = useNavigate()
  const { active, unpaid, partial, settled, outstandingTotal, collected, companies } = useCreditPatientRows({
    includeDischarged: false,
  })

  const columns = [
    {
      key: 'id',
      header: 'Patient ID',
      render: (row) => (
        <PatientLink patientId={row.id} className="font-mono text-xs font-medium">{row.id}</PatientLink>
      ),
    },
    {
      key: 'name',
      header: 'Patient',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <PatientLink patientId={row.id} className="font-medium">{row.name}</PatientLink>
          <CreditBadge patient={row} />
        </div>
      ),
    },
    { key: 'company', header: 'Company', render: (row) => creditCompanyLabel(row) },
    { key: 'location', header: 'Room / Bed', render: (row) => stayLocationLabel(row) },
    { key: 'admissionDate', header: 'Admitted', render: (row) => formatDate(row.admissionDate) },
    {
      key: 'outstanding',
      header: 'Unpaid charges',
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.outstanding)}</span>,
    },
    { key: 'paid', header: 'Paid so far', render: (row) => formatCurrency(row.deposit) },
    { key: 'creditStatus', header: 'Credit status', render: (row) => creditStatusLabel(row.creditStatus) },
    { key: 'stay', header: 'Stay', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/reception/patient/${row.id}`)
          }}
        >
          Collect payment
        </Button>
      ),
    },
  ]

  return (
    <DashboardFrame>
      <DashboardHero
        kicker="Credit Reception"
        title="Credit patients"
        description="Only stays admitted on credit. Collect a company payment or a patient deposit; when the bill is covered the stay becomes a normal cash patient."
        action={
          <Button type="button" size="sm" onClick={() => navigate('/reception/credit-patients')}>
            All credit records
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Credit patients" value={active.length} subtitle="Currently on credit" />
        <MetricTile label="Unpaid" value={unpaid.length} subtitle="No payment recorded yet" alert={unpaid.length > 0} />
        <MetricTile label="Partially paid" value={partial.length} subtitle="Company or self payment started" />
        <MetricTile
          label="Unpaid charges"
          value={formatCurrency(outstandingTotal)}
          subtitle="Approved charges minus payments"
          alert={outstandingTotal > 0}
        />
        <MetricTile label="Collected on credit stays" value={formatCurrency(collected)} subtitle="Deposits and company payments" />
      </div>

      {settled.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {settled.length} former credit patient{settled.length === 1 ? '' : 's'} already converted to cash
          {settled.filter((row) => row.status !== 'discharged').length
            ? ` (${settled.filter((row) => row.status !== 'discharged').length} still admitted).`
            : '.'}
        </p>
      ) : null}

      <DashboardPanel padded={false} aria-labelledby="credit-company-heading">
        <div className="border-b border-primary/10 px-6 py-5 dark:border-white/10">
          <SectionKicker>Companies</SectionKicker>
          <h2 id="credit-company-heading" className="mt-2 text-lg font-semibold tracking-tight">Open credit by company</h2>
          <p className="mt-1 text-sm text-muted-foreground">Current credit stays grouped by the company on file</p>
        </div>
        {companies.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No credit companies have open stays.</p>
        ) : (
          <div className="divide-y divide-primary/10 dark:divide-white/10">
            {companies.map((company) => (
              <div key={company.name} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.patients} patient{company.patients === 1 ? '' : 's'}</p>
                </div>
                <p className="tabular-nums text-sm font-medium">{formatCurrency(company.outstanding)}</p>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel padded={false} aria-labelledby="credit-stay-heading">
        <div className="flex flex-col gap-3 border-b border-primary/10 px-6 py-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
          <div>
            <SectionKicker>Credit stays</SectionKicker>
            <h2 id="credit-stay-heading" className="mt-2 text-lg font-semibold tracking-tight">Patients on credit</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open a row to record a company payment or a patient deposit</p>
          </div>
          <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON} onClick={() => navigate('/reception/credit-patients')}>
            View all credit records
          </Button>
        </div>
        <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&_td]:px-3 [&_th]:px-3">
          <DataTable
            columns={columns}
            data={active}
            onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
            emptyState={<p className="py-10 text-center text-sm text-muted-foreground">No patients are currently on credit.</p>}
          />
        </div>
      </DashboardPanel>
    </DashboardFrame>
  )
}
