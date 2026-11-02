import mongoose from 'mongoose'
import { CreditCompany } from '../models/CreditCompany.js'
import { Deposit } from '../models/Deposit.js'
import { applyCreditFlags } from '../utils/credit.js'
import { todayStr } from '../utils/dates.js'
import { validateDepositBody } from '../utils/validation.js'
import { calcPatientBalance } from './autoCharges.js'
import { outstandingForStay } from './managerDashboard.js'

function trimText(value) {
  return String(value ?? '').trim()
}

export function normalizeCreditPayerType(value) {
  return String(value || '').trim().toLowerCase() === 'company' || String(value || '').trim().toLowerCase() === 'credit_company'
    ? 'credit_company'
    : 'self'
}

export function invoiceNumberForDeposit(patientId, depositId) {
  const stay = String(patientId || 'PAY').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
  const id = String(depositId || '').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
  return `CR-${stay || 'PAY'}-${id || Date.now().toString(36).toUpperCase()}`
}

export function convertCreditToCashPatient(patient, actorName, at = new Date()) {
  const wasCredit = patient.admissionPaymentMode === 'credit' || patient.isCreditPatient
  if (!wasCredit) return false
  if (!patient.formerCreditCompanyId) {
    patient.formerCreditCompanyId = patient.creditCompanyId || ''
    patient.formerCreditCompanyName = patient.creditCompanyName || ''
  }
  patient.formerCreditPatient = true
  patient.admissionPaymentMode = 'paid'
  patient.isCreditPatient = false
  patient.creditSettledAt = at
  patient.creditSettledBy = actorName || ''
  return true
}

export async function resolveCreditPayerCompany(companyId, patient) {
  const id = trimText(companyId) || trimText(patient?.creditCompanyId)
  if (!id) return { error: 'Select the company that is paying.' }
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Credit company is not valid.' }
  const company = await CreditCompany.findById(id)
  if (!company) return { error: 'Credit company was not found.' }
  const sameAsStay = String(patient?.creditCompanyId || '') === String(company._id)
  if (!sameAsStay && company.active === false) {
    return { error: 'The selected credit company is not active.' }
  }
  return { company }
}

export async function applyCreditPaymentOutcome(patient, actorName) {
  const balance = await calcPatientBalance(patient.patientId)
  const outstanding = outstandingForStay(patient.depositTotal, balance.totalCharges)
  const settled = outstanding <= 0 ? convertCreditToCashPatient(patient, actorName) : false
  applyCreditFlags(patient, patient.depositTotal)
  return { balance, outstanding, settled }
}

export async function recordCreditPayment(patient, body, actorName, { existingRefs = [], rules = {} } = {}) {
  if (!patient) return { error: 'Patient not found.', status: 404 }
  if (patient.admissionPaymentMode !== 'credit' && !patient.isCreditPatient) {
    return { error: 'This patient is not on credit.', status: 400 }
  }

  const payerType = normalizeCreditPayerType(body?.payerType)
  const depositErrors = validateDepositBody(
    { amount: body?.amount, method: body?.method, referenceNumber: body?.referenceNumber },
    existingRefs,
    rules
  )
  if (depositErrors.length) return { error: depositErrors[0], status: 400 }

  let company = null
  if (payerType === 'credit_company') {
    const resolved = await resolveCreditPayerCompany(body?.creditCompanyId, patient)
    if (resolved.error) return { error: resolved.error, status: 400 }
    company = resolved.company
    patient.creditCompanyId = String(company._id)
    patient.creditCompanyName = company.name
  }

  const amount = Number(body.amount)
  const deposit = await Deposit.create({
    patientId: patient.patientId,
    amount,
    method: trimText(body.method) || 'Cash',
    referenceNumber: trimText(body.referenceNumber) || undefined,
    date: trimText(body.date) || todayStr(),
    receivedBy: actorName,
    payerType,
    creditCompanyId: company ? String(company._id) : '',
    creditCompanyName: company ? company.name : '',
    purpose: 'credit_payment',
  })
  deposit.invoiceNumber = invoiceNumberForDeposit(patient.patientId, deposit._id)
  await deposit.save()

  patient.depositTotal = (Number(patient.depositTotal) || 0) + amount
  const outcome = await applyCreditPaymentOutcome(patient, actorName)
  const event = {
    action: outcome.settled ? 'credit_settled' : 'credit_payment',
    payerType,
    amount,
    method: deposit.method,
    creditCompanyId: deposit.creditCompanyId,
    creditCompanyName: deposit.creditCompanyName,
    invoiceNumber: deposit.invoiceNumber,
    outstandingAfter: outcome.outstanding,
    settled: outcome.settled,
    at: new Date().toISOString(),
    by: actorName || '',
    note: payerType === 'credit_company'
      ? `${company.name} paid ${amount}`
      : `Patient deposit ${amount}`,
  }
  patient.creditEvents = [...(patient.creditEvents || []), event]
  patient.updatedBy = actorName
  await patient.save()

  return {
    deposit,
    invoice: {
      invoiceNumber: deposit.invoiceNumber,
      payerType,
      companyName: deposit.creditCompanyName,
      companyId: deposit.creditCompanyId,
      amount,
      method: deposit.method,
      date: deposit.date,
      receivedBy: actorName,
      outstandingAfter: outcome.outstanding,
      remainingAfter: (Number(patient.depositTotal) || 0) - (outcome.balance?.totalCharges || 0),
      settled: outcome.settled,
      formerCredit: outcome.settled,
    },
    settled: outcome.settled,
    outstanding: outcome.outstanding,
    balance: outcome.balance,
  }
}
