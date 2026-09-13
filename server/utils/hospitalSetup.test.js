import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateDepartmentBody, validateWardBody, validateRoomBody, validateBedBody } from './hospitalSetup.js'

describe('department validation', () => {
  it('requires a name', () => {
    assert.match(validateDepartmentBody({}).join(' '), /Department name/)
    assert.deepEqual(validateDepartmentBody({ name: 'Internal Medicine' }), [])
  })
})

describe('room validation', () => {
  it('requires number, ward, type, and capacity', () => {
    const errors = validateRoomBody({})
    assert.ok(errors.some((item) => /Room number/.test(item)))
    assert.ok(errors.some((item) => /Ward is required/.test(item)))
    assert.deepEqual(validateRoomBody({ name: '101', wardId: 'abc', roomType: 'ICU', capacity: 2 }), [])
    assert.deepEqual(validateRoomBody({ name: 'DR-1', wardId: 'abc', roomType: 'Delivery Room', capacity: 1 }), [])
  })
})

describe('bed validation', () => {
  it('requires a bed identifier and room', () => {
    const errors = validateBedBody({})
    assert.ok(errors.some((item) => /Bed identifier/.test(item)))
    assert.ok(errors.some((item) => /Room is required/.test(item)))
    assert.deepEqual(validateBedBody({ name: 'A', roomId: 'abc' }), [])
  })
})

describe('ward validation', () => {
  it('requires a name and department', () => {
    const errors = validateWardBody({})
    assert.ok(errors.some((item) => /Ward name/.test(item)))
    assert.ok(errors.some((item) => /Department is required/.test(item)))
    assert.deepEqual(validateWardBody({ name: 'Male Ward', departmentId: 'abc' }), [])
  })
})
