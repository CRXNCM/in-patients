import { computeCreditState } from '@/lib/credit'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
        className
      )}
    >
      <span>{credit.isCreditPatient ? 'CREDIT' : 'CREDIT SETTLED'}</span>
      <span className="font-normal">
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
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm">
      <p className="font-semibold">{credit.isCreditPatient ? 'Credit patient' : 'Admission deposit settled'}</p>
      <p className="text-muted-foreground mt-1">
        Required deposit {formatCurrency(credit.requiredInitialDeposit)} · Paid {formatCurrency(credit.depositPaid)} ·
        Outstanding {formatCurrency(credit.outstandingDeposit)} · Status {STATUS_LABELS[credit.depositStatus]}
      </p>
    </div>
  )
}
