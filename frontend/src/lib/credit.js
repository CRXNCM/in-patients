import { MIN_INITIAL_DEPOSIT } from '@/lib/validation'

export function computeCreditState(patient = {}) {
  const admittedOnCredit = patient.admissionPaymentMode === 'credit'
  const formerCreditPatient = Boolean(patient.formerCreditPatient) && !admittedOnCredit
  const required = admittedOnCredit
    ? 0
    : Number(patient.requiredInitialDeposit ?? MIN_INITIAL_DEPOSIT)
  const paid = Number(patient.deposit ?? patient.depositTotal ?? 0)
  const outstandingDeposit = Math.max(0, (Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : required) - (Number.isNaN(paid) ? 0 : paid))
  const isCreditPatient = admittedOnCredit || (Boolean(patient.isCreditPatient) && !formerCreditPatient)
  let depositStatus = patient.depositStatus
  if (formerCreditPatient) depositStatus = 'paid'
  else if (isCreditPatient) depositStatus = paid > 0 ? 'partially-paid' : 'unpaid'
  else if (!depositStatus) {
    if (outstandingDeposit === 0) depositStatus = 'paid'
    else if (paid > 0) depositStatus = 'partially-paid'
    else depositStatus = 'unpaid'
  }
  return {
    requiredInitialDeposit: Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : required,
    depositPaid: Number.isNaN(paid) ? 0 : paid,
    outstandingDeposit,
    admittedOnCredit,
    isCreditPatient,
    formerCreditPatient,
    depositStatus,
  }
}

export function creditCompanyLabel(row, empty = 'Company not recorded') {
  const name = row?.creditCompanyName || row?.formerCreditCompanyName || row?.companyName || ''
  if (!name) return empty
  if (row.creditCompanyActive === false) return `${name} (inactive)`
  return name
}

export function creditStatusLabel(status) {
  if (status === 'partially-paid') return 'Partially paid'
  if (status === 'paid') return 'Paid'
  if (status === 'unpaid') return 'Unpaid'
  return status || 'Unpaid'
}
