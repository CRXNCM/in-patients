import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchInput } from '@/components/ui/search-input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { PatientLink } from '@/components/shared/PatientLink'
import { AuditTrail } from '@/components/shared/ServiceTimeline'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { formatDateTime, newClientId } from '@/lib/utils'
import { formatStayLocation } from '@/services/pharmacyFulfillment'
import { stayVisibleToUser } from '@/lib/stayScope'

const PAGE_SIZE = 20

const ACTION_LABELS = {
  approve: 'Approve for reception',
  reject: 'Reject',
  cancel: 'Cancel',
}

const NOTE_PLACEHOLDERS = {
  reject: 'Why this test cannot be released',
  cancel: 'Why this test is being cancelled',
}

function receptionLabel(status) {
  if (status === 'approved') return 'Charge approved'
  if (status === 'pending') return 'Waiting for nurse or reception'
  if (status === 'rejected') return 'Charge rejected'
  return ''
}

function defaultAction(item) {
  return item.status === 'pending' ? 'approve' : 'cancel'
}

function showsNote(action) {
  return action === 'reject' || action === 'cancel'
}

function needsNote(action) {
  return action === 'reject' || action === 'cancel'
}

function matches(order, { status, search, priority, date, ward, sort }) {
  if (status === 'open' && !['pending', 'partially_decided'].includes(order.status)) return false
  if (status !== 'all' && status !== 'open' && order.status !== status) return false
  if (ward && ward !== 'all' && order.ward !== ward) return false
  if (priority !== 'all' && !(order.items || []).some((item) => item.priority === priority)) return false
  if (date && String(order.requestedAt || '').slice(0, 10) !== date) return false
  const q = search.trim().toLowerCase()
  if (q) {
    const names = (order.items || []).map((item) => item.name).join(' ')
    const haystack = `${order.patientName} ${order.patientId} ${order.id} ${order.admissionNumber} ${names}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export default function LaboratoryOrderQueue({
  title = 'Laboratory queue',
  description = 'Tests routed from a nurse record. Approve or reject each test. Approval sends it to reception and does not approve the charge.',
  canProcess = false,
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const {
    laboratoryOrders,
    loading,
    error,
    refresh,
    approveLaboratory,
    rejectLaboratory,
    cancelLaboratory,
  } = useWorkflowRequests()
  const [params] = useSearchParams()
  const patientFilter = params.get('patient') || ''
  const [status, setStatus] = useState(patientFilter ? 'all' : (canProcess ? 'open' : 'all'))
  const [search, setSearch] = useState(patientFilter)
  const [priority, setPriority] = useState('all')
  const [ward, setWard] = useState('all')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const actionIds = useRef(new Map())
  const staff = canProcess && user?.roleKey === 'laboratory'

  const wards = useMemo(
    () => [...new Set(laboratoryOrders.map((order) => order.ward).filter(Boolean))].sort(),
    [laboratoryOrders]
  )
  const rows = useMemo(() => {
    const filtered = laboratoryOrders
      .filter((order) => stayVisibleToUser(order, user))
      .filter((order) => matches(order, { status, search, priority, date, ward, sort }))
    filtered.sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)) * (sort === 'oldest' ? 1 : -1))
    return filtered
  }, [laboratoryOrders, status, search, priority, date, ward, sort, user])

  useEffect(() => { setPage(1) }, [status, search, priority, date, ward, sort])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selected = laboratoryOrders.find((order) => order.id === selectedId) || null
  const filtersActive = Boolean(search || date || priority !== 'all' || ward !== 'all' || status !== 'all')

  const actionId = (orderId, lineId, kind) => {
    const key = `${kind}:${orderId}:${lineId}`
    if (!actionIds.current.has(key)) actionIds.current.set(key, newClientId())
    return actionIds.current.get(key)
  }
  const clearAction = (orderId, lineId, kind) => {
    actionIds.current.delete(`${kind}:${orderId}:${lineId}`)
  }

  const draftOf = (item) => drafts[item.lineId] || { action: defaultAction(item), note: '' }

  const patchDraft = (item, patch) => {
    setRowErrors((current) => ({ ...current, [item.lineId]: '' }))
    setDrafts((current) => ({
      ...current,
      [item.lineId]: { action: defaultAction(item), note: '', ...current[item.lineId], ...patch },
    }))
  }

  const recordLine = async (item, action) => {
    if (busy || !selected) return
    const note = draftOf(item).note.trim()
    if (needsNote(action) && note.length < 3) {
      setRowErrors((current) => ({
        ...current,
        [item.lineId]: 'Enter a reason.',
      }))
      return
    }
    setBusy(true)
    try {
      const clientActionId = actionId(selected.id, item.lineId, action)
      if (action === 'approve') await approveLaboratory(selected.id, item.lineId, clientActionId)
      else if (action === 'reject') await rejectLaboratory(selected.id, item.lineId, { clientActionId, reason: note })
      else await cancelLaboratory(selected.id, item.lineId, { clientActionId, reason: note })
      clearAction(selected.id, item.lineId, action)
      setDrafts((current) => {
        const next = { ...current }
        delete next[item.lineId]
        return next
      })
      const success = action === 'approve'
        ? 'Test released to reception. The charge is still pending reception approval.'
        : 'Laboratory request updated.'
      toast({ title: success, variant: 'success' })
    } catch (err) {
      setRowErrors((current) => ({ ...current, [item.lineId]: err.message }))
      toast({ title: 'Could not update the test', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

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
    { key: 'tests', header: 'Tests', render: (row) => row.items?.length || 0 },
    { key: 'nurse', header: 'Requesting nurse', render: (row) => row.requestedByName || '—' },
    { key: 'requestedAt', header: 'Requested', render: (row) => formatDateTime(row.requestedAt) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id) }}>
          <Eye className="h-4 w-4" /> {staff ? 'Review' : 'Open'}
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
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="lab-search">Search</Label>
          <SearchInput id="lab-search" value={search} placeholder="Patient, ID, admission, or test" onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-status">Status</Label>
          <NativeSelect id="lab-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="open">Needs action</option>
            <option value="all">All</option>
            <option value="pending">Pending departmental approval</option>
            <option value="partially_decided">Partly decided</option>
            <option value="approved">Department approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-priority">Priority</Label>
          <NativeSelect id="lab-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-ward">Ward</Label>
          <NativeSelect id="lab-ward" value={ward} onChange={(event) => setWard(event.target.value)}>
            <option value="all">All wards</option>
            {wards.map((name) => <option key={name} value={name}>{name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-date">Request date</Label>
          <div className="flex gap-2">
            <Input id="lab-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            {date ? <Button type="button" variant="outline" onClick={() => setDate('')}>Clear</Button> : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-sort">Sort</Label>
          <NativeSelect id="lab-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </NativeSelect>
        </div>
      </div>

      {loading && !laboratoryOrders.length ? <LoadingState message="Loading laboratory requests…" /> : (
        <DataTable
          key={`${status}|${search}|${priority}|${ward}|${date}|${sort}|${safePage}`}
          columns={columns}
          data={pageRows}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyState={(
            <EmptyState
              icon={ClipboardList}
              title="No laboratory requests"
              description={laboratoryOrders.length && filtersActive
                ? 'No requests match these filters.'
                : 'Laboratory tests appear here after a nurse submits them from the patient record.'}
            />
          )}
        />
      )}
      {rows.length > PAGE_SIZE ? (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
            <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDrafts({}); setRowErrors({}) } }}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {selected?.patientName}
              {selected ? <StatusBadge status={selected.status} /> : null}
            </DialogTitle>
            <DialogDescription>
              {selected ? `${selected.patientId} · ${formatStayLocation(selected)} · ${selected.requestedByName || 'Nurse'} · ${formatDateTime(selected.requestedAt)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Test</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.items || []).map((item) => {
                      const ownPending = user?.roleKey === 'nurse'
                        && item.status === 'pending'
                        && String(selected.requestedById) === String(user.id)
                      const canCancel = item.receptionStatus !== 'approved'
                        && ['pending', 'approved', 'processing'].includes(item.status)
                        && (staff || ownPending)
                      const actions = []
                      if (staff && item.status === 'pending') actions.push('approve', 'reject')
                      if (canCancel && !actions.includes('cancel')) actions.push('cancel')
                      const draft = draftOf(item)
                      const action = actions.includes(draft.action) ? draft.action : actions[0]
                      const showNote = showsNote(action)
                      const error = rowErrors[item.lineId]
                      return (
                        <tr key={item.lineId} className="border-b last:border-0 align-middle">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[
                                item.priority === 'urgent' ? 'Urgent' : 'Routine',
                                item.note,
                                receptionLabel(item.receptionStatus),
                                item.completionNote ? `Note: ${item.completionNote}` : '',
                                item.reason ? `Reason: ${item.reason}` : '',
                              ].filter(Boolean).join(' · ')}
                            </p>
                            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{item.quantity || 1}</td>
                          <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                          {actions.length ? (
                            <>
                              <td className="px-3 py-2">
                                <NativeSelect
                                  aria-label={`Action for ${item.name}`}
                                  className="h-9 min-w-[11rem]"
                                  value={action}
                                  onChange={(event) => patchDraft(item, { action: event.target.value, note: '' })}
                                >
                                  {actions.map((value) => (
                                    <option key={value} value={value}>{ACTION_LABELS[value]}</option>
                                  ))}
                                </NativeSelect>
                              </td>
                              <td className="px-3 py-2">
                                {showNote ? (
                                  <Input
                                    aria-label={`Reason for ${item.name}`}
                                    className="h-9 min-w-[16rem]"
                                    placeholder={NOTE_PLACEHOLDERS[action]}
                                    value={draft.note}
                                    onChange={(event) => patchDraft(item, { action, note: event.target.value })}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Button type="button" size="sm" disabled={busy} onClick={() => recordLine(item, action)}>
                                  Record
                                </Button>
                              </td>
                            </>
                          ) : (
                            <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={3}>
                              {item.completionNote || 'No further action'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {selected.history?.length ? (
                <AuditTrail trail={selected.history.map((event) => ({ action: event.action, by: event.by, at: event.at, note: event.note }))} />
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
