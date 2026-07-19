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

export function validateAdmitBody(body) {
  const errors = []
  const { name, age, gender, admissionDate, bedId, depositAmount, admissionReason, address, emergencyContact } = body

  if (!trimText(name)) errors.push('Full name is required.')
  if (!trimText(gender)) errors.push('Gender is required.')
  if (!trimText(admissionDate)) errors.push('Admission date is required.')
  else if (!isValidDateString(admissionDate)) errors.push('Admission date is not valid.')
  else if (admissionDate > todayStr()) errors.push('Admission date cannot be after today.')

  if (age === undefined || age === null || age === '') errors.push('Age is required.')
  else if (Number(age) < 0 || Number(age) > 120) errors.push('Age must be between 0 and 120.')

  if (!trimText(address)) errors.push('Address is required.')
  if (!trimText(emergencyContact)) errors.push('Emergency contact is required.')
  if (!trimText(admissionReason)) errors.push('Admission reason is required.')
  if (!bedId) errors.push('Bed is required.')

  const deposit = Number(depositAmount)
  if (Number.isNaN(deposit) || deposit < MIN_INITIAL_DEPOSIT) {
    errors.push(`Initial deposit must be at least ${MIN_INITIAL_DEPOSIT} ETB.`)
  }

  return errors
}

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

export function validateTransferBody(body, patient) {
  const errors = []
  if (!patient || patient.status === 'discharged') errors.push('Patient must currently be admitted.')
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
