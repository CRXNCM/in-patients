import { useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchInput } from '@/components/ui/search-input'
import { EmptyState, PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { AdmissionTypeBadge } from '@/components/shared/AdmissionTypeBadge'
import { LoadingState } from '@/components/shared/LoadingState'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { isEmergencyOpdAdmission, stayLocationLabel } from '@/lib/admissions'
import { formatDateTime } from '@/lib/utils'
import { isActiveStay } from '@/lib/patientLocation'
import {
  applyReturn,
  formatStayLocation,
  HELD_UNTIL_INPATIENT,
  isEmergencyPharmacyStay,
  isHeldUntilInpatient,
  medicineSummary,
  RETURN_REASONS,
  verifyReturn,
} from '@/services/pharmacyFulfillment'

function isEmergencyReturn({ order, entry }, patients) {
  if (isHeldUntilInpatient(entry)) return true
  if (isEmergencyPharmacyStay(order)) return true
  const patient = patients.find((item) => item.id === order.patientId)
  return isEmergencyOpdAdmission(patient)
}

function PatientPickList({ items, onChoose }) {
  if (items.length === 0) return null
  return (
    <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
      {items.slice(0, 30).map((item) => (
        <li key={item.id}>
          <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => onChoose(item.id)}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.name}</span>
              <AdmissionTypeBadge patient={item} />
            </span>
            <span className="block text-xs text-muted-foreground">{item.id} · {stayLocationLabel(item)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ReturnRows({ rows, empty, actions }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y rounded-md border">
      {rows.map(({ entry, order, line }) => (
        <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
          <div>
            <p className="text-sm font-medium">{line?.name || 'Medicine'} · presented {entry.presentedQuantity ?? entry.quantity}{entry.physicalStatus && entry.physicalStatus !== 'pending_verification' ? ` · accepted ${entry.acceptedQuantity ?? 0}` : ''}</p>
            <p className="text-xs text-muted-foreground">
              {order.patientName} · {order.patientId} · Request {order.submissionId} · {entry.verifiedByName || entry.pharmacistName} · {formatDateTime(entry.verifiedAt || entry.at)}
            </p>
            <p className="text-xs text-muted-foreground">{entry.reason}{entry.discrepancyReason ? ` · ${entry.discrepancyReason}` : ''}{entry.billingNote ? ` · ${entry.billingNote}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <AdmissionTypeBadge admissionType={isHeldUntilInpatient(entry) ? 'emergency-opd' : order.admissionType} convertedFromEmergency={order.convertedFromEmergency} />
            <StatusBadge status={entry.physicalStatus} />
            {entry.physicalStatus !== 'pending_verification' ? <StatusBadge status={entry.billingStatus || 'not_eligible'} /> : null}
            {actions?.({ entry, order, line })}
          </div>
        </li>
      ))}
    </ul>
  )
}

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
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const actionId = useRef('')
  const [verifyTarget, setVerifyTarget] = useState(null)
  const [accepted, setAccepted] = useState('1')
  const [rejected, setRejected] = useState('0')
  const [discrepancy, setDiscrepancy] = useState('')
  const [notes, setNotes] = useState('')
  const [verifyError, setVerifyError] = useState('')
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

  const emergencyPatients = matches.filter((item) => isEmergencyOpdAdmission(item))
  const inpatientPatients = matches.filter((item) => !isEmergencyOpdAdmission(item))

  const pending = pharmacyOrders.flatMap((order) => (order.returns || [])
    .filter((entry) => entry.physicalStatus === 'pending_verification')
    .map((entry) => ({ entry, order, line: order.items?.find((item) => item.lineId === entry.lineId) })))
    .sort((a, b) => String(b.entry.at).localeCompare(String(a.entry.at)))

  const history = pharmacyOrders.flatMap((order) => (order.returns || [])
    .filter((entry) => entry.physicalStatus && entry.physicalStatus !== 'pending_verification')
    .map((entry) => ({ entry, order, line: order.items?.find((item) => item.lineId === entry.lineId) })))
    .sort((a, b) => String(b.entry.verifiedAt || b.entry.at).localeCompare(String(a.entry.verifiedAt || a.entry.at)))

  const emergencyPending = pending.filter((row) => isEmergencyReturn(row, patients))
  const inpatientPending = pending.filter((row) => !isEmergencyReturn(row, patients))
  const emergencyHistory = history.filter((row) => isEmergencyReturn(row, patients))
  const inpatientHistory = history.filter((row) => !isEmergencyReturn(row, patients))

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

  const submit = async () => {
    if (!selected || busy) return
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
      setSelection(null)
      setReasonNote('')
      actionId.current = ''
    } catch (err) {
      setFormError(err.message)
      toast({ title: 'Return was not saved', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const openVerify = (row) => {
    setVerifyTarget(row)
    const presented = Number(row.entry.presentedQuantity || row.entry.quantity || 1)
    setAccepted(String(presented))
    setRejected('0')
    setDiscrepancy('')
    setNotes('')
    setVerifyError('')
    verifyActionId.current = ''
  }

  const changeAccepted = (value) => {
    verifyActionId.current = ''
    setAccepted(value)
    const presented = Number(verifyTarget?.entry.presentedQuantity || verifyTarget?.entry.quantity || 0)
    const nextAccepted = Number(value)
    if (Number.isInteger(nextAccepted) && nextAccepted >= 0 && nextAccepted <= presented) {
      setRejected(String(presented - nextAccepted))
    }
  }

  const changeRejected = (value) => {
    verifyActionId.current = ''
    setRejected(value)
    const presented = Number(verifyTarget?.entry.presentedQuantity || verifyTarget?.entry.quantity || 0)
    const nextRejected = Number(value)
    if (Number.isInteger(nextRejected) && nextRejected >= 0 && nextRejected <= presented) {
      setAccepted(String(presented - nextRejected))
    }
  }

  const submitVerify = async () => {
    if (!verifyTarget || busy) return
    if (!verifyActionId.current) verifyActionId.current = crypto.randomUUID()
    const preview = verifyReturn(verifyTarget.order, { id: 'preview', name: 'Pharmacist' }, {
      clientActionId: verifyActionId.current,
      returnId: verifyTarget.entry.id,
      acceptedQuantity: Number(accepted),
      rejectedQuantity: Number(rejected),
      discrepancyReason: discrepancy,
      verificationNotes: notes,
    })
    if (preview.error) {
      setVerifyError(preview.error)
      return
    }
    setVerifyError('')
    setBusy(true)
    try {
      const saved = await verifyMedicineReturn(verifyTarget.order.id, verifyTarget.entry.id, {
        clientActionId: verifyActionId.current,
        acceptedQuantity: Number(accepted),
        rejectedQuantity: Number(rejected),
        discrepancyReason: discrepancy,
        verificationNotes: notes,
      })
      const acceptedQty = Number(accepted)
      const savedEntry = saved?.returns?.find((row) => row.id === verifyTarget.entry.id)
      const held = savedEntry?.billingStatus === HELD_UNTIL_INPATIENT
        || isEmergencyOpdAdmission(patients.find((item) => item.id === verifyTarget.order.patientId))
      toast({
        title: acceptedQty > 0 ? 'Return verified' : 'Return not accepted',
        description: acceptedQty > 0
          ? held
            ? 'The accepted quantity stays in pharmacy until this Emergency OPD stay is converted to inpatient.'
            : 'The accepted quantity is waiting for reception. The original handover was not changed.'
          : 'Nothing was accepted, so no billing adjustment was created.',
        variant: 'success',
      })
      setVerifyTarget(null)
      verifyActionId.current = ''
    } catch (err) {
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
        description="Emergency OPD returns stay in pharmacy. Reception can review them only after the stay is converted to inpatient."
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-300">Emergency OPD</p>
                  {emergencyPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No Emergency OPD admissions match.</p>
                  ) : (
                    <PatientPickList items={emergencyPatients} onChoose={choosePatient} />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inpatient</p>
                  {inpatientPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No inpatient admissions match.</p>
                  ) : (
                    <PatientPickList items={inpatientPatients} onChoose={choosePatient} />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!patient ? (
            <EmptyState icon={RotateCcw} title="Select an admission" description="A return is recorded against the original handover for that stay." />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {patient.name}
                  <AdmissionTypeBadge patient={patient} />
                </CardTitle>
                <CardDescription>
                  {patient.id} · Admission {patient.admissionId || patient.id} · {patient.status === 'pending-discharge' ? 'Pending discharge' : 'Admitted'}
                  {isEmergencyOpdAdmission(patient) ? ' · Emergency OPD returns stay in pharmacy' : ` · ${patient.room} / ${patient.bed}`}
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
                      {patient.name} · {patient.id} · Admission {selected.order.admissionId || patient.admissionId || patient.id}
                      {' · '}{formatStayLocation(selected.order)} · Request {selected.order.submissionId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {selected.line.requestedQuantity} · Handed over {selected.line.suppliedQuantity} · Previously accepted returns {selected.line.acceptedReturned} · Eligible {selected.line.netHeld}
                      {selected.line.unit ? ` ${selected.line.unit}` : ''}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="return-qty">Quantity being returned</Label>
                        <Input id="return-qty" type="number" min="1" max={selected.line.netHeld} value={quantity} disabled={busy} onChange={(event) => { actionId.current = ''; setQuantity(event.target.value) }} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return-reason">Reason</Label>
                        <NativeSelect id="return-reason" value={reasonCode} disabled={busy} onChange={(event) => { actionId.current = ''; setReasonCode(event.target.value) }}>
                          {RETURN_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="return-note">{reasonCode === 'other' ? 'Explanation' : 'Note (optional)'}</Label>
                        <Textarea id="return-note" value={reasonNote} disabled={busy} onChange={(event) => { actionId.current = ''; setReasonNote(event.target.value) }} />
                      </div>
                    </div>
                    {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                    <Button type="button" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Submit Return'}</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending verification</CardTitle>
              <CardDescription>Emergency OPD and inpatient returns are listed separately. Reception does not see Emergency OPD returns yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-300">Emergency OPD</p>
                <ReturnRows
                  rows={emergencyPending}
                  empty="No Emergency OPD returns waiting for verification."
                  actions={({ entry, order, line }) => (
                    <Button type="button" size="sm" variant="outline" onClick={() => openVerify({ entry, order, line })}>Verify</Button>
                  )}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inpatient</p>
                <ReturnRows
                  rows={inpatientPending}
                  empty="No inpatient returns waiting for verification."
                  actions={({ entry, order, line }) => (
                    <Button type="button" size="sm" variant="outline" onClick={() => openVerify({ entry, order, line })}>Verify</Button>
                  )}
                />
              </div>
              {verifyTarget ? (
                <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Verify {verifyTarget.line?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {verifyTarget.order.patientName} · {verifyTarget.order.patientId} · Admission {verifyTarget.order.admissionId || verifyTarget.order.admissionNumber}
                    {' · '}{formatStayLocation(verifyTarget.order)} · Request {verifyTarget.order.submissionId}
                    {isEmergencyReturn(verifyTarget, patients) ? ' · Held in pharmacy until inpatient conversion' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Handed over {verifyTarget.line?.suppliedQuantity ?? '—'} · Previously accepted returns {medicineSummary(verifyTarget.order).find((line) => line.lineId === verifyTarget.entry.lineId)?.acceptedReturned ?? 0}
                    {' · '}Presented {verifyTarget.entry.presentedQuantity} · Initiated by {verifyTarget.entry.pharmacistName} · {formatDateTime(verifyTarget.entry.at)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accepted-qty">Quantity accepted</Label>
                      <Input id="accepted-qty" type="number" min="0" max={verifyTarget.entry.presentedQuantity} value={accepted} disabled={busy} onChange={(event) => changeAccepted(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rejected-qty">Quantity rejected</Label>
                      <Input id="rejected-qty" type="number" min="0" max={verifyTarget.entry.presentedQuantity} value={rejected} disabled={busy} onChange={(event) => changeRejected(event.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="discrepancy">Reason for any quantity not accepted</Label>
                      <Textarea id="discrepancy" value={discrepancy} disabled={busy} onChange={(event) => { verifyActionId.current = ''; setDiscrepancy(event.target.value) }} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="verify-notes">Verification notes (optional)</Label>
                      <Textarea id="verify-notes" value={notes} disabled={busy} onChange={(event) => { verifyActionId.current = ''; setNotes(event.target.value) }} />
                    </div>
                  </div>
                  {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
                  <div className="flex gap-2">
                    <Button type="button" onClick={submitVerify} disabled={busy}>{busy ? 'Saving…' : 'Confirm Verification'}</Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setVerifyTarget(null)}>Close</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency OPD — verified returns</CardTitle>
              <CardDescription>These stay in pharmacy. Reception cannot approve them until the stay is converted to inpatient.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReturnRows rows={emergencyHistory.slice(0, 30)} empty="No verified Emergency OPD returns yet." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inpatient — verified returns</CardTitle>
              <CardDescription>Physical verification stays separate from the reception billing decision.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReturnRows rows={inpatientHistory.slice(0, 30)} empty="No verified inpatient returns yet." />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
