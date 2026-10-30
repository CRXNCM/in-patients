import { useEffect, useState } from 'react'
import {
  FileText, Calendar, CalendarDays, CalendarRange, Building2, Wallet,
  AlertCircle, History, Bed, FileDown, FileSpreadsheet, Printer, CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Input } from '@/components/ui/input'
import { useToast } from '@/context/ToastContext'
import { api, USE_API } from '@/api/client'
import { printReport, exportReportCsv } from '@/lib/printReport'
import {
  patients as mockPatients,
  revenueByDepartment,
  dailyRevenueTrend,
} from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { useAuth } from '@/context/AuthContext'
import { useManagerFinanceQuery } from '@/hooks/useManagerFinanceQuery'
import { filterControlClass } from '@/pages/manager/financeShared'
import { formatCurrency, formatDate } from '@/lib/utils'
import { creditCompanyLabel } from '@/lib/credit'

const reports = [
  { id: 'daily', title: 'Daily Report', description: 'Summary of today\'s revenue, deposits, and transactions', icon: Calendar, color: 'bg-blue-500' },
  { id: 'weekly', title: 'Weekly Report', description: 'Weekly performance metrics and department breakdown', icon: CalendarDays, color: 'bg-indigo-500' },
  { id: 'monthly', title: 'Monthly Report', description: 'Comprehensive monthly financial statement', icon: CalendarRange, color: 'bg-purple-500' },
  { id: 'annual', title: 'Annual Report', description: 'Year-end financial summary and trends', icon: FileText, color: 'bg-emerald-500' },
  { id: 'department', title: 'Department Revenue', description: 'Revenue breakdown by hospital department', icon: Building2, color: 'bg-cyan-500' },
  { id: 'deposit', title: 'Deposit Report', description: 'All deposits collected within selected period', icon: Wallet, color: 'bg-teal-500' },
  { id: 'outstanding', title: 'Outstanding Balance', description: 'Patients with unpaid or low balances', icon: AlertCircle, color: 'bg-red-500' },
  { id: 'billing', title: 'Patient Billing History', description: 'Detailed billing records per patient', icon: History, color: 'bg-orange-500' },
  { id: 'occupancy', title: 'Room Occupancy', description: 'Bed utilization and occupancy rates', icon: Bed, color: 'bg-violet-500' },
  { id: 'credit-patients', title: 'Credit Patients', description: 'Credit admissions by company, dates, and outstanding deposit', icon: CreditCard, color: 'bg-amber-500' },
]

function buildMockReport(type, settings) {
  const threshold = settings.lowBalanceThreshold ?? 3000
  const recentPatients = mockPatients
    .slice()
    .sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''))
    .map((p) => ({
      name: p.name,
      deposit: p.deposit || 0,
      balance: (p.deposit || 0) - (p.totalCharges || 0),
      admissionDate: p.admissionDate,
    }))

  const base = {
    hospitalName: settings.name || 'Central City Hospital',
    generatedAt: new Date().toISOString(),
  }

  switch (type) {
    case 'daily':
      return { ...base, title: 'Daily Report', summary: { revenue: 59500 }, rows: recentPatients }
    case 'weekly':
      return { ...base, title: 'Weekly Report', rows: dailyRevenueTrend }
    case 'monthly':
    case 'annual':
    case 'department':
      return { ...base, title: `${type} Report`, rows: revenueByDepartment }
    case 'outstanding':
      return { ...base, title: 'Outstanding Balance Report', rows: recentPatients.filter((p) => p.balance < threshold) }
    case 'billing':
      return { ...base, title: 'Patient Billing Summary', rows: recentPatients }
    case 'deposit':
      return {
        ...base,
        title: 'Deposit Report',
        rows: mockPatients.flatMap((p) =>
          (p.depositHistory || [{ date: p.admissionDate, amount: p.deposit, method: 'Cash' }]).map((d) => ({
            date: d.date,
            patientId: p.id,
            amount: d.amount,
            method: d.method || 'Cash',
          }))
        ),
      }
    case 'occupancy':
      return {
        ...base,
        title: 'Room Occupancy Report',
        summary: { occupancyRate: 72 },
        rows: mockPatients.map((p, i) => ({
          label: p.bed || `Bed ${i + 1}`,
          roomType: p.room,
          status: 'occupied',
          patientId: p.id,
        })),
      }
    case 'credit-patients':
      return {
        ...base,
        title: 'Credit Patients',
        summary: { patients: 0, creditOutstanding: 0 },
        rows: [],
        byCompany: [],
      }
    default:
      return { ...base, title: 'Report', rows: [] }
  }
}

const creditColumns = [
  { key: 'patientName', header: 'Patient name', render: (row) => row.patientName || '—' },
  { key: 'patientId', header: 'Patient ID', render: (row) => <span className="font-mono text-sm">{row.patientId}</span> },
  { key: 'admissionId', header: 'Admission ID', render: (row) => <span className="font-mono text-xs">{row.admissionId || '—'}</span> },
  { key: 'admissionDate', header: 'Admission date', render: (row) => formatDate(row.admissionDate) },
  { key: 'status', header: 'Admission status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'company', header: 'Credit company', render: (row) => creditCompanyLabel(row) },
  { key: 'code', header: 'Company code', render: (row) => row.creditCompanyCode || '—' },
  {
    key: 'creditOutstanding',
    header: 'Credit outstanding',
    render: (row) => <span className="tabular-nums">{formatCurrency(row.creditOutstanding)}</span>,
  },
  {
    key: 'depositStatus',
    header: 'Credit status',
    render: (row) => (row.depositStatus === 'partially-paid' ? 'Partially paid' : row.depositStatus === 'unpaid' ? 'Unpaid' : row.depositStatus || 'Unpaid'),
  },
]

async function emptyCreditReport() {
  return { rows: [], summary: { patients: 0, creditOutstanding: 0 }, byCompany: [] }
}

export default function ReportsPage() {
  const { toast } = useToast()
  const { settings } = useBillingConfig()
  const { hasPermission } = useAuth()
  const canViewCredit = hasPermission('credit.view')
  const [loadingId, setLoadingId] = useState(null)
  const [companies, setCompanies] = useState([])
  const [creditFilters, setCreditFilters] = useState({
    companyId: '',
    from: '',
    to: '',
    stay: '',
    depositStatus: '',
  })

  const visibleReports = reports.filter((report) => report.id !== 'credit-patients' || canViewCredit)
  const { data: creditData, loading: creditLoading, error: creditError, reload: reloadCredit } = useManagerFinanceQuery(
    canViewCredit ? api.getManagerCreditPatients : emptyCreditReport,
    canViewCredit ? creditFilters : { disabled: true },
    'Credit-patient reports require the live API.'
  )

  useEffect(() => {
    if (!canViewCredit || !USE_API) return undefined
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
  }, [canViewCredit])

  const fetchReport = async (reportId) => {
    if (USE_API) {
      return api.getManagerReport(reportId, reportId === 'credit-patients' ? creditFilters : {})
    }
    return buildMockReport(reportId, settings)
  }

  const handlePrint = async (reportId, reportTitle) => {
    setLoadingId(`${reportId}-print`)
    try {
      const report = await fetchReport(reportId, reportTitle)
      const ok = printReport(report)
      if (!ok) {
        toast({ title: 'Popup blocked', description: 'Allow popups to print this report.', variant: 'destructive' })
        return
      }
      toast({ title: 'Print ready', description: `${reportTitle} opened in print dialog`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Print failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingId(null)
    }
  }

  const handlePdf = async (reportId, reportTitle) => {
    setLoadingId(`${reportId}-pdf`)
    try {
      const report = await fetchReport(reportId, reportTitle)
      const ok = printReport(report)
      if (!ok) {
        toast({ title: 'Popup blocked', description: 'Allow popups to save as PDF.', variant: 'destructive' })
        return
      }
      toast({ title: 'Save as PDF', description: 'Choose "Save as PDF" in the print dialog.', variant: 'success' })
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingId(null)
    }
  }

  const handleExcel = async (reportId, reportTitle) => {
    setLoadingId(`${reportId}-excel`)
    try {
      const report = await fetchReport(reportId, reportTitle)
      exportReportCsv(report)
      toast({ title: 'Download started', description: `${reportTitle} exported as CSV`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Generate and export hospital financial reports" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleReports.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`rounded-xl p-3 ${report.color} text-white shadow-md shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="mt-1">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loadingId}
                    onClick={() => handlePdf(report.id, report.title)}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loadingId}
                    onClick={() => handleExcel(report.id, report.title)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loadingId}
                    onClick={() => handlePrint(report.id, report.title)}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {canViewCredit ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Credit Patients</CardTitle>
            <CardDescription>
              Admission-level credit stays by company. Outstanding amounts use the existing credit-deposit calculation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <select
                className={filterControlClass}
                value={creditFilters.companyId}
                onChange={(event) => setCreditFilters((prev) => ({ ...prev, companyId: event.target.value }))}
                aria-label="Credit company"
              >
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}{company.active === false ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={creditFilters.from}
                onChange={(event) => setCreditFilters((prev) => ({ ...prev, from: event.target.value }))}
                aria-label="Admission from"
                className="sm:max-w-[11rem]"
              />
              <Input
                type="date"
                value={creditFilters.to}
                onChange={(event) => setCreditFilters((prev) => ({ ...prev, to: event.target.value }))}
                aria-label="Admission to"
                className="sm:max-w-[11rem]"
              />
              <select
                className={filterControlClass}
                value={creditFilters.stay}
                onChange={(event) => setCreditFilters((prev) => ({ ...prev, stay: event.target.value }))}
                aria-label="Admission stay"
              >
                <option value="">Current stays</option>
                <option value="discharged">Discharged</option>
                <option value="all">All admissions</option>
              </select>
              <select
                className={filterControlClass}
                value={creditFilters.depositStatus}
                onChange={(event) => setCreditFilters((prev) => ({ ...prev, depositStatus: event.target.value }))}
                aria-label="Credit status"
              >
                <option value="">All credit statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially-paid">Partially paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {creditLoading ? <LoadingState message="Loading credit-patient report…" /> : null}
            {!creditLoading && creditError ? (
              <ErrorState title="Credit patients could not be loaded." message={creditError} onRetry={reloadCredit} />
            ) : null}
            {!creditLoading && !creditError && creditData ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {creditData.summary?.patients || 0} admission{(creditData.summary?.patients || 0) === 1 ? '' : 's'}
                  {' · '}
                  Credit outstanding {formatCurrency(creditData.summary?.creditOutstanding || 0)}
                </p>
                {(creditData.byCompany || []).length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {creditData.byCompany.map((group) => (
                      <div key={group.companyId || group.companyName || 'unrecorded'} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{group.companyName || 'Company not recorded'}</p>
                        <p className="text-muted-foreground">
                          {group.admissions} admission{group.admissions === 1 ? '' : 's'}
                          {' · '}
                          {formatCurrency(group.creditOutstanding)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(creditData.rows || []).length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No credit-patient admissions"
                    description="No admissions match the selected company, dates, or status."
                  />
                ) : (
                  <DataTable columns={creditColumns} data={creditData.rows} />
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
