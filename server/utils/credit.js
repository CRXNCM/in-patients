import { MIN_INITIAL_DEPOSIT } from './validation.js'

export function normalizeAdmissionPaymentMode(value) {
  return String(value || '').trim().toLowerCase() === 'credit' ? 'credit' : 'paid'
}

export function computeCreditState({
  admissionPaymentMode,
  requiredInitialDeposit,
  depositTotal,
} = {}) {
  const required = Number(requiredInitialDeposit ?? MIN_INITIAL_DEPOSIT)
  const paid = Number(depositTotal ?? 0)
  const safeRequired = Number.isNaN(required) ? MIN_INITIAL_DEPOSIT : Math.max(0, required)
  const safePaid = Number.isNaN(paid) ? 0 : paid
  const outstandingDeposit = Math.max(0, safeRequired - safePaid)
  const admittedOnCredit = admissionPaymentMode === 'credit'
  const isCreditPatient = admittedOnCredit && outstandingDeposit > 0
  let depositStatus = 'paid'
  if (outstandingDeposit === 0) depositStatus = 'paid'
  else if (safePaid > 0) depositStatus = 'partially-paid'
  else depositStatus = admittedOnCredit ? 'credit' : 'unpaid'
  return {
    requiredInitialDeposit: safeRequired,
    depositPaid: safePaid,
    outstandingDeposit,
    admittedOnCredit,
    isCreditPatient,
    depositStatus,
  }
}

export function applyCreditFlags(patient, depositTotal = patient.depositTotal) {
  const credit = computeCreditState({
    admissionPaymentMode: patient.admissionPaymentMode,
    requiredInitialDeposit: patient.requiredInitialDeposit,
    depositTotal,
  })
  patient.depositTotal = credit.depositPaid
  patient.isCreditPatient = credit.isCreditPatient
  return credit
}
