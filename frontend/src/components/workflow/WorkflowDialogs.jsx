import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/CommonComponents'
import { AuditTrail } from '@/components/shared/ServiceTimeline'
import { formatDateTime } from '@/lib/utils'
import { admissionLabel, locationLabel } from '@/services/workflowRequests'

function DetailItem({ label, children }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  )
}

export function RequestDetailDialog({
  request,
  onOpenChange,
  capabilities,
  busy,
  onApprove,
  onReject,
  onAccept,
  onComplete,
  onCancel,
}) {
  if (!request) return null
  const pharmacy = request.kind === 'pharmacy'

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pharmacy ? 'Pharmacy request' : 'Laboratory request'} {request.id}</DialogTitle>
          <DialogDescription>
            Opening this request does not change its status.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          {request.demonstration ? <Badge variant="outline">Demonstration</Badge> : null}
          {request.priority ? (
            <span className={request.priority === 'urgent' ? 'text-xs font-semibold text-pending' : 'text-xs font-medium text-muted-foreground'}>
              {request.priority === 'urgent' ? 'Urgent' : 'Routine'}
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Patient">
            {request.patientName}
            <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">{request.patientId}</span>
          </DetailItem>
          <DetailItem label="Admission">{admissionLabel(request)}</DetailItem>
          <DetailItem label="Ward / room">{locationLabel(request)}</DetailItem>
          <DetailItem label={pharmacy ? 'Medicine' : 'Test'}>{request.itemName}</DetailItem>
          {pharmacy ? <DetailItem label="Quantity">{request.quantity}{request.unit ? ` ${request.unit}` : ''}</DetailItem> : null}
          {pharmacy ? <DetailItem label="Dosage or instructions">{request.dosage || '—'}</DetailItem> : null}
          <DetailItem label="Requested by">{request.requestedByName}</DetailItem>
          <DetailItem label="Requested">{formatDateTime(request.requestedAt)}</DetailItem>
        </div>

        <DetailItem label="Note">{request.note || '—'}</DetailItem>
        {request.rejectionReason ? <DetailItem label="Rejection reason">{request.rejectionReason}</DetailItem> : null}
        {request.cancellationReason ? <DetailItem label="Cancellation reason">{request.cancellationReason}</DetailItem> : null}
        {request.completionNote ? <DetailItem label="Completion note">{request.completionNote}</DetailItem> : null}

        <AuditTrail
          trail={(request.history || []).map((event) => ({
            action: event.action,
            by: event.byName,
            at: event.at,
            note: event.note,
          }))}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {capabilities.cancel ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => onCancel(request)}>Cancel request</Button>
          ) : null}
          {capabilities.reject ? (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => onReject(request)}>Reject</Button>
          ) : null}
          {capabilities.approve ? (
            <Button type="button" disabled={busy} onClick={() => onApprove(request)}>Approve handover</Button>
          ) : null}
          {capabilities.accept ? (
            <Button type="button" disabled={busy} onClick={() => onAccept(request)}>Accept</Button>
          ) : null}
          {capabilities.complete ? (
            <Button type="button" disabled={busy} onClick={() => onComplete(request)}>Mark complete</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onOpenChange,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Back</Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReasonDialog({
  open,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  destructive = false,
  busy,
  onOpenChange,
  onConfirm,
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValue('')
    setError('')
  }, [open])

  const submit = () => {
    const note = value.trim()
    if (note.length < 3) {
      setError(`${label} is required.`)
      return
    }
    setError('')
    onConfirm(note)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('')
          setError('')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="workflow-reason">{label}</Label>
          <Textarea
            id="workflow-reason"
            value={value}
            autoFocus
            placeholder={placeholder}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError('')
            }}
          />
          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Back</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
