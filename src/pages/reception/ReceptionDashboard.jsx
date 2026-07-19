import { useNavigate } from 'react-router-dom'
import { Users, Wallet, AlertTriangle, LogOut, Eye, MoreHorizontal, ClipboardCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard, StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { PendingApprovalsPanel } from '@/pages/reception/PendingApprovals'
import { todayDeposits } from '@/data/mockData'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function ReceptionDashboard() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const { getPatientBalance, getBalanceStatus, getPendingCount } = useServiceEntries()

  const lowBalanceCount = patients.filter((p) => getBalanceStatus(p) !== 'sufficient').length
  const pendingDischarges = patients.filter((p) => p.pendingDischarge).length
  const pendingApprovals = getPendingCount()

  const columns = [
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.id}</span> },
    { key: 'name', header: 'Patient Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'room', header: 'Room/Bed', render: (row) => `${row.room} / ${row.bed}` },
    { key: 'admissionDate', header: 'Admission Date', render: (row) => formatDate(row.admissionDate) },
    { key: 'deposit', header: 'Deposit', render: (row) => formatCurrency(row.deposit) },
    { key: 'totalCharges', header: 'Approved Charges', render: (row) => formatCurrency(getPatientBalance(row).totalCharges) },
    {
      key: 'remaining',
      header: 'Remaining Balance',
      render: (row) => {
        const { remainingBalance, pendingCharges } = getPatientBalance(row)
        return (
          <div>
            <span className={remainingBalance >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
              {formatCurrency(remainingBalance)}
            </span>
            {pendingCharges > 0 && <p className="text-xs text-amber-600">+{formatCurrency(pendingCharges)} pending</p>}
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={getBalanceStatus(row)} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/reception/patient/${row.id}`) }}>
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Reception Dashboard"
        description="Manage admitted patients, approve nurse records, and process billing"
        action={
          <Button onClick={() => navigate('/reception/add-patient')}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Patient
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard title="Total Admitted Patients" value={patients.length} subtitle="Currently in hospital" icon={Users} iconClassName="bg-blue-100 text-blue-600" />
        <StatCard title="Pending Approvals" value={pendingApprovals} subtitle="Records to review" icon={ClipboardCheck} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Today's Deposits" value={formatCurrency(todayDeposits)} subtitle="Collected today" icon={Wallet} iconClassName="bg-emerald-100 text-emerald-600" trend={{ positive: true, value: '12% vs yesterday' }} />
        <StatCard title="Patients with Low Balance" value={lowBalanceCount} subtitle="Below threshold" icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Pending Discharges" value={pendingDischarges} subtitle="Awaiting clearance" icon={LogOut} iconClassName="bg-purple-100 text-purple-600" />
      </div>

      <PendingApprovalsPanel limit={4} />

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Admitted Patients</h2>
            <p className="text-sm text-muted-foreground">Balances reflect approved charges only</p>
          </div>
          <Button onClick={() => navigate('/reception/patients')}>View All</Button>
        </div>
        <DataTable columns={columns} data={patients} onRowClick={(row) => navigate(`/reception/patient/${row.id}`)} />
      </div>
    </div>
  )
}
