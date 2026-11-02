import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { PatientLink } from '@/components/shared/PatientLink'
import { useToast } from '@/context/ToastContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/utils'
import { formatStayLocation, queryPharmacyOrders } from '@/services/pharmacyFulfillment'
import { stayVisibleToUser } from '@/lib/stayScope'
import { PharmacyFulfillmentDialog } from './PharmacyFulfillmentDialog'

export default function PharmacyQueue({
  title = 'Pharmacy queue',
  description = 'Medicine requests routed from a nurse record. Each row is one submission for one admission.',
  canFulfill = false,
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { pharmacyOrders, loading, error, handOver, refresh } = useWorkflowRequests()
  const [status, setStatus] = useState(canFulfill ? 'open' : 'all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const fulfill = canFulfill && user?.roleKey === 'pharmacist'

  const rows = useMemo(
    () => queryPharmacyOrders(pharmacyOrders.filter((order) => stayVisibleToUser(order, user)), { status, search, sort }),
    [pharmacyOrders, status, search, sort, user]
  )
  useEffect(() => { setPage(1) }, [status, search, sort])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selected = pharmacyOrders.find((order) => order.id === selectedId) || null
  const filtersActive = Boolean(search || status !== 'all')

  const columns = [
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => (
        <div>
          <PatientLink patientId={row.patientId} className="font-medium">{row.patientName}</PatientLink>
          <p className="font-mono text-xs text-muted-foreground">{row.patientId}</p>
        </div>
      ),
    },
    { key: 'admission', header: 'Admission', render: (row) => row.admissionNumber || row.patientId },
    { key: 'location', header: 'Ward / room / bed', render: (row) => formatStayLocation(row) },
    { key: 'nurse', header: 'Requesting nurse', render: (row) => row.requestedByName || '—' },
    { key: 'requestedAt', header: 'Requested', render: (row) => formatDateTime(row.requestedAt) },
    { key: 'count', header: 'Medicines', render: (row) => row.items?.length || 0 },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id) }}>
          <Eye className="h-4 w-4" /> {fulfill ? 'Process' : 'Open'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title={title} description={description} />
      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>Retry</Button>
        </div>
      ) : null}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pharmacy-search">Search</Label>
          <SearchInput id="pharmacy-search" value={search} placeholder="Patient, ID, admission, or nurse" onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pharmacy-status">Status</Label>
          <NativeSelect id="pharmacy-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="open">Needs action</option>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="partially_fulfilled">Partially fulfilled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="resolved_with_exceptions">Resolved with exceptions</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pharmacy-sort">Sort</Label>
          <NativeSelect id="pharmacy-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </NativeSelect>
        </div>
      </div>
      {loading && !pharmacyOrders.length ? <LoadingState message="Loading pharmacy requests…" /> : (
        <DataTable
          key={`${status}|${search}|${sort}|${safePage}`}
          columns={columns}
          data={pageRows}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyState={(
            <EmptyState
              icon={ClipboardList}
              title="No pharmacy requests"
              description={pharmacyOrders.length && filtersActive
                ? 'No requests match these filters.'
                : 'Medicine requests appear here after a nurse submits them from the patient record.'}
            />
          )}
        />
      )}
      {rows.length > pageSize ? (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of {rows.length}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
            <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
      <PharmacyFulfillmentDialog
        order={selected}
        canFulfill={fulfill}
        onOpenChange={(open) => { if (!open) setSelectedId(null) }}
        onSubmit={async (id, body) => {
          try {
            await handOver(id, body)
            toast({ title: 'Handover recorded', description: 'The medicine line was updated.', variant: 'success' })
          } catch (err) {
            toast({ title: 'Handover was not saved', description: err.message, variant: 'destructive' })
            throw err
          }
        }}
      />
    </div>
  )
}
