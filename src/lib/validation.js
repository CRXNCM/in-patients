import { BILLING_TYPES } from '@/data/mockData'

export const MIN_INITIAL_DEPOSIT = 15000
export const NON_CASH_PAYMENT_METHODS = ['Bank Transfer', 'Ebirr', 'Other']

const PHONE_DIGITS = /^(\+251|0)?9\d{8}$/

export function trimText(value) {
  return String(value ?? '').trim()
}

export function isValidDateString(value) {
  if (!value) return false
  const d = new Date(`${value}T12:00:00`)
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10)
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function validatePositiveNumber(value, label, { min = 0, allowZero = false } = {}) {
  const str = trimText(value)
  if (!str) return `${label} is required.`
  if (!/^\d+(\.\d+)?$/.test(str)) return `${label} must be a valid number (no letters or special characters).`
  const num = Number(str)
  if (num < min || (!allowZero && num <= 0)) {
    return allowZero && num === 0
      ? null
      : `${label} must be ${allowZero ? 'zero or ' : ''}greater than ${min}.`
  }
  return null
}

export function validateName(name) {
  const trimmed = trimText(name)
  if (!trimmed) return 'Full name is required.'
  if (/^\d+$/.test(trimmed.replace(/\s/g, ''))) return 'Name cannot contain only numbers.'
  if (trimmed.length < 2) return 'Full name must be at least 2 characters.'
  return null
}

export function validateAge(age) {
  const err = validatePositiveNumber(age, 'Age', { min: 0, allowZero: true })
  if (err) return err
  const num = Number(trimText(age))
  if (num > 120) return 'Age must be between 0 and 120.'
  return null
}

export function validateDateOfBirth(dob) {
  const trimmed = trimText(dob)
  if (!trimmed) return null
  if (!isValidDateString(trimmed)) return 'Date of birth is not a valid date.'
  if (trimmed > todayStr()) return 'Date of birth cannot be in the future.'
  return null
}

export function validatePhone(phone, { optional = false } = {}) {
  const trimmed = trimText(phone)
  if (!trimmed) return optional ? null : 'Phone number is required.'
  const normalized = trimmed.replace(/[\s-]/g, '')
  if (!PHONE_DIGITS.test(normalized)) {
    return 'Phone must be a valid Ethiopian number (e.g. +251 911 234 567 or 0911234567).'
  }
  return null
}

export function validateAdmissionDate(date) {
  const trimmed = trimText(date)
  if (!trimmed) return 'Admission date is required.'
  if (!isValidDateString(trimmed)) return 'Admission date is not valid.'
  if (trimmed > todayStr()) return 'Admission date cannot be after today.'
  return null
}

export function validateTransferDate(date, admissionDate) {
  const trimmed = trimText(date)
  if (!trimmed) return 'Transfer date is required.'
  if (!isValidDateString(trimmed)) return 'Transfer date is not valid.'
  if (admissionDate && trimmed < admissionDate) return 'Transfer date cannot be before admission date.'
  if (trimmed > todayStr()) return 'Transfer date cannot be after today.'
  return null
}

export function validatePatientRegistration(form) {
  const errors = {}

  const nameErr = validateName(form.name)
  if (nameErr) errors.name = nameErr

  const ageProvided = trimText(form.age) !== ''
  const dobProvided = trimText(form.dateOfBirth) !== ''
  if (!ageProvided && !dobProvided) {
    errors.age = 'Age or date of birth is required.'
  } else {
    if (ageProvided) {
      const ageErr = validateAge(form.age)
      if (ageErr) errors.age = ageErr
    }
    if (dobProvided) {
      const dobErr = validateDateOfBirth(form.dateOfBirth)
      if (dobErr) errors.dateOfBirth = dobErr
    }
  }

  if (!trimText(form.gender)) errors.gender = 'Gender is required.'

  const phoneErr = validatePhone(form.phone, { optional: true })
  if (phoneErr) errors.phone = phoneErr

  if (!trimText(form.emergencyContact)) errors.emergencyContact = 'Emergency contact is required.'
  if (!trimText(form.address)) errors.address = 'Address is required.'

  return errors
}

export function validateAdmission(form, { rooms = [], existingPatients = [] } = {}) {
  const errors = { ...validatePatientRegistration(form) }

  const admissionErr = validateAdmissionDate(form.admissionDate)
  if (admissionErr) errors.admissionDate = admissionErr

  if (!trimText(form.admissionReason)) errors.admissionReason = 'Admission reason is required.'
  if (!trimText(form.bedType)) errors.bedType = 'Room type is required.'

  const depositErr = validatePositiveNumber(form.initialDeposit, 'Initial deposit', { min: MIN_INITIAL_DEPOSIT })
  if (depositErr) errors.initialDeposit = depositErr

  if (!trimText(form.depositType)) errors.depositType = 'Payment method is required.'

  const room = rooms.find((r) => r.roomType === form.bedType)
  if (!room) {
    errors.bedType = 'Selected room type does not exist.'
  } else if (form.bedNumber) {
    const bed = room.beds.find((b) => b.label === trimText(form.bedNumber) || b.id === `BED-${trimText(form.bedNumber)}`)
    if (!bed) errors.bedNumber = 'Selected bed does not belong to this room type.'
    else if (bed.status !== 'available') errors.bedNumber = 'Selected bed is not available.'
  } else {
    const hasAvailable = room.beds.some((b) => b.status === 'available')
    if (!hasAvailable) errors.bedNumber = 'No available beds in the selected room type.'
  }

  const mrn = trimText(form.mrn)
  const nationalId = trimText(form.nationalId)
  if (mrn && existingPatients.some((p) => trimText(p.mrn) === mrn)) {
    errors.mrn = 'A patient with this MRN already exists.'
  }
  if (nationalId && existingPatients.some((p) => trimText(p.nationalId) === nationalId)) {
    errors.nationalId = 'A patient with this National ID already exists.'
  }

  return errors
}

export function findDuplicateNameAgeWarning(form, existingPatients = []) {
  const name = trimText(form.name).toLowerCase()
  const age = Number(trimText(form.age))
  if (!name || Number.isNaN(age)) return null
  const match = existingPatients.find(
    (p) => trimText(p.name).toLowerCase() === name && Number(p.age) === age && p.status !== 'discharged'
  )
  return match
    ? `Warning: another admitted patient "${match.name}" (age ${match.age}) already exists. Continue anyway?`
    : null
}

export function validateRoomTransfer(form, patient, rooms) {
  const errors = {}

  if (!patient || patient.status === 'discharged') {
    errors.patient = 'Patient must currently be admitted.'
    return errors
  }

  const dateErr = validateTransferDate(form.transferDate, patient.admissionDate)
  if (dateErr) errors.transferDate = dateErr

  if (!trimText(form.roomId)) errors.roomId = 'New room is required.'
  if (!trimText(form.bedId)) errors.bedId = 'New bed is required.'
  if (!trimText(form.transferReason)) errors.transferReason = 'Transfer reason is required.'

  const room = rooms.find((r) => r.id === form.roomId)
  if (!room) {
    errors.roomId = 'Selected room does not exist.'
  } else {
    const bed = room.beds.find((b) => b.id === form.bedId)
    if (!bed) errors.bedId = 'Selected bed does not belong to this room.'
    else if (bed.status !== 'available') errors.bedId = 'Selected bed is not available.'
    else if (bed.label === patient.bed && room.roomType === patient.room) {
      errors.bedId = 'Cannot transfer to the same room and bed.'
    }
  }

  return errors
}

export function validateServiceCart(cart, activeCategory, categories) {
  const errors = {}
  const cat = categories.find((c) => c.name === activeCategory || c.id === activeCategory)

  if (!cat) {
    errors.category = 'Category must be selected.'
    return errors
  }

  if (cat.billingType === BILLING_TYPES.AUTOMATIC_DAILY) {
    errors.category = 'Automatic categories (Room, Doctor Visit) cannot be entered manually.'
    return errors
  }

  if (!cart?.length) {
    errors.services = 'At least one service must be selected.'
    return errors
  }

  for (const line of cart) {
    if (cat.billingType === BILLING_TYPES.QUANTITY) {
      const qtyErr = validatePositiveNumber(line.quantity, 'Quantity', { min: 0 })
      if (qtyErr) {
        errors.services = qtyErr
        break
      }
    }
  }

  return errors
}

export function validateReturnCart(returnCart) {
  const errors = {}
  if (!returnCart?.length) {
    errors.items = 'At least one return item is required.'
    return errors
  }
  for (const item of returnCart) {
    if (!trimText(item.serviceName)) {
      errors.items = 'Medicine selection is required.'
      break
    }
    const qtyErr = validatePositiveNumber(item.quantity, 'Return quantity', { min: 0 })
    if (qtyErr) {
      errors.items = qtyErr
      break
    }
  }
  return errors
}

export function validateDeposit(form, existingDeposits = []) {
  const errors = {}
  const amountErr = validatePositiveNumber(form.amount, 'Deposit amount', { min: 0 })
  if (amountErr) errors.amount = amountErr

  if (!trimText(form.method)) errors.method = 'Payment method is required.'

  const ref = trimText(form.referenceNumber)
  if (NON_CASH_PAYMENT_METHODS.includes(form.method) && !ref) {
    errors.referenceNumber = 'Reference number is required for non-cash payments.'
  }

  if (ref && existingDeposits.some((d) => trimText(d.referenceNumber) === ref)) {
    errors.referenceNumber = 'This payment reference has already been used.'
  }

  return errors
}

export function firstError(errors) {
  return Object.values(errors)[0] || null
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}
