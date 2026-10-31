import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAdmissionPrice,
  catalogPricingForPatient,
  INPATIENT_PRICE_MULTIPLIER,
  isEmergencyOpdAdmission,
  normalizeAdmissionType,
} from './admissions.js'
import { validateAdmitBody, validateConvertToInpatientBody } from './validation.js'

describe('emergency OPD admission type', () => {
  it('normalizes Emergency OPD and rejects unknown types', () => {
    assert.equal(normalizeAdmissionType('emergency-opd'), 'emergency-opd')
    assert.equal(normalizeAdmissionType('EMERGENCY-OPD'), 'emergency-opd')
    assert.equal(normalizeAdmissionType('normal'), 'normal')
    assert.equal(normalizeAdmissionType('twin'), null)
  })

  it('identifies Emergency OPD patients for catalog pricing', () => {
    assert.equal(isEmergencyOpdAdmission('emergency-opd'), true)
    assert.equal(isEmergencyOpdAdmission({ admissionType: 'emergency-opd' }), true)
    assert.equal(isEmergencyOpdAdmission({ admissionType: 'normal' }), false)
    assert.deepEqual(catalogPricingForPatient({ admissionType: 'emergency-opd' }), {
      inpatientPricing: false,
      pricingAdmissionType: 'emergency-opd',
    })
    assert.deepEqual(catalogPricingForPatient({ admissionType: 'normal' }), {
      inpatientPricing: true,
      pricingAdmissionType: 'normal',
    })
  })
})

describe('admission pricing', () => {
  it('multiplies regular inpatient catalog prices by 1.25 exactly once from the base', () => {
    assert.equal(INPATIENT_PRICE_MULTIPLIER, 1.25)
    const examples = [
      [100, 125],
      [200, 250],
      [500, 625],
      [1000, 1250],
      [2000, 2500],
    ]
    for (const [base, expected] of examples) {
      const priced = applyAdmissionPrice(base, { inpatientPricing: true })
      assert.equal(priced.baseUnitPrice, base)
      assert.equal(priced.priceMultiplier, 1.25)
      assert.equal(priced.unitPrice, expected)
    }
  })

  it('leaves Emergency OPD catalog prices unchanged', () => {
    const priced = applyAdmissionPrice(200, { inpatientPricing: false })
    assert.equal(priced.unitPrice, 200)
    assert.equal(priced.priceMultiplier, 1)
    assert.equal(priced.baseUnitPrice, 200)
  })
})

describe('emergency OPD admit validation', () => {
  const identity = { name: 'Hanna', gender: 'Female', age: 30 }

  it('allows Emergency OPD without bed, doctor, or deposit', () => {
    assert.deepEqual(validateAdmitBody({ ...identity, admissionType: 'emergency-opd' }), [])
  })

  it('still requires a bed and deposit for normal inpatient admission', () => {
    const errors = validateAdmitBody({ ...identity, admissionType: 'normal' })
    assert.ok(errors.some((e) => /Bed is required/i.test(e)))
    assert.ok(errors.some((e) => /deposit/i.test(e)))
  })

  it('rejects a deposit on Emergency OPD admission', () => {
    const errors = validateAdmitBody({ ...identity, admissionType: 'emergency-opd', depositAmount: 15000 })
    assert.ok(errors.some((e) => /do not collect an admission deposit/i.test(e)))
  })
})

describe('convert to inpatient validation', () => {
  it('requires bed, doctor, and deposit', () => {
    const errors = validateConvertToInpatientBody({})
    assert.ok(errors.some((e) => /Bed is required/i.test(e)))
    assert.ok(errors.some((e) => /Doctor assignment is required/i.test(e)))
    assert.ok(errors.some((e) => /deposit/i.test(e)))
  })

  it('accepts a complete conversion body', () => {
    assert.deepEqual(
      validateConvertToInpatientBody({
        bedId: 'GW-01',
        doctorIds: ['doc-1'],
        depositAmount: 15000,
        depositMethod: 'Cash',
      }),
      []
    )
  })
})
