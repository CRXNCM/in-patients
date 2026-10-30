import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { categoryNeedsDepartment, departmentGateForLines, receptionHoldError } from './departmentBilling.js'

describe('department billing gate', () => {
  it('keeps pharmacy and laboratory lines off the bill until the department releases them', () => {
    assert.equal(categoryNeedsDepartment('Laboratory'), true)
    assert.equal(categoryNeedsDepartment('Pharmacy'), true)
    assert.equal(categoryNeedsDepartment('Nursing'), false)
    assert.equal(departmentGateForLines([{ category: 'Pharmacy' }]), 'pharmacy')
    assert.equal(departmentGateForLines([{ category: 'Laboratory' }, { category: 'Pharmacy' }]), '')

    const blocked = receptionHoldError({
      recordType: 'daily',
      status: 'pending',
      services: [{ category: 'Laboratory', serviceName: 'CBC' }],
    })
    assert.match(blocked, /department/)
    assert.equal(receptionHoldError({
      recordType: 'daily',
      departmentCleared: true,
      departmentGate: 'laboratory',
      services: [{ category: 'Laboratory' }],
    }), null)
    assert.equal(receptionHoldError({
      recordType: 'return',
      services: [{ category: 'Pharmacy' }],
    }), null)
    assert.equal(receptionHoldError({
      recordType: 'daily',
      services: [{ category: 'Ward procedure' }],
    }), null)
  })
})
