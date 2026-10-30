import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { PatientLink } from '@/components/shared/PatientLink'
import { useToast } from '@/context/ToastContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { api } from '@/api/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default function ReceptionMedicineReturns() {
  const { toast } = useToast()
  const { refreshRecords } = useServiceEntries()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listMedicineReturns()
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Medicine returns could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pending = rows.filter((row) => row.billingStatus === 'pending_reception')
  const history = rows.filter((row) => row.billingStatus !== 'pending_reception')

  const decide = async (decision) => {
    if (!selected?.billingRecordId) return
    setBusy(true)
    try {
      if (decision === 'approved') await api.approveRecord(selected.billingRecordId, 'Pharmacy return adjustment approved')
      else await api.rejectRecord(selected.billingRecordId, reason || 'Rejected by reception')
      toast({
        title: decision === 'approved' ? 'Adjustment posted' : 'Adjustment rejected',
        description: decision === 'approved'
          ? 'The original charge and payments were left in place. The accepted quantity was credited through the existing return record.'
          : 'The verified return is kept. No billing adjustment was posted.',
        variant: 'success',
      })
      setSelected(null)
      setRejecting(false)
      setReason('')
      await load()
      refreshRecords()
    } catch (err) {
      toast({ title: 'The decision was not saved', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medicine Returns"
        description="Review pharmacy-verified returns. Approving posts a credit for the accepted quantity and does not change the original charge or payment."
      />
      {loading ? <LoadingState message="Loading medicine returns…" /> : null}
      {error ? <ErrorState title="Medicine returns could not be loaded" message={error} onRetry={load} /> : null}
      {!loading && !error && pending.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No returns waiting for review" description="A return appears here after pharmacy verifies an accepted quantity." />
      ) : null}
      {!loading && !error && pending.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Pending billing review</CardTitle>
            <CardDescription>Only the quantity pharmacy accepted is eligible.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {pending.map((row) => (
                <li key={`${row.orderId}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{row.medicineName}</p>
                    <p className="text-xs text-muted-foreground">
                      <PatientLink patientId={row.patientId}>{row.patientName}</PatientLink> · {row.patientId} · Admission {row.admissionId || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Request {row.submissionId} · Item {row.lineId} · Handed over {row.suppliedQuantity} · Presented {row.presentedQuantity} · Accepted {row.acceptedQuantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.billingStatus} />
                    <Button type="button" size="sm" variant="outline" onClick={() => { setSelected(row); setRejecting(false); setReason('') }}>Review</Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Return history</CardTitle>
            <CardDescription>Verified returns stay on record after the billing decision, including after discharge.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No completed return decisions yet.</p> : (
              <ul className="divide-y rounded-md border">
                {history.slice(0, 40).map((row) => (
                  <li key={`${row.orderId}-${row.id}`} className="px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{row.medicineName} · accepted {row.acceptedQuantity}</p>
                      <span className="flex gap-2">
                        <StatusBadge status={row.physicalStatus} />
                        <StatusBadge status={row.billingStatus} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.patientName} · {row.patientId} · {row.receptionBy || row.verifiedByName || '—'} · {formatDateTime(row.receptionAt || row.verifiedAt || row.at)}
                    </p>
                    {row.billingNote ? <p className="text-xs text-muted-foreground">{row.billingNote}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={!!selected} onOpenChange={(open) => { if (!busy && !open) { setSelected(null); setRejecting(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review {selected?.medicineName}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{selected?.patientName} · {selected?.patientId} · Admission {selected?.admissionId || '—'}</p>
                <p>Request {selected?.submissionId} · Item {selected?.lineId}</p>
                <p>Handed over {selected?.suppliedQuantity} · Presented {selected?.presentedQuantity} · Accepted {selected?.acceptedQuantity} · Not accepted {selected?.notAcceptedQuantity}</p>
                <p>Verified by {selected?.verifiedByName || '—'} · {selected?.verifiedAt ? formatDateTime(selected.verifiedAt) : '—'}</p>
                <p>Reason: {selected?.reason}{selected?.discrepancyReason ? ` · ${selected.discrepancyReason}` : ''}</p>
                <p>Original charge: {selected?.chargeReference || 'No posted charge reference'}{selected?.chargeStatus ? ` · ${selected.chargeStatus}` : ''}</p>
                <p className="font-medium text-foreground">
                  Proposed adjustment: {selected?.proposedAdjustment == null ? 'Cannot be calculated from the stored handover.' : formatCurrency(selected.proposedAdjustment)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rejecting ? (
            <div className="space-y-2">
              <Label htmlFor="return-reject">Reason for rejecting the adjustment</Label>
              <Textarea id="return-reject" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Close</AlertDialogCancel>
            {rejecting ? (
              <AlertDialogAction disabled={busy || reason.trim().length < 3} onClick={(event) => { event.preventDefault(); decide('rejected') }}>
                {busy ? 'Saving…' : 'Reject adjustment'}
              </AlertDialogAction>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={busy || selected?.proposedAdjustment == null} onClick={() => setRejecting(true)}>Reject</Button>
                <AlertDialogAction disabled={busy || selected?.proposedAdjustment == null} onClick={(event) => { event.preventDefault(); decide('approved') }}>
                  {busy ? 'Saving…' : 'Post adjustment'}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
