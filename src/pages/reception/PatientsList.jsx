import { useNavigate } from 'react-router-dom'
import { Eye, MoreHorizontal, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function PatientsList() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const { getPatientBalance, getBalanceStatus } = useServiceEntries()

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
        const { remainingBalance } = getPatientBalance(row)
        return (
          <span className={remainingBalance >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
            {formatCurrency(remainingBalance)}
          </span>
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
        title="All Patients"
        description="Approved charges only — pending nurse records excluded from balance"
        action={
          <Button onClick={() => navigate('/reception/add-patient')}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Patient
          </Button>
        }
      />
      <DataTable columns={columns} data={patients} onRowClick={(row) => navigate(`/reception/patient/${row.id}`)} />
    </div>
  )
}
