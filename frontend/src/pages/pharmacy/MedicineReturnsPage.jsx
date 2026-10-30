import { useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchInput } from '@/components/ui/search-input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { formatDateTime } from '@/lib/utils'
import { isActiveStay } from '@/lib/patientLocation'
import { applyReturn, formatStayLocation, medicineSummary, RETURN_REASONS, verifyReturn } from '@/services/pharmacyFulfillment'

export default function MedicineReturnsPage() {
  const { patients, loading: patientsLoading } = usePatients()
  const { pharmacyOrders, loading, error, recordReturn, verifyMedicineReturn, refresh } = useWorkflowRequests()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [patientId, setPatientId] = useState('')
  const [selection, setSelection] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [reasonCode, setReasonCode] = useState('unused')
  const [reasonNote, setReasonNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const actionId = useRef('')
  const [verifyTarget, setVerifyTarget] = useState(null)
  const [accepted, setAccepted] = useState('1')
  const [discrepancy, setDiscrepancy] = useState('')
  const [notes, setNotes] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifyConfirm, setVerifyConfirm] = useState(false)
  const verifyActionId = useRef('')

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((patient) => {
      if (!isActiveStay(patient)) return false
      if (!q) return true
      return `${patient.name} ${patient.id} ${patient.room || ''} ${patient.bed || ''}`.toLowerCase().includes(q)
    })
  }, [patients, search])

  const patient = patients.find((item) => item.id === patientId) || null
  const orders = pharmacyOrders.filter((order) => {
    if (!patient || order.patientId !== patient.id) return false
    if (patient.admissionId && order.admissionId && order.admissionId !== patient.admissionId) return false
    return true
  })
  const held = orders.flatMap((order) => medicineSummary(order)
    .filter((line) => line.netHeld > 0 && Number(line.suppliedQuantity) > 0)
    .map((line) => ({ order, line })))
  const selected = held.find((item) => item.order.id === selection?.orderId && item.line.lineId === selection?.lineId) || null

  const pending = pharmacyOrders.flatMap((order) => (order.returns || [])
    .filter((entry) => entry.physicalStatus === 'pending_verification')
    .map((entry) => ({ entry, order, line: order.items?.find((item) => item.lineId === entry.lineId) })))
    .sort((a, b) => String(b.entry.at).localeCompare(String(a.entry.at)))

  const history = pharmacyOrders.flatMap((order) => (order.returns || [])
    .filter((entry) => entry.physicalStatus && entry.physicalStatus !== 'pending_verification')
    .map((entry) => ({ entry, order, line: order.items?.find((item) => item.lineId === entry.lineId) })))
    .sort((a, b) => String(b.entry.verifiedAt || b.entry.at).localeCompare(String(a.entry.verifiedAt || a.entry.at)))

  const choosePatient = (id) => {
    setPatientId(id)
    setSelection(null)
    setFormError('')
    actionId.current = ''
  }

  const chooseMedicine = (orderId, lineId) => {
    setSelection({ orderId, lineId })
    setQuantity('1')
    setReasonCode('unused')
    setReasonNote('')
    setFormError('')
    actionId.current = ''
  }

  const review = () => {
    if (!selected) return
    if (!actionId.current) actionId.current = crypto.randomUUID()
    const preview = applyReturn(selected.order, { id: 'preview', name: 'Pharmacist' }, {
      clientActionId: actionId.current,
      lineId: selected.line.lineId,
      admissionId: selected.order.admissionId,
      quantity: Number(quantity),
      reasonCode,
      reasonNote,
    })
    if (preview.error) {
      setFormError(preview.error)
      return
    }
    setFormError('')
    setConfirm(true)
  }

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await recordReturn(selected.order.id, {
        clientActionId: actionId.current,
        lineId: selected.line.lineId,
        admissionId: selected.order.admissionId,
        quantity: Number(quantity),
        reasonCode,
        reasonNote,
      })
      toast({ title: 'Return sent for verification', description: 'Billing is unchanged until pharmacy accepts a quantity and reception reviews it.', variant: 'success' })
      setConfirm(false)
      setSelection(null)
      setReasonNote('')
      actionId.current = ''
    } catch (err) {
      setConfirm(false)
      setFormError(err.message)
      toast({ title: 'Return was not saved', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const openVerify = (row) => {
    setVerifyTarget(row)
    setAccepted(String(row.entry.presentedQuantity || row.entry.quantity || 1))
    setDiscrepancy('')
    setNotes('')
    setVerifyError('')
    verifyActionId.current = ''
    setVerifyConfirm(false)
  }

  const reviewVerify = () => {
    if (!verifyTarget) return
    if (!verifyActionId.current) verifyActionId.current = crypto.randomUUID()
    const preview = verifyReturn(verifyTarget.order, { id: 'preview', name: 'Pharmacist' }, {
      clientActionId: verifyActionId.current,
      returnId: verifyTarget.entry.id,
      acceptedQuantity: Number(accepted),
      discrepancyReason: discrepancy,
      verificationNotes: notes,
    })
    if (preview.error) {
      setVerifyError(preview.error)
      return
    }
    setVerifyError('')
    setVerifyConfirm(true)
  }

  const submitVerify = async () => {
    if (!verifyTarget) return
    setBusy(true)
    try {
      await verifyMedicineReturn(verifyTarget.order.id, verifyTarget.entry.id, {
        clientActionId: verifyActionId.current,
        acceptedQuantity: Number(accepted),
        discrepancyReason: discrepancy,
        verificationNotes: notes,
      })
      const acceptedQty = Number(accepted)
      toast({
        title: acceptedQty > 0 ? 'Return verified' : 'Return not accepted',
        description: acceptedQty > 0
          ? 'The accepted quantity is waiting for reception. The original handover was not changed.'
          : 'Nothing was accepted, so no billing adjustment was created.',
        variant: 'success',
      })
      setVerifyConfirm(false)
      setVerifyTarget(null)
      verifyActionId.current = ''
    } catch (err) {
      setVerifyConfirm(false)
      setVerifyError(err.message)
      toast({ title: 'Verification was not saved', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Medicine Returns"
        description="Record medicine brought back, then verify the quantity pharmacy accepts. Billing stays with reception."
      />
      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>Retry</Button>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Find the admission</CardTitle>
            <CardDescription>Admitted patients and patients pending discharge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SearchInput value={search} placeholder="Name, ID, room, or bed" onChange={(event) => setSearch(event.target.value)} />
            {patientsLoading || loading ? <LoadingState message="Loading patients…" /> : matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching active admission.</p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
                {matches.slice(0, 30).map((item) => (
                  <li key={item.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => choosePatient(item.id)}>
                      <span className="block text-sm font-medium">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">{item.id} · {item.room} · {item.bed}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!patient ? (
            <EmptyState icon={RotateCcw} title="Select an admission" description="A return is recorded against the original handover for that stay." />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{patient.name}</CardTitle>
                <CardDescription>
                  {patient.id} · Admission {patient.admissionId || patient.id} · {patient.status === 'pending-discharge' ? 'Pending discharge' : 'Admitted'} · {patient.room} / {patient.bed}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {held.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No handed-over medicine remains eligible for return on this admission.</p>
                ) : held.map(({ order, line }) => (
                  <button
                    key={`${order.id}-${line.lineId}`}
                    type="button"
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted/40"
                    onClick={() => chooseMedicine(order.id, line.lineId)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{line.name}</span>
                      <StatusBadge status={line.status} />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Request {order.submissionId} · Item {line.lineId} · Requested {line.requestedQuantity} · Handed over {line.suppliedQuantity} · Accepted returns {line.acceptedReturned} · Awaiting verification {line.pendingPresented} · Eligible {line.netHeld}
                      {line.unit ? ` ${line.unit}` : ''} · {formatStayLocation(order)} · {formatDateTime(order.requestedAt)}
                    </span>
                  </button>
                ))}
                {selected ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Initiate return — {selected.line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Up to {selected.line.netHeld} can be presented. This does not change the handover or the bill.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="return-qty">Quantity presented</Label>
                        <Input id="return-qty" type="number" min="1" max={selected.line.netHeld} value={quantity} onChange={(event) => { actionId.current = ''; setQuantity(event.target.value) }} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return-reason">Reason</Label>
                        <NativeSelect id="return-reason" value={reasonCode} onChange={(event) => { actionId.current = ''; setReasonCode(event.target.value) }}>
                          {RETURN_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="return-note">{reasonCode === 'other' ? 'Explanation' : 'Note (optional)'}</Label>
                        <Textarea id="return-note" value={reasonNote} onChange={(event) => { actionId.current = ''; setReasonNote(event.target.value) }} />
                      </div>
                    </div>
                    {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                    <Button type="button" onClick={review}>Initiate return</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending verification</CardTitle>
              <CardDescription>Presented returns that pharmacy has not accepted or rejected yet.</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? <p className="text-sm text-muted-foreground">No returns are waiting for verification.</p> : (
                <ul className="divide-y rounded-md border">
                  {pending.map(({ entry, order, line }) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{line?.name || 'Medicine'} · presented {entry.presentedQuantity}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.patientName} · {order.patientId} · Request {order.submissionId} · {entry.pharmacistName} · {formatDateTime(entry.at)}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status="pending_verification" />
                        <Button type="button" size="sm" variant="outline" onClick={() => openVerify({ entry, order, line })}>Verify</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {verifyTarget ? (
                <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Verify {verifyTarget.line?.name}</p>
                  <p className="text-xs text-muted-foreground">Presented {verifyTarget.entry.presentedQuantity}. Accept only the quantity pharmacy keeps. The rest is not a return.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accepted-qty">Quantity accepted</Label>
                      <Input id="accepted-qty" type="number" min="0" max={verifyTarget.entry.presentedQuantity} value={accepted} onChange={(event) => { verifyActionId.current = ''; setAccepted(event.target.value) }} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="discrepancy">Reason for any quantity not accepted</Label>
                      <Textarea id="discrepancy" value={discrepancy} onChange={(event) => { verifyActionId.current = ''; setDiscrepancy(event.target.value) }} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="verify-notes">Verification notes (optional)</Label>
                      <Textarea id="verify-notes" value={notes} onChange={(event) => { verifyActionId.current = ''; setNotes(event.target.value) }} />
                    </div>
                  </div>
                  {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
                  <div className="flex gap-2">
                    <Button type="button" onClick={reviewVerify}>Review verification</Button>
                    <Button type="button" variant="outline" onClick={() => setVerifyTarget(null)}>Close</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verified and rejected returns</CardTitle>
              <CardDescription>Physical verification stays separate from the reception billing decision.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No verified or rejected returns yet.</p> : (
                <ul className="divide-y rounded-md border">
                  {history.slice(0, 30).map(({ entry, order, line }) => (
                    <li key={entry.id} className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{line?.name || 'Medicine'} · presented {entry.presentedQuantity ?? entry.quantity} · accepted {entry.acceptedQuantity ?? 0}</p>
                        <span className="flex gap-2">
                          <StatusBadge status={entry.physicalStatus} />
                          <StatusBadge status={entry.billingStatus || 'not_eligible'} />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.patientName} · {order.patientId} · Request {order.submissionId} · {entry.verifiedByName || entry.pharmacistName} · {formatDateTime(entry.verifiedAt || entry.at)}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.reason}{entry.discrepancyReason ? ` · ${entry.discrepancyReason}` : ''}{entry.billingNote ? ` · ${entry.billingNote}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={(open) => { if (!busy) setConfirm(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this return for verification?</AlertDialogTitle>
            <AlertDialogDescription>
              {quantity} of {selected?.line.name} will be recorded as presented for {patient?.name} ({patient?.id}). The handover and the bill stay unchanged until pharmacy verifies an accepted quantity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); submit() }}>
              {busy ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={verifyConfirm} onOpenChange={(open) => { if (!busy) setVerifyConfirm(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm pharmacy verification?</AlertDialogTitle>
            <AlertDialogDescription>
              Accepted {accepted} of {verifyTarget?.entry.presentedQuantity} presented {verifyTarget?.line?.name}. {Number(accepted) > 0 ? 'Reception will review that accepted quantity. This is not a posted adjustment.' : 'No billing adjustment will be created.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); submitVerify() }}>
              {busy ? 'Saving…' : 'Confirm verification'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
