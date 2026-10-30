import { useMemo, useState } from 'react'
import { ClipboardList, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { PatientLink } from '@/components/shared/PatientLink'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { usePatients } from '@/context/PatientsContext'
import { canCancelRequest, canCreateWorkflowRequest } from '@/lib/workflowAccess'
import { formatDateTime } from '@/lib/utils'
import { admissionLabel, locationLabel, queryWorkflowRequests } from '@/services/workflowRequests'
import { LaboratoryRequestForm, PharmacyRequestForm } from './RequestForms'
import { useWorkflowMutations } from './useWorkflowMutations'


function PatientCell({ request }) {
  if (request.demonstration) {
    return (
      <div>
        <p className="font-medium">{request.patientName}</p>
        <p className="font-mono text-xs text-muted-foreground">{request.patientId}</p>
        <Badge variant="outline" className="mt-1">Demonstration</Badge>
      </div>
    )
  }
  return (
    <div>
      <PatientLink patientId={request.patientId} className="font-medium">{request.patientName}</PatientLink>
      <p className="font-mono text-xs text-muted-foreground">
        <PatientLink patientId={request.patientId}>{request.patientId}</PatientLink>
      </p>
      <AdmissionTypeBadge
        admissionType={request.admissionType}
        convertedFromEmergency={request.convertedFromEmergency}
        className="mt-1"
      />
    </div>
  )
}

export default function WorkflowQueuePage({
  kind,
  audience = 'view',
  title,
  description,
}) {
  const pharmacy = kind === 'pharmacy'
  const { patients, loading: patientsLoading } = usePatients()
  const {
    requests,
    loading: requestsLoading,
    error,
    user,
    canFulfill,
    canProcess,
    setSelectedId,
    setConfirm,
    setReason,
    dialogs,
  } = useWorkflowMutations()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState('newest')

  const canCreate = audience === 'track' && canCreateWorkflowRequest(user)
  const rows = useMemo(() => queryWorkflowRequests(requests, {
    kind,
    status,
    search,
    priority: pharmacy ? 'all' : priority,
    date: pharmacy ? '' : date,
    sort,
  }), [requests, kind, status, search, priority, date, sort, pharmacy])
  const hasKind = requests.some((request) => request.kind === kind)
  const filtersActive = Boolean(search || date || priority !== 'all' || status !== 'all')

  const columns = [
    { key: 'patient', header: 'Patient', render: (row) => <PatientCell request={row} /> },
    { key: 'admission', header: 'Admission', render: (row) => admissionLabel(row) },
    { key: 'location', header: 'Ward / room', render: (row) => locationLabel(row) },
    { key: 'item', header: pharmacy ? 'Medicine' : 'Test', render: (row) => row.itemName },
    ...(pharmacy ? [{
      key: 'quantity',
      header: 'Quantity',
      render: (row) => `${row.quantity}${row.unit ? ` ${row.unit}` : ''}`,
    }, {
      key: 'dosage',
      header: 'Instructions',
      render: (row) => row.dosage || '—',
    }] : [{
      key: 'priority',
      header: 'Priority',
      render: (row) => (row.priority === 'urgent' ? 'Urgent' : 'Routine'),
    }]),
    { key: 'nurse', header: 'Nurse', render: (row) => row.requestedByName },
    { key: 'requestedAt', header: 'Requested', render: (row) => formatDateTime(row.requestedAt) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id) }}>
            <Eye className="h-4 w-4" /> View
          </Button>
          {canFulfill && row.kind === 'pharmacy' && row.status === 'pending' ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setConfirm({ type: 'approve', request: row }) }}>Approve</Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={(event) => { event.stopPropagation(); setReason({ type: 'reject', request: row }) }}>Reject</Button>
            </>
          ) : null}
          {canProcess && row.kind === 'laboratory' && row.status === 'pending' ? (
            <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setConfirm({ type: 'accept', request: row }) }}>Accept</Button>
          ) : null}
          {canProcess && row.kind === 'laboratory' && row.status === 'processing' ? (
            <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setReason({ type: 'complete', request: row }) }}>Complete</Button>
          ) : null}
          {canCancelRequest(user, row) ? (
            <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setReason({ type: 'cancel', request: row }) }}>Cancel</Button>
          ) : null}
        </div>
      ),
    },
  ]

  const statusOptions = pharmacy
    ? [['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']]
    : [['all', 'All'], ['open', 'Needs action'], ['pending', 'Pending'], ['processing', 'Processing'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]

  return (
    <div>
      <PageHeader title={title} description={description} />
      {error ? <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {requests.some((request) => request.demonstration) ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Rows marked Demonstration are sample requests for this screen. They are not live admissions.
        </p>
      ) : null}

      {canCreate ? (
        <div className="mb-6">
          {patientsLoading ? <LoadingState message="Loading admitted patients…" /> : (
            pharmacy
              ? <PharmacyRequestForm patients={patients} />
              : <LaboratoryRequestForm patients={patients} />
          )}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${kind}-search`}>Search</Label>
          <SearchInput
            id={`${kind}-search`}
            value={search}
            placeholder={pharmacy ? 'Patient, ID, or medicine' : 'Patient, ID, or test'}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${kind}-status`}>Status</Label>
          <NativeSelect id={`${kind}-status`} value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${kind}-sort`}>Sort</Label>
          <NativeSelect id={`${kind}-sort`} value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </NativeSelect>
        </div>
        {pharmacy ? null : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-priority`}>Priority</Label>
              <NativeSelect id={`${kind}-priority`} value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="all">All priorities</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-date`}>Request date</Label>
              <div className="flex gap-2">
                <Input id={`${kind}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                {date ? <Button type="button" variant="outline" onClick={() => setDate('')}>Clear</Button> : null}
              </div>
            </div>
          </>
        )}
      </div>

      {requestsLoading && !requests.length ? <LoadingState message="Loading laboratory requests…" /> : (
      <DataTable
        key={`${status}|${search}|${priority}|${date}|${sort}`}
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyState={(
          <EmptyState
            icon={ClipboardList}
            title="No requests"
            description={hasKind && filtersActive ? 'No requests match these filters.' : 'No requests have been submitted.'}
          />
        )}
      />
      )}
      {dialogs}
    </div>
  )
}
