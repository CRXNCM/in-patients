import { useNavigate } from 'react-router-dom'
import { Eye, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { computeCreditState } from '@/lib/credit'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { stayLocationLabel } from '@/lib/admissions'
import { useAuth } from '@/context/AuthContext'
import { isCreditReceptionUser } from '@/lib/permissions'
import { PatientLink } from '@/components/shared/PatientLink'
import { EditPatientPersonalInfoButton } from '@/components/shared/EditPatientPersonalInfoDialog'

export default function PatientsList() {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const { patients } = usePatients()
  const { getPatientBalance, getBalanceStatus } = useServiceEntries()

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
    { key: 'stay', header: 'Stay', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'status', header: 'Balance', render: (row) => <StatusBadge status={getBalanceStatus(row)} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/reception/patient/${row.id}`) }}>
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
          {hasPermission('patients.edit') || hasPermission('admissions.create') ? (
            <EditPatientPersonalInfoButton patient={row} size="sm" variant="ghost" />
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={isCreditReceptionUser(user) ? 'Credit patients' : 'All Patients'}
        description={
          isCreditReceptionUser(user)
            ? 'Patients admitted on credit, plus stays that used to be credit and are now cash patients.'
            : 'Approved charges only — pending nurse records excluded from balance'
        }
        action={
          hasPermission('admissions.create') ? (
            <Button onClick={() => navigate('/reception/add-patient')}>
              <UserPlus className="h-4 w-4 mr-2" /> Add Patient
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={
          isCreditReceptionUser(user)
            ? patients.filter((row) => {
              const credit = computeCreditState(row)
              return credit.isCreditPatient || credit.formerCreditPatient
            })
            : patients
        }
        onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
      />
    </div>
  )
}
