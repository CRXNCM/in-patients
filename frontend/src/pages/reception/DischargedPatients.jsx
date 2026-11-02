import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { PatientLink } from '@/components/shared/PatientLink'
import { EditPatientPersonalInfoButton } from '@/components/shared/EditPatientPersonalInfoDialog'
import { useAuth } from '@/context/AuthContext'

export default function DischargedPatients() {
  const navigate = useNavigate()
  const { dischargedPatients } = usePatients()
  const { hasPermission } = useAuth()
  const canEditPersonalInfo = hasPermission('patients.edit') || hasPermission('admissions.create')

  const columns = [
    { key: 'name', header: 'Patient', render: (row) => (
      <PatientLink patientId={row.id} className="font-medium">{row.name}</PatientLink>
    ) },
    { key: 'id', header: 'Patient ID', render: (row) => (
      <PatientLink patientId={row.id} className="font-mono text-xs font-medium">{row.id}</PatientLink>
    ) },
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/reception/patient/${row.id}`) }}>
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
          {canEditPersonalInfo ? <EditPatientPersonalInfoButton patient={row} size="sm" variant="ghost" /> : null}
        </div>
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
