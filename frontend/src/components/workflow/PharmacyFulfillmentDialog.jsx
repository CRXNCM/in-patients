import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/shared/CommonComponents'
import { AuditTrail } from '@/components/shared/ServiceTimeline'
import { formatDateTime, newClientId } from '@/lib/utils'
import {
  EXCEPTION_REASONS,
  applyHandover,
  formatStayLocation,
  medicineSummary,
  reasonLabel,
} from '@/services/pharmacyFulfillment'

const OUTCOMES = [
  { value: 'fulfilled', label: 'Hand over all' },
  { value: 'partial', label: 'Partial' },
  { value: 'not_supplied', label: 'Not supplied' },
]

function baseDraft(line) {
  return {
    outcome: 'fulfilled',
    quantity: String(line?.outstanding ?? ''),
    reasonCode: '',
    reasonNote: '',
  }
}

function billingLabel(line) {
  if (line.receptionStatus === 'approved') return 'Reception approved'
  if (line.receptionStatus === 'pending') return 'Waiting for reception'
  if (line.receptionStatus === 'rejected') return 'Reception rejected'
  if (line.suppliedQuantity > 0) return 'Handed over'
  return ''
}

export function PharmacyFulfillmentDialog({ order, canFulfill, onOpenChange, onSubmit }) {
  const [drafts, setDrafts] = useState({})
  const [confirmLineId, setConfirmLineId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rowErrors, setRowErrors] = useState({})
  const actionIds = useRef({})

  if (!order) return null
  const lines = medicineSummary(order)
  const confirmLine = lines.find((line) => line.lineId === confirmLineId) || null
  const confirmDraft = confirmLine ? (drafts[confirmLine.lineId] || baseDraft(confirmLine)) : null

  const draftOf = (line) => drafts[line.lineId] || baseDraft(line)

  const patchDraft = (line, patch) => {
    actionIds.current[line.lineId] = ''
    setRowErrors((current) => ({ ...current, [line.lineId]: '' }))
    setDrafts((current) => ({
      ...current,
      [line.lineId]: { ...(current[line.lineId] || baseDraft(line)), ...patch },
    }))
  }

  const bodyFor = (line) => {
    const draft = draftOf(line)
    if (!actionIds.current[line.lineId]) actionIds.current[line.lineId] = newClientId()
    return {
      clientActionId: actionIds.current[line.lineId],
      lineId: line.lineId,
      outcome: draft.outcome,
      quantity: draft.outcome === 'not_supplied' ? 0 : draft.outcome === 'fulfilled' ? line.outstanding : Number(draft.quantity),
      reasonCode: draft.reasonCode,
      reasonNote: draft.reasonNote,
      updatedAt: order.updatedAt,
    }
  }

  const askConfirm = (line) => {
    const preview = applyHandover(order, { id: 'preview', name: 'Pharmacist' }, bodyFor(line))
    if (preview.error) {
      setRowErrors((current) => ({ ...current, [line.lineId]: preview.error }))
      return
    }
    setRowErrors((current) => ({ ...current, [line.lineId]: '' }))
    setConfirmLineId(line.lineId)
  }

  const submit = async () => {
    if (!confirmLine) return
    setBusy(true)
    try {
      await onSubmit(order.id, bodyFor(confirmLine))
      const lineId = confirmLine.lineId
      setDrafts((current) => {
        const next = { ...current }
        delete next[lineId]
        return next
      })
      actionIds.current[lineId] = ''
      setConfirmLineId(null)
    } catch (err) {
      setConfirmLineId(null)
      setRowErrors((current) => ({ ...current, [confirmLine.lineId]: err.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={!!order} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {order.patientName}
              <StatusBadge status={order.status} />
            </DialogTitle>
            <DialogDescription>
              {order.patientId} · Admission {order.admissionNumber || order.patientId} · {formatStayLocation(order)}
              {' · '}{order.requestedByName || 'Nurse'} · {formatDateTime(order.requestedAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Medicine</th>
                  <th className="px-3 py-2 font-medium">Requested</th>
                  <th className="px-3 py-2 font-medium">Handed over</th>
                  <th className="px-3 py-2 font-medium">Remaining</th>
                  {canFulfill ? (
                    <>
                      <th className="px-3 py-2 font-medium">Outcome</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                    </>
                  ) : (
                    <th className="px-3 py-2 font-medium">Status</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const open = line.status === 'pending' || line.status === 'partial'
                  const draft = draftOf(line)
                  const needsReason = draft.outcome !== 'fulfilled'
                  const error = rowErrors[line.lineId]
                  return (
                    <tr key={line.lineId} className="border-b last:border-0 align-middle">
                      <td className="px-3 py-2">
                        <p className="font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            line.instructions,
                            line.returned > 0 ? `Returned ${line.returned}` : '',
                            line.netHeld > 0 ? `Held ${line.netHeld}` : '',
                            billingLabel(line),
                            line.reasonCode ? reasonLabel(line.reasonCode, line.reasonNote) : '',
                          ].filter(Boolean).join(' · ') || '—'}
                        </p>
                        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{line.requestedQuantity}{line.unit ? ` ${line.unit}` : ''}</td>
                      <td className="px-3 py-2 tabular-nums">{line.suppliedQuantity}</td>
                      <td className="px-3 py-2 tabular-nums">{line.outstanding}</td>
                      {canFulfill && open ? (
                        <>
                          <td className="px-3 py-2">
                            <NativeSelect
                              aria-label={`Outcome for ${line.name}`}
                              className="h-9 min-w-[9.5rem]"
                              value={draft.outcome}
                              onChange={(event) => {
                                const outcome = event.target.value
                                patchDraft(line, {
                                  outcome,
                                  quantity: outcome === 'not_supplied' ? '0' : outcome === 'fulfilled' ? String(line.outstanding) : draft.quantity,
                                })
                              }}
                            >
                              {OUTCOMES.map((outcome) => (
                                <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
                              ))}
                            </NativeSelect>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              aria-label={`Quantity for ${line.name}`}
                              className="h-9 w-20"
                              type="number"
                              min="0"
                              max={line.outstanding}
                              disabled={draft.outcome !== 'partial'}
                              value={draft.outcome === 'not_supplied' ? '0' : draft.outcome === 'fulfilled' ? line.outstanding : draft.quantity}
                              onChange={(event) => patchDraft(line, { quantity: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {needsReason ? (
                              <div className="flex min-w-[11rem] flex-col gap-1">
                                <NativeSelect
                                  aria-label={`Reason for ${line.name}`}
                                  className="h-9"
                                  value={draft.reasonCode}
                                  onChange={(event) => patchDraft(line, { reasonCode: event.target.value })}
                                >
                                  <option value="">Select a reason</option>
                                  {EXCEPTION_REASONS.map((reason) => (
                                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                                  ))}
                                </NativeSelect>
                                {draft.reasonCode === 'other' ? (
                                  <Input
                                    aria-label={`Explanation for ${line.name}`}
                                    className="h-9"
                                    placeholder="Short explanation"
                                    value={draft.reasonNote}
                                    onChange={(event) => patchDraft(line, { reasonNote: event.target.value })}
                                  />
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Button type="button" size="sm" onClick={() => askConfirm(line)} disabled={busy}>
                              Record
                            </Button>
                          </td>
                        </>
                      ) : (
                        <td className="px-3 py-2" colSpan={canFulfill ? 4 : 1}>
                          <StatusBadge status={line.status} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <AuditTrail trail={(order.history || []).map((event) => ({
            action: event.action,
            by: event.by,
            at: event.at,
            note: event.note,
          }))} />
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmLine} onOpenChange={(open) => { if (!busy && !open) setConfirmLineId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record this handover?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDraft?.outcome === 'not_supplied'
                ? `${confirmLine?.name || 'This medicine'} will stay unsupplied. The requested quantity is kept, and it is not marked as handed over.`
                : `${confirmDraft?.outcome === 'fulfilled' ? confirmLine?.outstanding : confirmDraft?.quantity} of ${confirmLine?.name || 'this medicine'} will be recorded as handed to the nurse.`}
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
    </>
  )
}
