import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader, StatusBadge, DataTable } from '@/components/shared/CommonComponents'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { computeRecordTotal } from '@/context/ServiceEntriesContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/api/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PatientLink } from '@/components/shared/PatientLink'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { requestSummary } from '@/lib/receptionHistory'

const DEPARTMENTS = ['Pharmacy', 'Laboratory']

function departmentGroups(items = []) {
  const known = DEPARTMENTS.filter((name) => items.some((item) => item.department === name))
  const other = items.some((item) => !DEPARTMENTS.includes(item.department))
  return [
    ...known.map((name) => ({ name, items: items.filter((item) => item.department === name) })),
    ...(other ? [{ name: 'Other services', items: items.filter((item) => !DEPARTMENTS.includes(item.department)) }] : []),
  ]
}

function actionableItems(items = []) {
  return items.filter((item) => item.approveMode !== 'none' && (item.approveMode === 'line' ? item.sourceRecordId && item.lineId : item.billingRecordId))
}

async function approveItem(item) {
  if (item.approveMode === 'line') {
    await api.approveReceptionItem(item.sourceRecordId, item.lineId, 'Approved by reception')
    return
  }
  await api.approveRecord(item.billingRecordId, 'Approved by reception')
}

export default function PendingApprovals() {
  const { toast } = useToast()
  const { refreshRecords } = useServiceEntries()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)
  const [selected, setSelected] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.getReceptionRequests()
      .then((data) => {
        if (!cancelled) setRequests(data.requests || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load reception requests.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [nonce])

  useEffect(() => {
    setSelected((current) => (current ? requests.find((row) => row.id === current.id) || null : null))
  }, [requests])

  const reload = async () => {
    setNonce((value) => value + 1)
    try {
      await refreshRecords?.()
    } catch {
      // The queue reload still shows the saved decision.
    }
  }

  const decide = async (item, decision) => {
    if (busy) return
    setBusy(true)
    try {
      if (item.approveMode === 'line') {
        if (decision === 'approved') await api.approveReceptionItem(item.sourceRecordId, item.lineId, 'Approved by reception')
        else await api.rejectReceptionItem(item.sourceRecordId, item.lineId, rejectReason || 'Rejected by reception')
      } else if (decision === 'approved') {
        await api.approveRecord(item.billingRecordId, 'Approved by reception')
      } else {
        await api.rejectRecord(item.billingRecordId, rejectReason || 'Rejected by reception')
      }
      toast({
        title: decision === 'approved' ? 'Item charged' : 'Item rejected',
        description: 'The other items in this request were left unchanged.',
        variant: 'success',
      })
      setRejectTarget(null)
      setRejectReason('')
      await reload()
    } catch (err) {
      toast({ title: 'Could not save the decision', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const approveAll = async (row) => {
    const items = actionableItems(row?.items)
    if (!items.length || busy) return
    setBusy(true)
    let charged = 0
    let failed = 0
    let lastError = ''
    try {
      for (const item of items) {
        try {
          await approveItem(item)
          charged += 1
        } catch (err) {
          failed += 1
          lastError = err.message
        }
      }
      if (charged && !failed) {
        toast({
          title: charged === 1 ? 'Item charged' : `${charged} items charged`,
          description: 'Every eligible item on this request was approved.',
          variant: 'success',
        })
      } else if (charged && failed) {
        toast({
          title: `${charged} charged, ${failed} could not be saved`,
          description: lastError,
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Could not approve the request', description: lastError, variant: 'destructive' })
      }
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'summary', header: 'Requested services', render: (row) => requestSummary((row.items || []).map((item) => item.description)) },
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => (
        <div>
          <p className="font-medium">{row.patientName}</p>
          <p className="font-mono text-xs text-muted-foreground"><PatientLink patientId={row.patientId}>{row.patientId}</PatientLink></p>
          <AdmissionTypeBadge admissionType={row.admissionType} convertedFromEmergency={row.convertedFromEmergency} />
        </div>
      ),
    },
    { key: 'admissionId', header: 'Admission', render: (row) => row.admissionId ? <span className="font-mono text-xs">{row.admissionId}</span> : '—' },
    { key: 'submittedAt', header: 'Submitted', render: (row) => row.submittedAt ? formatDateTime(row.submittedAt) : '—' },
    { key: 'submittedBy', header: 'Nurse', render: (row) => row.submittedBy || '—' },
    { key: 'eligible', header: 'Eligible', render: (row) => `${row.eligibleCount} of ${row.totalItems}` },
    { key: 'status', header: 'Reception', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (row) => {
        const returnItem = row.wholeRecord && row.actionRecordId
          ? (row.items || []).find((item) => item.billingRecordId === row.actionRecordId)
          : null
        const ready = actionableItems(row.items)
        if (returnItem) {
          return (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-emerald-600" disabled={busy} onClick={(event) => { event.stopPropagation(); decide(returnItem, 'approved') }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button variant="outline" size="sm" className="text-red-600" disabled={busy} onClick={(event) => { event.stopPropagation(); setRejectTarget(returnItem) }}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          )
        }
        return (
          <div className="flex gap-2">
            {ready.length > 1 ? (
              <Button variant="outline" size="sm" className="text-emerald-600" disabled={busy} onClick={(event) => { event.stopPropagation(); approveAll(row) }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve all
              </Button>
            ) : null}
            <Button variant="outline" size="sm" disabled={busy} onClick={(event) => { event.stopPropagation(); setSelected(row) }}>
              <Eye className="h-4 w-4 mr-1" /> Review Items
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title="Pending Approvals" description="One row for each nurse request. Charge eligible items individually, or approve all eligible items at once." />
      {loading ? <LoadingState message="Loading reception requests…" /> : null}
      {error ? <ErrorState title="Reception requests could not be loaded" message={error} onRetry={() => setNonce((value) => value + 1)} /> : null}
      {!loading && !error && requests.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">No requests are waiting for reception.</div>
      ) : null}
      {!loading && !error && requests.length > 0 ? (
        <DataTable columns={columns} data={requests} onRowClick={(row) => setSelected(row)} />
      ) : null}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{requestSummary((selected?.items || []).map((item) => item.description))}</DialogTitle>
            <DialogDescription>
              {selected?.patientName} · {selected?.submittedBy || 'Nurse'} · {selected ? `${selected.eligibleCount} of ${selected.totalItems} items eligible` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected ? departmentGroups(selected.items).map((group) => (
            <section key={group.name} className="mt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</h3>
              <div className="mt-2 divide-y rounded-lg border">
                {group.items.map((item) => (
                  <div key={item.key} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity ?? '—'}{item.unit ? ` ${item.unit}` : ''}
                        {item.total != null ? ` · ${formatCurrency(Math.abs(item.total))}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Department: {item.departmentDecision} · Reception: {item.receptionDecision}</p>
                    </div>
                    {item.approveMode !== 'none' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-emerald-600" disabled={busy} onClick={() => decide(item, 'approved')}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> {item.department === 'Return' ? 'Approve' : 'Approve / Charge'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={() => setRejectTarget(item)}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )) : null}
          <DialogFooter>
            {actionableItems(selected?.items).length > 0 ? (
              <Button variant="outline" className="mr-auto text-emerald-600" disabled={busy} onClick={() => approveAll(selected)}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve all eligible ({actionableItems(selected?.items).length})
              </Button>
            ) : null}
            <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this item?</AlertDialogTitle>
            <AlertDialogDescription>Only this item is rejected. The rest of the request stays as it is.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2"><Label>Reason</Label><Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason..." /></div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => decide(rejectTarget, 'rejected')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function PendingApprovalsPanel({ limit = 5 }) {
  const navigate = useNavigate()
  const { getPendingRecords, approveRecord, rejectRecord } = useServiceEntries()
  const { toast } = useToast()
  const pending = getPendingRecords().slice(0, limit)

  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm mb-8">
      <div className="flex items-center justify-between p-4 border-b border-amber-200 dark:border-amber-800">
        <div>
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-300">Pending Records ({getPendingRecords().length})</h2>
          <p className="text-sm text-amber-700 dark:text-amber-400">Review nurse daily records and pharmacy returns</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/reception/approvals')}>View All</Button>
      </div>
      <div className="divide-y">
        {pending.map((record) => {
          const total = computeRecordTotal(record)
          const itemCount = record.type === 'pharmacy_return' ? record.returnItems?.length : record.services?.length
          return (
            <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{record.recordName}</p>
                <p className="text-xs text-muted-foreground">
                  {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {itemCount} item(s) · {formatCurrency(Math.abs(total))}{total < 0 ? ' credit' : ''}
                </p>
                <p className="text-xs text-muted-foreground">By {record.recordedBy} · {formatDateTime(record.recordedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="pending" />
                <Button size="sm" variant="outline" className="text-emerald-600" onClick={async () => {
                  try {
                    await approveRecord(record.id)
                    toast({ title: 'Approved', variant: 'success' })
                  } catch (err) {
                    toast({ title: 'Approve failed', description: err.message, variant: 'destructive' })
                  }
                }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={async () => {
                  try {
                    await rejectRecord(record.id, 'Rejected from dashboard')
                    toast({ title: 'Rejected', variant: 'success' })
                  } catch (err) {
                    toast({ title: 'Reject failed', description: err.message, variant: 'destructive' })
                  }
                }}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
