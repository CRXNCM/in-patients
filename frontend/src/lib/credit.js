import { MIN_INITIAL_DEPOSIT } from '@/lib/validation'

export function computeCreditState(patient = {}) {
  const required = Number(patient.requiredInitialDeposit ?? MIN_INITIAL_DEPOSIT)
  const paid = Number(patient.deposit ?? patient.depositTotal ?? 0)
  const outstandingDeposit = Math.max(0, (Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : required) - (Number.isNaN(paid) ? 0 : paid))
  const admittedOnCredit = patient.admissionPaymentMode === 'credit'
  const isCreditPatient = patient.isCreditPatient ?? (admittedOnCredit && outstandingDeposit > 0)
  let depositStatus = patient.depositStatus
  if (!depositStatus) {
    if (outstandingDeposit === 0) depositStatus = 'paid'
    else if (paid > 0) depositStatus = 'partially-paid'
    else depositStatus = admittedOnCredit ? 'credit' : 'unpaid'
  }
  return {
    requiredInitialDeposit: Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : required,
    depositPaid: Number.isNaN(paid) ? 0 : paid,
    outstandingDeposit,
    admittedOnCredit,
    isCreditPatient,
    depositStatus,
  }
}
