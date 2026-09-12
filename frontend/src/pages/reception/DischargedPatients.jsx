import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

export default function DischargedPatients() {
  const navigate = useNavigate()
  const { dischargedPatients } = usePatients()

  const columns = [
    { key: 'name', header: 'Patient', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.id}</span> },
    { key: 'room', header: 'Final room', render: (row) => row.discharge?.finalRoom || row.room },
    { key: 'bed', header: 'Final bed', render: (row) => row.discharge?.finalBed || row.bed },
    { key: 'admissionDate', header: 'Admission', render: (row) => formatDate(row.admissionDate) },
    {
      key: 'completed',
      header: 'Discharged',
      render: (row) => (row.discharge?.completedAt ? formatDateTime(row.discharge.completedAt) : '—'),
    },
    { key: 'completedBy', header: 'Completed by', render: (row) => row.discharge?.completedBy || '—' },
    {
      key: 'balance',
      header: 'Final remaining',
      render: (row) => formatCurrency(row.discharge?.finalBalance ?? (row.deposit - (row.totalCharges || 0))),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/reception/patient/${row.id}`) }}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Discharged Patients"
        description="Completed inpatient stays. Historical records are kept; beds have been released."
      />
      <DataTable
        columns={columns}
        data={dischargedPatients}
        onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
      />
    </div>
  )
}
