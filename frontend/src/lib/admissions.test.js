import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyEmergencyPrice, isEmergencyOpdAdmission, stayLocationLabel } from './admissions.js'

describe('frontend emergency admission helpers', () => {
  it('labels Emergency OPD location without inventing a bed', () => {
    assert.equal(stayLocationLabel({ admissionType: 'emergency-opd' }), 'Emergency OPD')
    assert.equal(stayLocationLabel({ admissionType: 'normal', room: 'ICU', bed: 'ICU-01' }), 'ICU / ICU-01')
  })

  it('applies the same 1.25 display formula as the server', () => {
    assert.equal(isEmergencyOpdAdmission({ admissionType: 'emergency-opd' }), true)
    assert.equal(applyEmergencyPrice(200, { emergencyPricing: true }).unitPrice, 250)
  })
})
