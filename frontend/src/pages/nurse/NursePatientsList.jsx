import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { StayLocationFilters } from '@/components/shared/StayLocationFilters'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { usePatientLocationLookup } from '@/hooks/usePatientLocationLookup'
import { locationForPatient, patientMatchesStayFilters } from '@/lib/patientLocation'
import { formatDate } from '@/lib/utils'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { stayLocationLabel } from '@/lib/admissions'
import { useAuth } from '@/context/AuthContext'
import { PatientLink } from '@/components/shared/PatientLink'

export default function NursePatientsList() {
  const navigate = useNavigate()
  const { hasAnyPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const { patients } = usePatients()
  const { getPatientRecords } = useServiceEntries()
  const { bedsByLabel, roomTypeOptions, wardOptions } = usePatientLocationLookup(patients)

  const roomType = params.get('roomType') || ''
  const ward = params.get('ward') || params.get('wardName') || ''
  const status = params.get('status') || ''
  const filters = useMemo(() => ({ roomType, ward, status }), [roomType, ward, status])

  const setFilters = (next) => {
    const query = new URLSearchParams()
    if (next.roomType) query.set('roomType', next.roomType)
    if (next.ward) query.set('ward', next.ward)
    if (next.status) query.set('status', next.status)
    setParams(query, { replace: true })
  }

  const rows = useMemo(
    () => patients.filter((patient) => patientMatchesStayFilters(patient, filters, bedsByLabel)),
    [bedsByLabel, filters, patients]
  )

  const columns = [
    { key: 'id', header: 'Patient ID', render: (row) => (
      <PatientLink patientId={row.id} className="font-mono text-xs font-medium">
        {row.id}
      </PatientLink>
    ) },
    { key: 'name', header: 'Patient Name', render: (row) => (
      <div className="flex flex-col gap-1">
        <PatientLink patientId={row.id} className="font-medium">{row.name}</PatientLink>
        <div className="flex flex-wrap gap-1">
          <AdmissionTypeBadge patient={row} />
          <CreditBadge patient={row} />
        </div>
      </div>
    ) },
    { key: 'room', header: 'Room/Bed', render: (row) => stayLocationLabel(row) },
    { key: 'roomType', header: 'Room type', render: (row) => locationForPatient(row, bedsByLabel).roomType || row.room || '—' },
    { key: 'ward', header: 'Ward', render: (row) => locationForPatient(row, bedsByLabel).wardName || '—' },
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
      <PageHeader
        title="Admitted Patients"
        description="Patients for this desk. Emergency OPD stays with the Emergency Nurse until conversion. Ward nurses see inpatients only."
        action={
          hasAnyPermission(['admissions.create', 'admissions.create_emergency']) ? (
            <Button onClick={() => navigate('/nurse/add-patient')}>
              <Plus className="h-4 w-4 mr-2" /> Emergency Admission
            </Button>
          ) : null
        }
      />
      <div className="mb-4">
        <StayLocationFilters
          roomType={filters.roomType}
          ward={filters.ward}
          status={filters.status}
          roomTypeOptions={roomTypeOptions}
          wardOptions={wardOptions}
          onChange={setFilters}
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/nurse/patient/${row.id}`)}
        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">No active patients match these filters.</p>}
      />
    </div>
  )
}
