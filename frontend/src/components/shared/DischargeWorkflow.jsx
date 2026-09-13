import { useState } from 'react'
import { LogOut, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/shared/CommonComponents'
import { CreditBadge, CreditSummary } from '@/components/shared/CreditBadge'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, formatDateTime, stayDurationDays } from '@/lib/utils'
import { validateDischargeRejectReason, validateDischargeRequest } from '@/lib/validation'
import { useAuth } from '@/context/AuthContext'

export function RequestDischargeButton({ patient }) {
  const { toast } = useToast()
  const { requestDischarge } = usePatients()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!patient || patient.status !== 'admitted') return null

  const stayDays = stayDurationDays(patient.admissionDate)

  const handleSubmit = async () => {
    const error = validateDischargeRequest(patient)
    if (error) {
      toast({ title: 'Cannot request discharge', description: error, variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await requestDischarge(patient.id, { notes })
      toast({
        title: 'Discharge request submitted successfully.',
        description: `${patient.name} is now pending discharge. The bed remains assigned.`,
        variant: 'success',
      })
      setOpen(false)
      setNotes('')
    } catch (err) {
      toast({ title: 'Request failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut className="h-4 w-4 mr-2" /> Request Discharge
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request discharge for this patient?</DialogTitle>
            <DialogDescription>
              This sends the request to reception. The patient stays in the current room and bed until reception completes discharge.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{patient.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Patient ID</p><p className="font-mono font-medium">{patient.id}</p></div>
              <div><p className="text-xs text-muted-foreground">Room</p><p className="font-medium">{patient.room}</p></div>
              <div><p className="text-xs text-muted-foreground">Bed</p><p className="font-medium">{patient.bed}</p></div>
              <div><p className="text-xs text-muted-foreground">Admission date</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Stay duration</p><p className="font-medium">{stayDays} day{stayDays === 1 ? '' : 's'}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Current status</span>
              <StatusBadge status={patient.status} />
            </div>
            <div>
              <Label htmlFor="discharge-notes">Request note (optional)</Label>
              <Input
                id="discharge-notes"
                className="mt-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clinical or handover note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DischargeReviewPanel({ patient }) {
  const { toast } = useToast()
  const { approveDischarge, rejectDischarge, getRoomAssignments } = usePatients()
  const { getPatientBalance } = useServiceEntries()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!patient || (patient.status !== 'pending-discharge' && patient.status !== 'discharged')) return null

  const discharge = patient.discharge || {}
  const balance = getPatientBalance(patient)
  const stayDays = stayDurationDays(patient.admissionDate, discharge.completedAt?.slice?.(0, 10))
  const assignments = getRoomAssignments(patient.id)
  const openAssignment = assignments.find((a) => !a.end_date)
  const { hasPermission } = useAuth()
  const canDischarge = hasPermission('admissions.discharge')
  const isPending = patient.status === 'pending-discharge'
  const remaining = balance.remainingBalance
  const outstanding = remaining < 0 ? Math.abs(remaining) : 0
  const credit = remaining > 0 ? remaining : 0

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await approveDischarge(patient.id)
      toast({
        title: 'Discharge completed',
        description: `${patient.name} is discharged. The bed is now available.`,
        variant: 'success',
      })
      setConfirmApprove(false)
    } catch (err) {
      toast({ title: 'Discharge failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    const error = validateDischargeRejectReason(reason)
    if (error) {
      toast({ title: 'Provide a rejection reason', description: error, variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await rejectDischarge(patient.id, reason)
      toast({
        title: 'Discharge request rejected',
        description: `${patient.name} is admitted again. The bed remains occupied.`,
        variant: 'success',
      })
      setRejectOpen(false)
      setReason('')
    } catch (err) {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-6 border-purple-200 dark:border-purple-900">
      <CardHeader>
        <CardTitle>Discharge Request</CardTitle>
        <CardDescription>
          {isPending
            ? 'Awaiting reception review. The patient still occupies the assigned room and bed.'
            : 'This inpatient stay has been completed.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Patient information</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{patient.name}</p></div>
            <div><p className="text-xs text-muted-foreground">Patient ID</p><p className="font-mono font-medium">{patient.id}</p></div>
            <div><p className="text-xs text-muted-foreground">Room / Bed</p><p className="font-medium">{patient.room} · {patient.bed}</p></div>
            <div><p className="text-xs text-muted-foreground">Admission date</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Stay duration</p><p className="font-medium">{stayDays} day{stayDays === 1 ? '' : 's'}</p></div>
            <div className="flex items-center gap-2"><StatusBadge status={patient.status} /> <CreditBadge patient={patient} /></div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Discharge request</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Requested by</p><p className="font-medium">{discharge.requestedBy || '—'}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="font-medium">{discharge.requestedAt ? formatDateTime(discharge.requestedAt) : '—'}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Request notes</p><p className="font-medium">{discharge.requestNotes || '—'}</p></div>
            {discharge.rejectedBy && (
              <>
                <div><p className="text-xs text-muted-foreground">Last rejected by</p><p className="font-medium">{discharge.rejectedBy}</p></div>
                <div><p className="text-xs text-muted-foreground">Rejection reason</p><p className="font-medium">{discharge.rejectionReason || '—'}</p></div>
              </>
            )}
            {discharge.completedBy && (
              <div><p className="text-xs text-muted-foreground">Completed by</p><p className="font-medium">{discharge.completedBy}</p></div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Financial summary</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Total charges</p><p className="font-medium">{formatCurrency(balance.totalCharges)}</p></div>
            <div><p className="text-xs text-muted-foreground">Deposits / payments</p><p className="font-medium">{formatCurrency(patient.deposit)}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-medium text-red-600">{formatCurrency(outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Refund / credit</p>
              <p className="font-medium text-emerald-600">{formatCurrency(credit)}</p>
            </div>
          </div>
          <div className="mt-3">
            <CreditSummary patient={patient} />
          </div>
          {balance.pendingCharges > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              {formatCurrency(balance.pendingCharges)} in pending records (not on the bill).
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Room information</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Current assignment</p><p className="font-medium">{patient.room} · {patient.bed}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Assignment status</p>
              <p className="font-medium">{openAssignment ? 'Active' : 'Closed'}</p>
            </div>
          </div>
        </div>

        {isPending && canDischarge && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="text-red-600" onClick={() => setRejectOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" /> Reject Discharge
            </Button>
            <Button onClick={() => setConfirmApprove(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Complete Discharge
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to complete this discharge?</AlertDialogTitle>
            <AlertDialogDescription>
              The patient will become discharged. The current room assignment will close, the bed will become available, active inpatient charging will stop, and normal inpatient actions will no longer be available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={submitting}>
              {submitting ? 'Completing…' : 'Confirm Discharge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why is this discharge request being rejected?</DialogTitle>
            <DialogDescription>
              The patient will return to admitted status. The bed stays occupied.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reject-reason">Reason</Label>
            <Input
              id="reject-reason"
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Financial information needs to be reviewed"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting}>
              {submitting ? 'Rejecting…' : 'Reject Discharge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
