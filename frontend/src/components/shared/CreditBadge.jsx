import { computeCreditState, creditCompanyLabel } from '@/lib/credit'
import { cn } from '@/lib/utils'
import { MotionReveal } from '@/lib/motion'

export function CreditBadge({ patient, className }) {
  const credit = computeCreditState(patient)
  if (!credit.admittedOnCredit && !credit.isCreditPatient && !credit.formerCreditPatient) return null

  const former = credit.formerCreditPatient && !credit.isCreditPatient
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold',
        former
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-warning/40 bg-warning/10 text-warning',
        className
      )}
    >
      {former ? 'FORMER CREDIT' : 'CREDIT'}
    </span>
  )
}

export function CreditSummary({ patient }) {
  const credit = computeCreditState(patient)
  if (!credit.isCreditPatient && !credit.formerCreditPatient) return null

  if (credit.formerCreditPatient && !credit.isCreditPatient) {
    return (
      <MotionReveal className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
        <p className="font-semibold">Former credit patient</p>
        <p className="mt-1 text-muted-foreground">
          This stay used to be on credit{patient.formerCreditCompanyName || patient.creditCompanyName
            ? ` with ${creditCompanyLabel(patient)}`
            : ''}. It is now a normal cash patient.
        </p>
      </MotionReveal>
    )
  }

  return (
    <MotionReveal className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
      <p className="font-semibold">Credit patient</p>
      <p className="mt-1 text-muted-foreground">
        {patient.creditCompanyName
          ? `Company on file: ${creditCompanyLabel(patient)}.`
          : 'Select the paying company when recording a payment.'}
      </p>
    </MotionReveal>
  )
}
