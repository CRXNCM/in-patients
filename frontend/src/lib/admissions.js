export const EMERGENCY_OPD = 'emergency-opd'
export const INPATIENT_PRICE_MULTIPLIER = 1.25
export const EMERGENCY_PRICE_MULTIPLIER = INPATIENT_PRICE_MULTIPLIER
export const ADMISSION_TYPES = ['normal', 'maternity', 'emergency-opd']

export function normalizeAdmissionType(value) {
  const type = String(value || 'normal').trim().toLowerCase()
  return ADMISSION_TYPES.includes(type) ? type : null
}

export function isEmergencyOpdAdmission(patientOrType) {
  const type = typeof patientOrType === 'string' || patientOrType == null
    ? patientOrType
    : patientOrType?.admissionType
  return type === EMERGENCY_OPD
}

export function wasConvertedFromEmergency(patient) {
  return Boolean(patient?.convertedFromEmergency)
}

export function usesInpatientPricing(patient) {
  return !isEmergencyOpdAdmission(patient)
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function applyAdmissionPrice(basePrice, { inpatientPricing = false } = {}) {
  const baseUnitPrice = roundMoney(basePrice)
  if (!inpatientPricing) {
    return { baseUnitPrice, priceMultiplier: 1, unitPrice: baseUnitPrice }
  }
  return {
    baseUnitPrice,
    priceMultiplier: INPATIENT_PRICE_MULTIPLIER,
    unitPrice: roundMoney(baseUnitPrice * INPATIENT_PRICE_MULTIPLIER),
  }
}

export function applyEmergencyPrice(basePrice, { emergencyPricing = false, inpatientPricing } = {}) {
  const useInpatient = inpatientPricing != null ? Boolean(inpatientPricing) : !emergencyPricing
  return applyAdmissionPrice(basePrice, { inpatientPricing: useInpatient })
}

export function admissionTypeLabel(type) {
  if (type === 'maternity') return 'Maternity'
  if (type === EMERGENCY_OPD) return 'Emergency OPD'
  return 'Inpatient'
}

export function stayLocationLabel(patient) {
  if (isEmergencyOpdAdmission(patient)) return 'Emergency OPD'
  const room = patient?.room
  const bed = patient?.bed
  if (room && bed) return `${room} / ${bed}`
  if (room || bed) return room || bed
  return '—'
}

export function conversionStatusLabel(status) {
  const labels = {
    pending: 'Pending Inpatient Admission',
    returned: 'Returned for Correction',
    resubmitted: 'Resubmitted',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status || 'None'
}
