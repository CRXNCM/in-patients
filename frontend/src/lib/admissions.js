export const EMERGENCY_OPD = 'emergency-opd'
export const EMERGENCY_PRICE_MULTIPLIER = 1.25
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

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function applyEmergencyPrice(basePrice, { emergencyPricing = false } = {}) {
  const baseUnitPrice = roundMoney(basePrice)
  if (!emergencyPricing) {
    return { baseUnitPrice, priceMultiplier: 1, unitPrice: baseUnitPrice }
  }
  return {
    baseUnitPrice,
    priceMultiplier: EMERGENCY_PRICE_MULTIPLIER,
    unitPrice: roundMoney(baseUnitPrice * EMERGENCY_PRICE_MULTIPLIER),
  }
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
