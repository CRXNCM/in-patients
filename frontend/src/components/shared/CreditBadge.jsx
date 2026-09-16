import { computeCreditState } from '@/lib/credit'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { MotionReveal } from '@/lib/motion'

const STATUS_LABELS = {
  credit: 'Credit',
  'partially-paid': 'Partially Paid / Credit',
  paid: 'Paid',
  unpaid: 'Unpaid',
}

export function CreditBadge({ patient, className }) {
  const credit = computeCreditState(patient)
  if (!credit.admittedOnCredit && !credit.isCreditPatient) return null

  return (
    <span
      className={cn(
        'inline-flex flex-col items-start rounded-md border px-2 py-1 text-xs font-semibold',
        credit.isCreditPatient
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-success/40 bg-success/10 text-success',
        className
      )}
    >
      <span>{credit.isCreditPatient ? 'CREDIT' : 'CREDIT SETTLED'}</span>
      <span className="font-normal tabular-nums">
        {STATUS_LABELS[credit.depositStatus] || credit.depositStatus}
        {credit.outstandingDeposit > 0 ? ` · Outstanding ${formatCurrency(credit.outstandingDeposit)}` : ''}
      </span>
    </span>
  )
}

export function CreditSummary({ patient }) {
  const credit = computeCreditState(patient)
  if (!credit.admittedOnCredit && !credit.isCreditPatient) return null

  return (
    <MotionReveal className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
      <p className="font-semibold">{credit.isCreditPatient ? 'Credit patient' : 'Admission deposit settled'}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">
        Required deposit {formatCurrency(credit.requiredInitialDeposit)} · Paid {formatCurrency(credit.depositPaid)} ·
        Outstanding {formatCurrency(credit.outstandingDeposit)} · Status {STATUS_LABELS[credit.depositStatus]}
      </p>
    </MotionReveal>
  )
}
