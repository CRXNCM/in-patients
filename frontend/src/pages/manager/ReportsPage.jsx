import { useState } from 'react'
import {
  FileText, Calendar, CalendarDays, CalendarRange, Building2, Wallet,
  AlertCircle, History, Bed, FileDown, FileSpreadsheet, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { useToast } from '@/context/ToastContext'
import { api, USE_API } from '@/api/client'
import { printReport, exportReportCsv } from '@/lib/printReport'
import {
  patients as mockPatients,
  revenueByDepartment,
  dailyRevenueTrend,
} from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'

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
    default:
      return { ...base, title: 'Report', rows: [] }
  }
}

export default function ReportsPage() {
  const { toast } = useToast()
  const { settings } = useBillingConfig()
  const [loadingId, setLoadingId] = useState(null)

  const fetchReport = async (reportId, reportTitle) => {
    if (USE_API) return api.getManagerReport(reportId)
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
        {reports.map((report) => {
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
    </div>
  )
}
