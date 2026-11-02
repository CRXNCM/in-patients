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
import { PharmacyReconciliation } from '@/components/workflow/PharmacyReconciliation'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, formatDateTime, stayDurationDays } from '@/lib/utils'
import { dischargePendingRecordsError, dischargeOutstandingBalanceError, validateDischargeRejectReason, validateDischargeRequest } from '@/lib/validation'
import { computeCreditState } from '@/lib/credit'
import { useAuth } from '@/context/AuthContext'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { MotionReveal } from '@/lib/motion'
import { isEmergencyOpdAdmission, stayLocationLabel } from '@/lib/admissions'
import { canCompleteStayDischarge, canRequestStayDischarge } from '@/lib/stayScope'

export function RequestDischargeButton({ patient }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { requestDischarge } = usePatients()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const emergencyStay = isEmergencyOpdAdmission(patient)

  if (!patient || patient.status !== 'admitted') return null
  if (!canRequestStayDischarge(patient, user)) return null

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
        title: emergencyStay ? 'Ready to complete discharge.' : 'Discharge request submitted successfully.',
        description: emergencyStay
          ? `${patient.name} is pending Emergency Nurse discharge. Confirm below to complete it.`
          : `${patient.name} is now pending discharge. The bed remains assigned.`,
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
        <LogOut className="h-4 w-4 mr-2" /> {emergencyStay ? 'Discharge Patient' : 'Request Discharge'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{emergencyStay ? 'Discharge this Emergency OPD patient?' : 'Request discharge for this patient?'}</DialogTitle>
            <DialogDescription>
              {emergencyStay
                ? 'Emergency OPD discharge is completed by the Emergency Nurse. Reception does not handle this stay unless it is converted to inpatient.'
                : 'This sends the request to reception. The patient stays in the current room and bed until reception completes discharge.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{patient.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Patient ID</p><p className="font-mono text-sm font-medium text-primary">{patient.id}</p></div>
              <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{stayLocationLabel(patient)}</p></div>
              <div><p className="text-xs text-muted-foreground">Admission date</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Stay duration</p><p className="font-medium">{stayDays} day{stayDays === 1 ? '' : 's'}</p></div>
          </div>
          <PharmacyReconciliation patientId={patient.id} />
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
              {submitting ? 'Submitting…' : emergencyStay ? 'Start discharge' : 'Submit request'}
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
  const { getPatientBalance, getPatientRecords } = useServiceEntries()
  const { user } = useAuth()
  const { settings } = useBillingConfig()
  const emergencyStay = isEmergencyOpdAdmission(patient)
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
  const canDischarge = canCompleteStayDischarge(patient, user)
  const isPending = patient.status === 'pending-discharge'
  const remaining = balance.remainingBalance
  const outstanding = remaining < 0 ? Math.abs(remaining) : 0
  const credit = remaining > 0 ? remaining : 0
  const pendingRecordCount = getPatientRecords(patient.id).filter((r) => r.status === 'pending').length
  const pendingBlock = dischargePendingRecordsError(pendingRecordCount)
  const creditState = computeCreditState(patient)
  const outstandingBlock = emergencyStay
    ? null
    : dischargeOutstandingBalanceError({
      outstanding,
      isCreditPatient: creditState.isCreditPatient,
      allowCreditOutstanding: settings.allowDischargeWithOutstandingBalance !== false,
    })
  const dischargeBlock = pendingBlock || outstandingBlock

  const handleApprove = async () => {
    if (submitting) return
    if (dischargeBlock) {
      toast({ title: 'Cannot complete discharge', description: dischargeBlock, variant: 'destructive' })
      setConfirmApprove(false)
      return
    }
    setSubmitting(true)
    try {
      await approveDischarge(patient.id)
      toast({
        title: 'Discharge completed',
        description: emergencyStay
          ? `${patient.name} has been discharged from Emergency OPD.`
          : `${patient.name} is discharged. The bed is now available.`,
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
        title: emergencyStay ? 'Discharge cancelled' : 'Discharge request rejected',
        description: emergencyStay
          ? `${patient.name} remains in Emergency OPD.`
          : `${patient.name} is admitted again. The bed remains occupied.`,
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
    <MotionReveal>
    <Card className={isPending ? 'mb-6 border-warning/40 shadow-md' : 'mb-6'}>
      <CardHeader>
        <CardTitle>{emergencyStay ? 'Emergency Discharge' : 'Discharge Request'}</CardTitle>
        <CardDescription>
          {isPending
            ? emergencyStay
              ? 'Awaiting Emergency Nurse confirmation. Reception does not discharge Emergency OPD stays.'
              : 'Awaiting reception review. The patient still occupies the assigned room and bed.'
            : 'This stay has been completed.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Patient information</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{patient.name}</p></div>
            <div><p className="text-xs text-muted-foreground">Patient ID</p><p className="font-mono font-medium text-primary">{patient.id}</p></div>
            <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{stayLocationLabel(patient)}</p></div>
            <div><p className="text-xs text-muted-foreground">Admission date</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Stay duration</p><p className="font-medium">{stayDays} day{stayDays === 1 ? '' : 's'}</p></div>
            <div className="flex items-center gap-2"><StatusBadge status={patient.status} /> <CreditBadge patient={patient} /></div>
          </div>
        </div>
        <PharmacyReconciliation patientId={patient.id} />

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
            <div><p className="text-xs text-muted-foreground">Total charges</p><p className="font-medium tabular-nums">{formatCurrency(balance.totalCharges)}</p></div>
            <div><p className="text-xs text-muted-foreground">Deposits / payments</p><p className="font-medium tabular-nums">{formatCurrency(patient.deposit)}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-medium tabular-nums text-destructive">{formatCurrency(outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Refund / credit</p>
              <p className="font-medium tabular-nums text-success">{formatCurrency(credit)}</p>
            </div>
          </div>
          <div className="mt-3">
            <CreditSummary patient={patient} />
          </div>
          {pendingRecordCount > 0 && (
            <p className="mt-2 text-sm font-medium text-warning">
              {pendingBlock} Pending amounts stay off the bill until they are approved.
            </p>
          )}
          {outstandingBlock && (
            <p className="mt-2 text-sm font-medium text-destructive">{outstandingBlock}</p>
          )}
          {!outstandingBlock && outstanding > 0 && creditState.isCreditPatient && (
            <p className="mt-2 text-sm text-muted-foreground">
              Credit patient: {formatCurrency(outstanding)} remains outstanding after discharge.
            </p>
          )}
        </div>

        {!emergencyStay && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Room information</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Current assignment</p><p className="font-medium">{stayLocationLabel(patient)}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">Assignment status</p>
                <p className="font-medium">{openAssignment ? 'Active' : 'Closed'}</p>
              </div>
            </div>
          </div>
        )}

        {isPending && canDischarge && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="text-destructive" onClick={() => setRejectOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" /> {emergencyStay ? 'Cancel Discharge' : 'Reject Discharge'}
            </Button>
            <Button
              onClick={() => setConfirmApprove(true)}
              disabled={Boolean(dischargeBlock)}
              title={dischargeBlock || undefined}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> {emergencyStay ? 'Complete Discharge' : 'Approve & Complete Discharge'}
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to complete this discharge?</AlertDialogTitle>
            <AlertDialogDescription>
              {emergencyStay
                ? 'This Emergency OPD stay will be closed. Reception is not involved unless the patient is converted to inpatient first.'
                : 'The patient will become discharged. The current room assignment will close, the bed will become available, active inpatient charging will stop, and normal inpatient actions will no longer be available.'}
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
            <DialogTitle>{emergencyStay ? 'Why cancel this discharge?' : 'Why is this discharge request being rejected?'}</DialogTitle>
            <DialogDescription>
              {emergencyStay
                ? 'The patient will remain in Emergency OPD as admitted.'
                : 'The patient will return to admitted status. The bed stays occupied.'}
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
              {submitting ? (emergencyStay ? 'Cancelling…' : 'Rejecting…') : (emergencyStay ? 'Cancel Discharge' : 'Reject Discharge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </MotionReveal>
  )
}
