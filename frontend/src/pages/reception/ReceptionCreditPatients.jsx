import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { PatientLink } from '@/components/shared/PatientLink'
import { useCreditPatientRows } from '@/hooks/useCreditPatientRows'
import { creditCompanyLabel, creditStatusLabel } from '@/lib/credit'
import { formatCurrency, formatDate } from '@/lib/utils'
import { stayLocationLabel } from '@/lib/admissions'

export default function ReceptionCreditPatients() {
  const navigate = useNavigate()
  const { rows: allRows } = useCreditPatientRows({ includeDischarged: true })
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter((patient) => {
      const haystack = `${patient.name} ${patient.id} ${patient.creditCompanyName || ''} ${patient.formerCreditCompanyName || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [allRows, search])

  const columns = [
    {
      key: 'id',
      header: 'Patient ID',
      render: (row) => (
        <PatientLink patientId={row.id} className="font-mono text-xs font-medium">{row.id}</PatientLink>
      ),
    },
    {
      key: 'name',
      header: 'Patient',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <PatientLink patientId={row.id} className="font-medium">{row.name}</PatientLink>
          <CreditBadge patient={row} />
        </div>
      ),
    },
    { key: 'company', header: 'Company', render: (row) => creditCompanyLabel(row) },
    { key: 'location', header: 'Room / Bed', render: (row) => stayLocationLabel(row) },
    { key: 'admissionDate', header: 'Admitted', render: (row) => formatDate(row.admissionDate) },
    {
      key: 'outstanding',
      header: 'Unpaid charges',
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.outstanding)}</span>,
    },
    {
      key: 'creditStatus',
      header: 'Credit status',
      render: (row) => creditStatusLabel(row.creditStatus),
    },
    { key: 'stay', header: 'Stay', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/reception/patient/${row.id}`)
          }}
        >
          {row.isCreditPatient ? 'Collect payment' : 'Open record'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Credit patients"
        description="Collect a company payment or a patient deposit. Partial amounts are allowed. When the bill is covered, the stay becomes a normal cash patient and keeps a former-credit mark."
      />
      <div className="mb-4 max-w-md">
        <SearchInput
          label="Search credit patients"
          value={search}
          placeholder="Patient, ID, or company"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/reception/patient/${row.id}`)}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {search.trim() ? 'No credit patients match this search.' : (
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> No credit patients yet.
              </span>
            )}
          </p>
        }
      />
    </div>
  )
}
