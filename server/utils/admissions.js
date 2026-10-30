export const ADMISSION_TYPES = ['normal', 'maternity', 'emergency-opd']
export const EMERGENCY_OPD = 'emergency-opd'
export const EMERGENCY_PRICE_MULTIPLIER = 1.25

const ADMISSION_SET = new Set(ADMISSION_TYPES)

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function normalizeAdmissionType(value) {
  const type = String(value || 'normal').trim().toLowerCase()
  return ADMISSION_SET.has(type) ? type : null
}

export function admissionTypeForApi(value) {
  return normalizeAdmissionType(value) || 'normal'
}

export function isEmergencyOpdAdmission(patientOrType) {
  const type = typeof patientOrType === 'string' || patientOrType == null
    ? patientOrType
    : patientOrType.admissionType
  return admissionTypeForApi(type) === EMERGENCY_OPD
}

export function wasConvertedFromEmergency(patient) {
  return Boolean(patient?.convertedFromEmergency)
}

export function catalogPricingForPatient(patient) {
  return { emergencyPricing: isEmergencyOpdAdmission(patient) }
}

/**
 * Apply the Emergency OPD multiplier once from the catalog base price.
 * Never multiply an already adjusted unit price.
 */
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

export function pricedLineTotals(unitPrice, quantity) {
  const qty = Number(quantity) || 0
  const price = Number(unitPrice) || 0
  return { quantity: qty, unitPrice: price, total: roundMoney(qty * price) }
}
