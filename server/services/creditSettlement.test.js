import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { convertCreditToCashPatient, invoiceNumberForDeposit, normalizeCreditPayerType } from './creditSettlement.js'

describe('credit settlement helpers', () => {
  it('converts a credit stay to a cash patient and keeps former company details', () => {
    const patient = {
      admissionPaymentMode: 'credit',
      isCreditPatient: true,
      creditCompanyId: 'co-1',
      creditCompanyName: 'Acme Cover',
    }
    assert.equal(convertCreditToCashPatient(patient, 'Lulit'), true)
    assert.equal(patient.admissionPaymentMode, 'paid')
    assert.equal(patient.isCreditPatient, false)
    assert.equal(patient.formerCreditPatient, true)
    assert.equal(patient.formerCreditCompanyName, 'Acme Cover')
    assert.equal(patient.creditSettledBy, 'Lulit')
  })

  it('does not convert a stay that is already cash', () => {
    const patient = { admissionPaymentMode: 'paid', isCreditPatient: false }
    assert.equal(convertCreditToCashPatient(patient, 'Lulit'), false)
  })

  it('builds a stable invoice number and payer type', () => {
    assert.equal(normalizeCreditPayerType('company'), 'credit_company')
    assert.equal(normalizeCreditPayerType('self'), 'self')
    assert.match(invoiceNumberForDeposit('PAT-021', '64f1ab'), /^CR-/)
  })
})
