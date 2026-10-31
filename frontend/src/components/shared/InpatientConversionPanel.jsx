import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConvertToInpatientDialog } from '@/components/shared/ConvertToInpatientDialog'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api, USE_API } from '@/api/client'
import { conversionStatusLabel } from '@/lib/admissions'
import { formatDateTime } from '@/lib/utils'

function RequestDialog({ open, onOpenChange, title, description, submitLabel, initial, onSubmit }) {
  const [reason, setReason] = useState(initial?.reason || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(initial?.reason || '')
    setNotes(initial?.notes || '')
  }, [open, initial?.reason, initial?.notes])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ reason, notes })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Reason for inpatient admission *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <div>
            <Label>Handover notes</Label>
            <textarea
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !reason.trim()}>{submitting ? 'Submitting…' : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InpatientConversionPanel({ patient, onChanged }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const [latest, setLatest] = useState(null)
  const [active, setActive] = useState(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const canRequest = hasPermission('admissions.request_inpatient')
  const canSelfConvert = hasPermission('admissions.convert_inpatient_self')
  const canReceptionConvert = hasPermission('admissions.convert_inpatient')

  const load = async () => {
    if (!USE_API || !patient?.id) return
    try {
      const data = await api.getPatientConversionRequests(patient.id)
      setActive(data.active || null)
      setLatest(data.latest || null)
    } catch {
      setActive(null)
      setLatest(null)
    }
  }

  useEffect(() => {
    load()
  }, [patient?.id, patient?.admissionType])

  const shown = active || latest
  const completed = shown?.status === 'completed' || patient?.convertedFromEmergency
  const canOpenRequest = canRequest && !completed && (!active || active.status === 'returned')
  const canOpenSelf = canSelfConvert && !completed
  const canOpenReception = canReceptionConvert && !completed

  const submitRequest = async ({ reason, notes }) => {
    try {
      if (active?.status === 'returned') {
        await api.resubmitConversionRequest(active.id, { reason, notes })
        toast({ title: 'Request resubmitted', variant: 'success' })
      } else {
        await api.requestInpatientAdmission(patient.id, { reason, notes })
        toast({ title: 'Inpatient admission requested', description: 'The patient stays Emergency OPD until Reception completes admission.', variant: 'success' })
      }
      await load()
      onChanged?.()
    } catch (err) {
      toast({ title: 'Request failed', description: err.message, variant: 'destructive' })
      throw err
    }
  }

  if (!canRequest && !canSelfConvert && !canReceptionConvert) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Inpatient admission</CardTitle>
        <CardDescription>
          Current type: Emergency OPD. Request Reception to complete admission, or convert yourself when Reception is unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Admission type</p>
            <p className="mt-1 font-medium">Emergency OPD</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Admission status</p>
            <p className="mt-1 font-medium capitalize">{patient.status}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Conversion request</p>
            <p className="mt-1 font-medium">{shown ? conversionStatusLabel(shown.status) : 'None'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested by</p>
            <p className="mt-1 font-medium">{shown?.requestedByName || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested at</p>
            <p className="mt-1 font-medium">{shown?.requestedAt ? formatDateTime(shown.requestedAt) : '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reason / notes</p>
            <p className="mt-1 font-medium">{shown?.reason || '—'}</p>
            {shown?.notes ? <p className="mt-1 text-muted-foreground">{shown.notes}</p> : null}
          </div>
          {(shown?.returnedReason || shown?.rejectedReason || shown?.receptionNote) && (
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reception response</p>
              <p className="mt-1 font-medium">{shown.returnedReason || shown.rejectedReason || shown.receptionNote}</p>
            </div>
          )}
        </div>
        {!completed && (
          <div className="flex flex-wrap gap-2">
            {canOpenRequest && (
              <Button type="button" variant="outline" onClick={() => setRequestOpen(true)}>
                {active?.status === 'returned' ? 'Correct and Resubmit' : 'Request Inpatient Admission'}
              </Button>
            )}
            {canOpenSelf && (
              <Button type="button" onClick={() => setConvertOpen(true)}>Convert to Inpatient Myself</Button>
            )}
            {canOpenReception && !canOpenSelf && (
              <Button type="button" onClick={() => setConvertOpen(true)}>Complete Inpatient Admission</Button>
            )}
          </div>
        )}
      </CardContent>
      <RequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title={active?.status === 'returned' ? 'Correct inpatient admission request' : 'Request Inpatient Admission'}
        description="Reception will assign a bed, doctor, and admission deposit. The patient stays Emergency OPD until they finish."
        submitLabel={active?.status === 'returned' ? 'Resubmit request' : 'Submit request'}
        initial={active}
        onSubmit={submitRequest}
      />
      <ConvertToInpatientDialog
        patient={patient}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={(updated) => {
          load()
          onChanged?.(updated)
        }}
      />
    </Card>
  )
}
