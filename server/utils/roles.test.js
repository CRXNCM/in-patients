import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateRoleBody, validateUserBody, accessRoleKey, dashboardPathForAccessRole } from './roles.js'

describe('role validation', () => {
  it('requires a name and a known application access role', () => {
    assert.match(validateRoleBody({}).join(' '), /Role name/)
    assert.match(validateRoleBody({ name: 'Night Reception' }).join(' '), /Application access/)
    assert.deepEqual(validateRoleBody({ name: 'Night Reception', accessRole: 'Reception' }), [])
  })
})

describe('user validation', () => {
  it('requires name, username, password, and role on create', () => {
    const errors = validateUserBody({})
    assert.ok(errors.some((e) => /Full name/.test(e)))
    assert.ok(errors.some((e) => /Username/.test(e)))
    assert.ok(errors.some((e) => /Password/.test(e)))
    assert.ok(errors.some((e) => /Role/.test(e)))
  })

  it('allows edit without a password', () => {
    const errors = validateUserBody({ name: 'Mohammed Ali', username: 'mali', roleId: 'abc' }, { partial: true })
    assert.deepEqual(errors, [])
  })
})

describe('existing access mapping', () => {
  it('keeps current dashboards for the four system access roles', () => {
    assert.equal(accessRoleKey('Admin'), 'admin')
    assert.equal(dashboardPathForAccessRole('Reception'), '/reception')
    assert.equal(dashboardPathForAccessRole('Nurse'), '/nurse')
    assert.equal(dashboardPathForAccessRole('Manager'), '/manager')
  })
})
