import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Eye, RotateCcw } from 'lucide-react'
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
import { RecordDetailView } from '@/components/shared/RecordTimeline'
import { computeRecordTotal } from '@/context/ServiceEntriesContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default function PendingApprovals() {
  const { toast } = useToast()
  const { getPendingRecords, approveRecord, rejectRecord } = useServiceEntries()
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [rejectRecordId, setRejectRecordId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const pending = getPendingRecords()

  const handleApprove = (record) => {
    approveRecord(record.id, record.type === 'pharmacy_return' ? 'Pharmacy return verified' : 'Daily record verified and approved')
    toast({ title: 'Record Approved', description: `${record.recordName} — added to billing`, variant: 'success' })
    setSelectedRecord(null)
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Provide a rejection reason', variant: 'destructive' })
      return
    }
    rejectRecord(rejectRecordId, rejectReason)
    toast({ title: 'Record Rejected', variant: 'success' })
    setRejectRecordId(null)
    setRejectReason('')
    setSelectedRecord(null)
  }

  const columns = [
    {
      key: 'recordName',
      header: 'Record Name',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.recordName}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.patientId}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          {row.type === 'pharmacy_return' && <RotateCcw className="h-3.5 w-3.5 text-orange-600" />}
          {row.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => row.type === 'pharmacy_return' ? `${row.returnItems?.length || 0} returns` : `${row.services?.length || 0} services`,
    },
    { key: 'total', header: 'Amount', render: (row) => {
      const t = computeRecordTotal(row)
      return <span className={t < 0 ? 'text-emerald-600 font-semibold' : 'font-semibold'}>{t < 0 ? '-' : ''}{formatCurrency(Math.abs(t))}</span>
    }},
    { key: 'recordedBy', header: 'Recorded By' },
    { key: 'recordedAt', header: 'Submitted', render: (row) => formatDateTime(row.recordedAt) },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="pending" /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRecord(row)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => handleApprove(row)}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setRejectRecordId(row.id)}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Pending Approvals" description="Review daily records and pharmacy returns before they affect patient bills" />

      {pending.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">No pending records — all caught up!</div>
      ) : (
        <DataTable columns={columns} data={pending} onRowClick={(row) => setSelectedRecord(row)} />
      )}

      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Entry Details — {selectedRecord?.recordName}</DialogTitle>
            <DialogDescription>Review all services in this record before approving or rejecting</DialogDescription>
          </DialogHeader>
          {selectedRecord && <RecordDetailView record={selectedRecord} showMoney />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>Close</Button>
            {selectedRecord?.status === 'pending' && (
              <>
                <Button variant="destructive" onClick={() => { setRejectRecordId(selectedRecord.id); setSelectedRecord(null) }}>Reject</Button>
                <Button onClick={() => handleApprove(selectedRecord)}>Approve Record</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectRecordId} onOpenChange={() => setRejectRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Record?</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason for the audit trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2"><Label>Reason</Label><Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason..." /></div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
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
                <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => { approveRecord(record.id); toast({ title: 'Approved', variant: 'success' }) }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => { rejectRecord(record.id, 'Rejected from dashboard'); toast({ title: 'Rejected', variant: 'success' }) }}>
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
