import { MIN_INITIAL_DEPOSIT } from '@/lib/validation'

export function computeCreditState(patient = {}) {
  const admittedOnCredit = patient.admissionPaymentMode === 'credit'
  const required = admittedOnCredit
    ? 0
    : Number(patient.requiredInitialDeposit ?? MIN_INITIAL_DEPOSIT)
  const paid = Number(patient.deposit ?? patient.depositTotal ?? 0)
  const outstandingDeposit = Math.max(0, (Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : required) - (Number.isNaN(paid) ? 0 : paid))
  const isCreditPatient = admittedOnCredit || Boolean(patient.isCreditPatient)
  let depositStatus = patient.depositStatus
  if (admittedOnCredit || patient.isCreditPatient) depositStatus = 'unpaid'
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
    depositStatus,
  }
}

export function creditCompanyLabel(row, empty = 'Company not recorded') {
  const name = row?.creditCompanyName || row?.companyName || ''
  if (!name) return empty
  if (row.creditCompanyActive === false) return `${name} (inactive)`
  return name
}
