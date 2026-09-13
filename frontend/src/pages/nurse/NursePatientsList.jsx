import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatDate } from '@/lib/utils'
import { CreditBadge } from '@/components/shared/CreditBadge'

export default function NursePatientsList() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const { getPatientRecords } = useServiceEntries()

  const columns = [
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.id}</span> },
    { key: 'name', header: 'Patient Name', render: (row) => (
      <div className="flex flex-col gap-1">
        <span className="font-medium">{row.name}</span>
        <div className="flex flex-wrap gap-1">
          {row.admissionType === 'maternity' && (
            <span className="text-[10px] uppercase tracking-wide rounded bg-rose-100 text-rose-700 px-1.5 py-0.5">Maternity</span>
          )}
          <CreditBadge patient={row} />
        </div>
      </div>
    ) },
    { key: 'room', header: 'Room/Bed', render: (row) => `${row.room} / ${row.bed}` },
    { key: 'admissionDate', header: 'Admission Date', render: (row) => formatDate(row.admissionDate) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'pending', header: 'Pending Records', render: (row) => getPatientRecords(row.id).filter((r) => r.status === 'pending').length },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/nurse/patient/${row.id}`) }}>
          <Plus className="h-4 w-4 mr-1" /> Record Services
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Admitted Patients" description="Select a patient to build today's service record" />
      <DataTable columns={columns} data={patients} onRowClick={(row) => navigate(`/nurse/patient/${row.id}`)} />
    </div>
  )
}
