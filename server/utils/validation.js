import { todayStr } from './dates.js'

export const MIN_INITIAL_DEPOSIT = 15000
export const NON_CASH_PAYMENT_METHODS = ['Bank Transfer', 'Ebirr', 'Other']

function trimText(value) {
  return String(value ?? '').trim()
}

export function isValidDateString(value) {
  if (!value) return false
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const local = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  return value === local
}

export function resolveAdmissionDate(value) {
  const trimmed = trimText(value)
  return trimmed || todayStr()
}

/**
 * `rules` comes from resolved hospital settings. The defaults reproduce the behaviour that
 * was hard-coded before Admin Settings could configure it.
 */
export function validateAdmitBody(body, rules = {}) {
  const errors = []
  const { name, age, dateOfBirth, gender, admissionDate, bedId, depositAmount, address } = body
  const paymentMode = String(body.admissionPaymentMode || 'paid').trim().toLowerCase()
  const minimumDeposit = Number.isFinite(Number(rules.minimumInitialDeposit))
    ? Number(rules.minimumInitialDeposit)
    : MIN_INITIAL_DEPOSIT
  const creditAllowed = rules.creditAdmissionsEnabled !== false
  const enabledMethods = Array.isArray(rules.paymentMethods) && rules.paymentMethods.length
    ? rules.paymentMethods
    : null

  if (!trimText(name)) errors.push('Full name is required.')
  if (!trimText(gender)) errors.push('Gender is required.')
  if (trimText(admissionDate)) {
    if (!isValidDateString(admissionDate)) errors.push('Admission date is not valid.')
    else if (admissionDate > todayStr()) errors.push('Admission date cannot be after today.')
  }

  const ageNum = age !== undefined && age !== null && age !== '' ? Number(age) : null
  const computedAge = dateOfBirth ? computeAgeFromDob(dateOfBirth) : null
  const finalAge = ageNum ?? computedAge
  if (finalAge == null || Number.isNaN(finalAge)) errors.push('Age or date of birth is required.')
  else if (finalAge < 0 || finalAge > 120) errors.push('Age must be between 0 and 120.')

  if (!trimText(address)) errors.push('Address is required.')
  if (!bedId) errors.push('Bed is required.')

  const deposit = Number(depositAmount)
  if (paymentMode === 'credit') {
    if (!creditAllowed) {
      errors.push('Credit admissions are disabled in hospital settings.')
    }
    if (Number.isNaN(deposit) || deposit < 0) {
      errors.push('Credit admission amount must be zero or greater.')
    }
    if (deposit > 0 && !trimText(body.depositMethod)) {
      errors.push('Payment method is required when a credit patient pays a partial deposit.')
    }
  } else if (paymentMode && paymentMode !== 'paid') {
    errors.push('Admission payment mode must be paid or credit.')
  } else if (Number.isNaN(deposit) || deposit < minimumDeposit) {
    errors.push(`Initial deposit must be at least ${minimumDeposit} ETB.`)
  }

  const admitMethod = trimText(body.depositMethod)
  if (admitMethod && enabledMethods && !enabledMethods.includes(admitMethod)) {
    errors.push(`${admitMethod} is not an enabled payment method.`)
  }

  const admissionType = String(body.admissionType || 'normal').trim().toLowerCase()
  if (admissionType && admissionType !== 'normal' && admissionType !== 'maternity') {
    errors.push('Admission type must be normal or maternity.')
  }

  if (Array.isArray(body.doctorIds)) {
    const invalid = body.doctorIds.some((id) => !trimText(id))
    if (invalid) errors.push('Assigned doctor ids are not valid.')
    const unique = new Set(body.doctorIds.map((id) => String(id)))
    if (unique.size !== body.doctorIds.length) errors.push('The same doctor cannot be assigned twice.')
  }

  return errors
}

function computeAgeFromDob(dob) {
  if (!dob || !isValidDateString(dob)) return null
  const birth = new Date(`${dob}T12:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  return age
}

export { computeAgeFromDob }

export function validateDepositBody(body, existingRefs = [], rules = {}) {
  const errors = []
  const enabledMethods = Array.isArray(rules.paymentMethods) && rules.paymentMethods.length
    ? rules.paymentMethods
    : null
  const referenceRequired = Array.isArray(rules.referenceRequiredMethods)
    ? rules.referenceRequiredMethods
    : NON_CASH_PAYMENT_METHODS

  const amount = Number(body.amount)
  if (Number.isNaN(amount) || amount <= 0) errors.push('Deposit amount must be greater than 0.')
  const method = trimText(body.method)
  if (!method) errors.push('Payment method is required.')
  else if (enabledMethods && !enabledMethods.includes(method)) {
    errors.push(`${method} is not an enabled payment method.`)
  }

  const ref = trimText(body.referenceNumber)
  if (referenceRequired.includes(method) && !ref) {
    errors.push(`Reference number is required for ${method} payments.`)
  }
  if (ref && existingRefs.includes(ref)) {
    errors.push('Duplicate payment reference is not allowed.')
  }

  return errors
}

export function dischargeRequestStatusError(status) {
  if (status === 'pending-discharge') return 'A discharge request is already pending.'
  if (status === 'discharged') return 'Patient is already discharged.'
  if (status !== 'admitted') return 'Discharge can only be requested for admitted patients.'
  return null
}

export function dischargeApproveStatusError(status) {
  if (status === 'discharged') return 'Patient is already discharged.'
  if (status !== 'pending-discharge') return 'Patient does not have a pending discharge request.'
  return null
}

export function dischargeRejectStatusError(status) {
  if (status !== 'pending-discharge') return 'Patient does not have a pending discharge request.'
  return null
}

export function validateDischargeRejectBody(body) {
  const errors = []
  if (!trimText(body?.reason)) errors.push('Rejection reason is required.')
  return errors
}

export function inpatientActionError(patient, action) {
  if (!patient) return 'Patient not found.'
  if (patient.status === 'discharged') {
    const messages = {
      records: 'Cannot add inpatient services for a discharged patient.',
      returns: 'Cannot add a pharmacy return for a discharged patient.',
      deposits: 'Cannot add a deposit for a discharged patient.',
      transfer: 'Cannot transfer a discharged patient.',
      'doctor-visit': 'Cannot change doctor visits for a discharged patient.',
      'assign-doctor': 'Cannot assign a doctor to a discharged patient.',
    }
    return messages[action] || 'This action is not allowed for a discharged patient.'
  }
  if (patient.status === 'pending-discharge' && action === 'transfer') {
    return 'Cannot transfer a patient with a pending discharge request.'
  }
  return null
}

export function validateAssignDoctorBody(body, patient) {
  const errors = []
  const stayError = inpatientActionError(patient, 'assign-doctor')
  if (stayError) errors.push(stayError)
  if (!trimText(body?.doctorId)) errors.push('Doctor is required.')
  if (trimText(body?.effectiveFrom)) {
    if (!isValidDateString(body.effectiveFrom)) errors.push('Effective date is not valid.')
    else if (patient?.admissionDate && body.effectiveFrom < patient.admissionDate) {
      errors.push('Effective date cannot be before admission date.')
    } else if (body.effectiveFrom > todayStr()) {
      errors.push('Effective date cannot be after today.')
    }
  }
  return errors
}

export function validateTransferBody(body, patient) {
  const errors = []
  const stayError = inpatientActionError(patient, 'transfer')
  if (stayError) errors.push(stayError)
  if (!trimText(body.bedId)) errors.push('New bed is required.')
  if (!trimText(body.transferReason)) errors.push('Transfer reason is required.')
  if (!trimText(body.transferDate)) errors.push('Transfer date is required.')
  else if (patient?.admissionDate && body.transferDate < patient.admissionDate) {
    errors.push('Transfer date cannot be before admission date.')
  } else if (body.transferDate > todayStr()) {
    errors.push('Transfer date cannot be after today.')
  }
  return errors
}
