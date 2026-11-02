import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canCompleteStayDischarge,
  canRequestStayDischarge,
  canReviewStayCharges,
  emergencyServicesAutoApprove,
  isEmergencyDeskRole,
  stayScopeFilter,
  stayVisibleToAuth,
} from './stayScope.js'

const emergencyNurse = {
  slug: 'emergency-nurse',
  active: true,
  permissions: ['patients.view', 'patients.edit', 'admissions.create_emergency'],
}
const wardNurse = {
  slug: 'nurse',
  active: true,
  permissions: ['patients.view', 'patients.edit'],
}
const reception = {
  slug: 'reception',
  active: true,
  permissions: ['patients.view', 'admissions.create', 'admissions.create_emergency', 'admissions.edit', 'admissions.discharge'],
}

describe('emergency stay visibility', () => {
  it('treats Emergency Nurse as the emergency desk', () => {
    assert.equal(isEmergencyDeskRole(emergencyNurse), true)
    assert.equal(isEmergencyDeskRole(wardNurse), false)
    assert.equal(isEmergencyDeskRole(reception), false)
  })

  it('hides unconverted Emergency OPD from Reception and ward nurses', () => {
    const stay = { admissionType: 'emergency-opd' }
    assert.equal(stayVisibleToAuth(stay, { user: { role: 'Reception' }, role: reception }), false)
    assert.equal(stayVisibleToAuth(stay, { user: { role: 'Nurse' }, role: wardNurse }), false)
    assert.equal(stayVisibleToAuth(stay, { user: { role: 'Nurse' }, role: emergencyNurse }), true)
    assert.equal(stayVisibleToAuth({ admissionType: 'normal' }, { user: { role: 'Reception' }, role: reception }), true)
  })

  it('scopes mongo filters by desk', () => {
    assert.deepEqual(stayScopeFilter({ user: { role: 'Reception' }, role: reception }), { admissionType: { $ne: 'emergency-opd' } })
    assert.deepEqual(stayScopeFilter({ user: { role: 'Nurse' }, role: emergencyNurse }), { admissionType: 'emergency-opd' })
    assert.deepEqual(stayScopeFilter({ user: { role: 'Nurse' }, role: wardNurse }), { admissionType: { $ne: 'emergency-opd' } })
    assert.deepEqual(stayScopeFilter({ user: { role: 'Pharmacist' } }), {})
  })

  it('auto-approves Emergency OPD services except pharmacy and laboratory', () => {
    const stay = { admissionType: 'emergency-opd' }
    assert.equal(emergencyServicesAutoApprove(stay, [{ category: 'Nursing' }]), true)
    assert.equal(emergencyServicesAutoApprove(stay, [{ category: 'Pharmacy' }]), false)
    assert.equal(emergencyServicesAutoApprove(stay, [{ category: 'Laboratory' }]), false)
    assert.equal(emergencyServicesAutoApprove({ admissionType: 'normal' }, [{ category: 'Nursing' }]), false)
  })

  it('lets only the Emergency Nurse discharge Emergency OPD', () => {
    const stay = { admissionType: 'emergency-opd' }
    const inpatient = { admissionType: 'normal' }
    assert.equal(canRequestStayDischarge(stay, { user: { role: 'Nurse' }, role: emergencyNurse }), true)
    assert.equal(canCompleteStayDischarge(stay, { user: { role: 'Nurse' }, role: emergencyNurse }), true)
    assert.equal(canRequestStayDischarge(stay, { user: { role: 'Nurse' }, role: wardNurse }), false)
    assert.equal(canCompleteStayDischarge(stay, { user: { role: 'Reception' }, role: reception }), false)
    assert.equal(canCompleteStayDischarge(inpatient, { user: { role: 'Reception' }, role: reception }), true)
    assert.equal(canCompleteStayDischarge(inpatient, { user: { role: 'Nurse' }, role: emergencyNurse }), false)
  })

  it('lets only the Emergency Nurse review department releases on Emergency OPD', () => {
    const stay = { admissionType: 'emergency-opd' }
    const release = { status: 'pending', departmentCleared: true, workflowKind: 'pharmacy', services: [{ category: 'Pharmacy' }] }
    assert.equal(canReviewStayCharges(stay, { role: emergencyNurse }, release), true)
    assert.equal(canReviewStayCharges(stay, { role: reception }, release), false)
    assert.equal(canReviewStayCharges({ admissionType: 'normal' }, { role: reception }, release), true)
  })
})
