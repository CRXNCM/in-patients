import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCreditState, normalizeAdmissionPaymentMode } from './credit.js'
import { validateAdmitBody } from './validation.js'

describe('credit state', () => {
  it('treats credit with zero paid as outstanding credit', () => {
    const state = computeCreditState({
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 0,
    })
    assert.equal(state.isCreditPatient, true)
    assert.equal(state.outstandingDeposit, 15000)
    assert.equal(state.depositStatus, 'credit')
  })

  it('keeps partial payments as credit until the required deposit is met', () => {
    const partial = computeCreditState({
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 4000,
    })
    assert.equal(partial.isCreditPatient, true)
    assert.equal(partial.outstandingDeposit, 11000)
    assert.equal(partial.depositStatus, 'partially-paid')

    const paid = computeCreditState({
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 15000,
    })
    assert.equal(paid.isCreditPatient, false)
    assert.equal(paid.outstandingDeposit, 0)
    assert.equal(paid.depositStatus, 'paid')
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
    const errors = validateAdmitBody({ ...base, depositAmount: 0, admissionPaymentMode: 'credit' })
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
