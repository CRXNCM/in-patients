import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePermissions, ALL_PERMISSION_KEYS, defaultPermissionsForSlug, roleHasPermission, permissionDiff, isSuperAdminRole } from './permissions.js'

describe('permission catalog', () => {
  it('drops unknown keys and duplicates', () => {
    assert.deepEqual(
      sanitizePermissions(['patients.view', 'patients.view', 'not.a.permission', '', 'payments.create']),
      ['patients.view', 'payments.create']
    )
  })

  it('gives Night Reception the example starter set', () => {
    const keys = defaultPermissionsForSlug('night-reception')
    assert.ok(keys.includes('patients.view'))
    assert.ok(keys.includes('patients.create'))
    assert.ok(!keys.includes('patients.edit'))
    assert.ok(!keys.includes('payments.view'))
    assert.ok(keys.includes('rooms.assign_beds'))
  })

  it('gives Super Admin every catalog key', () => {
    assert.equal(defaultPermissionsForSlug('super-admin').length, ALL_PERMISSION_KEYS.length)
  })

  it('predefines the four main roles with their full task sets', () => {
    assert.equal(defaultPermissionsForSlug('admin').length, ALL_PERMISSION_KEYS.length)
    const reception = defaultPermissionsForSlug('reception')
    const nurse = defaultPermissionsForSlug('nurse')
    const manager = defaultPermissionsForSlug('manager')
    assert.ok(reception.includes('admissions.create'))
    assert.ok(reception.includes('admissions.discharge'))
    assert.ok(reception.includes('payments.create'))
    assert.ok(nurse.includes('patients.edit'))
    assert.ok(nurse.includes('doctors.assign'))
    assert.ok(!nurse.includes('users.create'))
    assert.ok(manager.includes('reports.view'))
    assert.ok(manager.includes('reports.export'))
    assert.ok(!manager.includes('users.edit'))
  })
})

describe('role permission checks', () => {
  it('grants Super Admin every catalog key from the slug', () => {
    const role = { slug: 'super-admin', active: true, permissions: [] }
    assert.equal(isSuperAdminRole(role), true)
    assert.equal(roleHasPermission(role, 'users.create'), true)
    assert.equal(roleHasPermission(role, 'admissions.discharge'), true)
  })

  it('denies Night Reception management actions', () => {
    const role = {
      slug: 'night-reception',
      active: true,
      permissions: defaultPermissionsForSlug('night-reception'),
    }
    assert.equal(roleHasPermission(role, 'patients.create'), true)
    assert.equal(roleHasPermission(role, 'admissions.create'), true)
    assert.equal(roleHasPermission(role, 'users.create'), false)
    assert.equal(roleHasPermission(role, 'doctors.manage'), false)
    assert.equal(roleHasPermission(role, 'payments.refund'), false)
    assert.equal(roleHasPermission(role, 'admissions.discharge'), false)
  })

  it('computes added and removed permission keys', () => {
    const diff = permissionDiff(['admissions.create', 'patients.view'], ['patients.view', 'rooms.view'])
    assert.deepEqual(diff.added, ['rooms.view'])
    assert.deepEqual(diff.removed, ['admissions.create'])
  })
})
