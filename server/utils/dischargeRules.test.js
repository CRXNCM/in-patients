import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dischargeRequestStatusError,
  dischargeApproveStatusError,
  dischargePendingRecordsError,
  dischargeOutstandingBalanceError,
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

describe('discharge pending records', () => {
  it('allows completion when there are no pending records', () => {
    assert.equal(dischargePendingRecordsError(0), null)
    assert.equal(dischargePendingRecordsError(undefined), null)
  })

  it('blocks completion while records await review', () => {
    assert.match(dischargePendingRecordsError(1), /1 pending record is awaiting/)
    assert.match(dischargePendingRecordsError(3), /3 pending records are awaiting/)
  })
})

describe('discharge outstanding balance', () => {
  it('allows completion when there is no outstanding amount', () => {
    assert.equal(
      dischargeOutstandingBalanceError({ outstanding: 0, isCreditPatient: false }),
      null
    )
    assert.equal(
      dischargeOutstandingBalanceError({ outstanding: -10, isCreditPatient: false }),
      null
    )
  })

  it('always blocks non-credit patients with an outstanding balance', () => {
    assert.match(
      dischargeOutstandingBalanceError({
        outstanding: 10000,
        isCreditPatient: false,
        allowCreditOutstanding: true,
      }),
      /Non-credit patients must settle an outstanding balance of 10000 ETB/
    )
  })

  it('lets credit patients proceed when outstanding credit is allowed', () => {
    assert.equal(
      dischargeOutstandingBalanceError({
        outstanding: 20000,
        isCreditPatient: true,
        allowCreditOutstanding: true,
      }),
      null
    )
  })

  it('blocks credit patients when outstanding credit is not allowed', () => {
    assert.match(
      dischargeOutstandingBalanceError({
        outstanding: 400,
        isCreditPatient: true,
        allowCreditOutstanding: false,
      }),
      /Outstanding balance of 400 ETB must be settled/
    )
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
