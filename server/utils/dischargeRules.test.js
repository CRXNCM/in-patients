import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dischargeRequestStatusError,
  dischargeApproveStatusError,
  dischargeRejectStatusError,
  validateDischargeRejectBody,
  inpatientActionError,
} from './validation.js'

describe('discharge request status', () => {
  it('allows admitted patients', () => {
    assert.equal(dischargeRequestStatusError('admitted'), null)
  })

  it('blocks a second request', () => {
    assert.match(dischargeRequestStatusError('pending-discharge'), /already pending/)
  })

  it('blocks a discharged patient', () => {
    assert.match(dischargeRequestStatusError('discharged'), /already discharged/)
  })
})

describe('discharge approve status', () => {
  it('allows pending-discharge', () => {
    assert.equal(dischargeApproveStatusError('pending-discharge'), null)
  })

  it('blocks admitted and discharged', () => {
    assert.match(dischargeApproveStatusError('admitted'), /pending discharge/)
    assert.match(dischargeApproveStatusError('discharged'), /already discharged/)
  })
})

describe('discharge reject', () => {
  it('allows pending-discharge', () => {
    assert.equal(dischargeRejectStatusError('pending-discharge'), null)
  })

  it('requires a reason', () => {
    assert.deepEqual(validateDischargeRejectBody({ reason: '  ' }), ['Rejection reason is required.'])
    assert.deepEqual(validateDischargeRejectBody({ reason: 'Need billing review' }), [])
  })

  it('blocks when not pending', () => {
    assert.match(dischargeRejectStatusError('admitted'), /pending discharge/)
    assert.match(dischargeRejectStatusError('discharged'), /pending discharge/)
  })
})

describe('inpatient write guards', () => {
  it('blocks discharged patients from services, deposits, transfer, and doctor visits', () => {
    const p = { status: 'discharged' }
    assert.match(inpatientActionError(p, 'records'), /discharged/)
    assert.match(inpatientActionError(p, 'deposits'), /deposit/)
    assert.match(inpatientActionError(p, 'transfer'), /transfer/)
    assert.match(inpatientActionError(p, 'doctor-visit'), /doctor/)
    assert.match(inpatientActionError(p, 'assign-doctor'), /doctor/)
  })

  it('blocks transfer while pending discharge but allows services and deposits', () => {
    const p = { status: 'pending-discharge' }
    assert.match(inpatientActionError(p, 'transfer'), /pending discharge/)
    assert.equal(inpatientActionError(p, 'records'), null)
    assert.equal(inpatientActionError(p, 'deposits'), null)
  })

  it('allows admitted patients', () => {
    const p = { status: 'admitted' }
    assert.equal(inpatientActionError(p, 'records'), null)
    assert.equal(inpatientActionError(p, 'transfer'), null)
    assert.equal(inpatientActionError(p, 'deposits'), null)
  })

  it('reports a missing patient', () => {
    assert.equal(inpatientActionError(null, 'records'), 'Patient not found.')
  })
})
