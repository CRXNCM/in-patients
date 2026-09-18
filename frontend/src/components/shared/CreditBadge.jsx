import { computeCreditState } from '@/lib/credit'
import { cn } from '@/lib/utils'
import { MotionReveal } from '@/lib/motion'

export function CreditBadge({ patient, className }) {
  const credit = computeCreditState(patient)
  if (!credit.admittedOnCredit && !credit.isCreditPatient) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold',
        credit.isCreditPatient
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-success/40 bg-success/10 text-success',
        className
      )}
    >
      {credit.isCreditPatient ? 'CREDIT' : 'CREDIT SETTLED'}
    </span>
  )
}

export function CreditSummary({ patient }) {
  const credit = computeCreditState(patient)
  if (!credit.isCreditPatient) return null

  return (
    <MotionReveal className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
      <p className="font-semibold">Credit patient</p>
    </MotionReveal>
  )
}
