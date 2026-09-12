import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { formatDate, formatDateTime } from '@/lib/utils'

export default function PendingDischarges() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const pending = patients.filter((p) => p.status === 'pending-discharge')

  const columns = [
    { key: 'name', header: 'Patient', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.id}</span> },
    { key: 'room', header: 'Room' },
    { key: 'bed', header: 'Bed' },
    { key: 'admissionDate', header: 'Admission date', render: (row) => formatDate(row.admissionDate) },
    {
      key: 'requested',
      header: 'Requested',
      render: (row) => (row.discharge?.requestedAt ? formatDateTime(row.discharge.requestedAt) : '—'),
    },
    { key: 'requestedBy', header: 'Requested by', render: (row) => row.discharge?.requestedBy || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/reception/patient/${row.id}`) }}>
          <Eye className="h-4 w-4 mr-1" /> Review
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pending Discharges"
        description="Nurse requests awaiting reception review. Patients still occupy their room and bed."
      />
      <DataTable
        columns={columns}
        data={pending}
        onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
      />
    </div>
  )
}
