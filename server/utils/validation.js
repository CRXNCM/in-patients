export const MIN_INITIAL_DEPOSIT = 15000
export const NON_CASH_PAYMENT_METHODS = ['Bank Transfer', 'Ebirr', 'Other']

function trimText(value) {
  return String(value ?? '').trim()
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isValidDateString(value) {
  if (!value) return false
  const d = new Date(`${value}T12:00:00`)
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10)
}

export function resolveAdmissionDate(value) {
  const trimmed = trimText(value)
  return trimmed || todayStr()
}

export function validateAdmitBody(body) {
  const errors = []
  const { name, age, dateOfBirth, gender, admissionDate, bedId, depositAmount, address } = body

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
  if (Number.isNaN(deposit) || deposit < MIN_INITIAL_DEPOSIT) {
    errors.push(`Initial deposit must be at least ${MIN_INITIAL_DEPOSIT} ETB.`)
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

export function validateDepositBody(body, existingRefs = []) {
  const errors = []
  const amount = Number(body.amount)
  if (Number.isNaN(amount) || amount <= 0) errors.push('Deposit amount must be greater than 0.')
  if (!trimText(body.method)) errors.push('Payment method is required.')

  const ref = trimText(body.referenceNumber)
  if (NON_CASH_PAYMENT_METHODS.includes(body.method) && !ref) {
    errors.push('Reference number is required for non-cash payments.')
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
    }
    return messages[action] || 'This action is not allowed for a discharged patient.'
  }
  if (patient.status === 'pending-discharge' && action === 'transfer') {
    return 'Cannot transfer a patient with a pending discharge request.'
  }
  return null
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
