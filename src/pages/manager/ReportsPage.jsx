import {
  FileText, Calendar, CalendarDays, CalendarRange, Building2, Wallet,
  AlertCircle, History, Bed, FileDown, FileSpreadsheet, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { useToast } from '@/context/ToastContext'

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

export default function ReportsPage() {
  const { toast } = useToast()

  const handleExport = (reportTitle, format) => {
    toast({
      title: `${format} Export Started`,
      description: `Generating ${reportTitle} as ${format}...`,
      variant: 'success',
    })
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
                  <Button size="sm" variant="outline" onClick={() => handleExport(report.title, 'PDF')}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport(report.title, 'Excel')}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport(report.title, 'Print')}>
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
