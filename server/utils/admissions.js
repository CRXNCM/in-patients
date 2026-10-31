export const ADMISSION_TYPES = ['normal', 'maternity', 'emergency-opd']
export const EMERGENCY_OPD = 'emergency-opd'
export const INPATIENT_PRICE_MULTIPLIER = 1.25
/** @deprecated Use INPATIENT_PRICE_MULTIPLIER. Kept so older imports keep resolving. */
export const EMERGENCY_PRICE_MULTIPLIER = INPATIENT_PRICE_MULTIPLIER

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

export function usesInpatientPricing(patient) {
  return !isEmergencyOpdAdmission(patient)
}

export function catalogPricingForPatient(patient) {
  const admissionType = admissionTypeForApi(patient?.admissionType)
  return {
    inpatientPricing: usesInpatientPricing(patient),
    pricingAdmissionType: admissionType,
  }
}

/**
 * Apply the inpatient 1.25 multiplier once from the catalog base price.
 * Emergency OPD uses the catalog price unchanged.
 */
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

/** @deprecated Prefer applyAdmissionPrice({ inpatientPricing }). */
export function applyEmergencyPrice(basePrice, { emergencyPricing = false, inpatientPricing } = {}) {
  const useInpatient = inpatientPricing != null ? Boolean(inpatientPricing) : !emergencyPricing
  return applyAdmissionPrice(basePrice, { inpatientPricing: useInpatient })
}

export function pricedLineTotals(unitPrice, quantity) {
  const qty = Number(quantity) || 0
  const price = Number(unitPrice) || 0
  return { quantity: qty, unitPrice: price, total: roundMoney(qty * price) }
}
