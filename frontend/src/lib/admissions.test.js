import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyAdmissionPrice, isEmergencyOpdAdmission, stayLocationLabel } from './admissions.js'

describe('frontend emergency admission helpers', () => {
  it('labels Emergency OPD location without inventing a bed', () => {
    assert.equal(stayLocationLabel({ admissionType: 'emergency-opd' }), 'Emergency OPD')
    assert.equal(stayLocationLabel({ admissionType: 'normal', room: 'ICU', bed: 'ICU-01' }), 'ICU / ICU-01')
  })

  it('uses catalog prices for Emergency OPD and 1.25 for regular inpatient', () => {
    assert.equal(isEmergencyOpdAdmission({ admissionType: 'emergency-opd' }), true)
    assert.equal(applyAdmissionPrice(200, { inpatientPricing: false }).unitPrice, 200)
    assert.equal(applyAdmissionPrice(200, { inpatientPricing: true }).unitPrice, 250)
  })
})
