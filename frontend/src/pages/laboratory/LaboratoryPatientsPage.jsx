import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { PatientLink } from '@/components/shared/PatientLink'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { useAuth } from '@/context/AuthContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { formatDateTime } from '@/lib/utils'
import { stayVisibleToUser } from '@/lib/stayScope'
import { formatStayLocation } from '@/services/pharmacyFulfillment'
import { groupLaboratoryPatients } from '@/services/laboratoryOrders'

function testSummary(names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return '—'
  if (unique.length <= 3) return unique.join(', ')
  return `${unique.slice(0, 3).join(', ')} +${unique.length - 3} more`
}

export default function LaboratoryPatientsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { laboratoryOrders, loading, error, refresh } = useWorkflowRequests()
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const grouped = groupLaboratoryPatients(
      laboratoryOrders.filter((order) => stayVisibleToUser(order, user))
    )
    const q = search.trim().toLowerCase()
    if (!q) return grouped
    return grouped.filter((row) => {
      const haystack = `${row.name} ${row.patientId} ${row.admissionNumber} ${row.tests.join(' ')}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [laboratoryOrders, search, user])

  const columns = [
    {
      key: 'id',
      header: 'Patient ID',
      render: (row) => (
        <PatientLink patientId={row.patientId} className="font-mono text-xs font-medium">
          {row.patientId}
        </PatientLink>
      ),
    },
    {
      key: 'name',
      header: 'Patient',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <PatientLink patientId={row.patientId} className="font-medium">
            {row.name}
          </PatientLink>
          <AdmissionTypeBadge admissionType={row.admissionType} />
        </div>
      ),
    },
    { key: 'location', header: 'Ward / room / bed', render: (row) => formatStayLocation(row) },
    { key: 'requests', header: 'Requests', render: (row) => row.requestCount },
    { key: 'tests', header: 'Tests', render: (row) => row.testCount },
    {
      key: 'recent',
      header: 'Recent tests',
      render: (row) => (
        <span className="block max-w-[18rem] truncate whitespace-normal" title={row.tests.join(', ')}>
          {testSummary(row.tests)}
        </span>
      ),
    },
    { key: 'lastRequestedAt', header: 'Last request', render: (row) => formatDateTime(row.lastRequestedAt) || '—' },
    {
      key: 'status',
      header: 'Lab status',
      render: (row) => (
        <StatusBadge status={row.pendingTests > 0 ? (row.releasedTests > 0 ? 'partially_decided' : 'pending') : 'approved'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/laboratory?patient=${encodeURIComponent(row.patientId)}`)
          }}
        >
          <ClipboardList className="mr-1 h-4 w-4" />
          Requests
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Patients who used the laboratory"
        description="Every patient with a laboratory request from a nurse record. Open a row to review that patient's tests in the queue."
      />
      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>Retry</Button>
        </div>
      ) : null}
      <div className="mb-4 max-w-md">
        <SearchInput
          label="Search laboratory patients"
          value={search}
          placeholder="Patient name, ID, admission, or test"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading && !laboratoryOrders.length ? (
        <LoadingState message="Loading laboratory patients…" />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => navigate(`/laboratory?patient=${encodeURIComponent(row.patientId)}`)}
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search.trim() ? 'No laboratory patients match this search.' : 'No patients have laboratory requests yet.'}
            </p>
          }
        />
      )}
    </div>
  )
}
