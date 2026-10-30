import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCreditState, normalizeAdmissionPaymentMode } from './credit.js'
import { validateAdmitBody } from './validation.js'

describe('credit state', () => {
  it('does not treat the minimum deposit as credit outstanding', () => {
    const state = computeCreditState({
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 0,
    })
    assert.equal(state.isCreditPatient, true)
    assert.equal(state.outstandingDeposit, 0)
    assert.equal(state.requiredInitialDeposit, 0)
    assert.equal(state.depositStatus, 'unpaid')
  })

  it('keeps a credit admission marked as unpaid after a deposit is paid', () => {
    const partial = computeCreditState({
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 4000,
    })
    assert.equal(partial.isCreditPatient, true)
    assert.equal(partial.outstandingDeposit, 0)
    assert.equal(partial.depositStatus, 'unpaid')
  })

  it('does not mark a paid admission as a credit patient', () => {
    const state = computeCreditState({
      admissionPaymentMode: 'paid',
      requiredInitialDeposit: 15000,
      depositTotal: 15000,
    })
    assert.equal(state.isCreditPatient, false)
    assert.equal(state.depositStatus, 'paid')
  })
})

describe('admit validation credit', () => {
  const base = {
    name: 'Test Patient',
    age: 30,
    gender: 'Male',
    address: 'Dire Dawa',
    bedId: 'GW-01',
  }

  it('allows zero deposit on credit', () => {
    const errors = validateAdmitBody({ ...base, depositAmount: 0, admissionPaymentMode: 'credit', creditCompanyId: 'company-1' })
    assert.deepEqual(errors, [])
  })

  it('requires a credit company on a credit admission', () => {
    const errors = validateAdmitBody({ ...base, depositAmount: 0, admissionPaymentMode: 'credit' })
    assert.ok(errors.includes('Credit company is required.'))
  })

  it('allows an admission without an address', () => {
    const errors = validateAdmitBody({
      name: 'No Address',
      age: 22,
      gender: 'Female',
      bedId: 'GW-02',
      depositAmount: 15000,
    })
    assert.deepEqual(errors, [])
  })

  it('still requires the minimum deposit when paid', () => {
    const errors = validateAdmitBody({ ...base, depositAmount: 0, admissionPaymentMode: 'paid' })
    assert.match(errors[0], /15000/)
  })

  it('normalizes payment mode', () => {
    assert.equal(normalizeAdmissionPaymentMode('Credit'), 'credit')
    assert.equal(normalizeAdmissionPaymentMode('paid'), 'paid')
    assert.equal(normalizeAdmissionPaymentMode(''), 'paid')
  })
})
