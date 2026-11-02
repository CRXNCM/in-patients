import { isEmergencyOpdAdmission } from './admissions.js'
import { roleHasPermission } from './permissions.js'

function departmentCategory(category) {
  const raw = String(category || '').trim().toLowerCase()
  return raw === 'pharmacy' || raw === 'laboratory' || raw === 'lab'
}

export function isEmergencyDeskRole(role) {
  return roleHasPermission(role, 'admissions.create_emergency') && !roleHasPermission(role, 'admissions.create')
}

export function accessRoleOf(auth) {
  return auth?.user?.role || auth?.accessRole || ''
}

export function stayScopeFilter(auth) {
  const access = accessRoleOf(auth)
  if (access === 'Reception') return { admissionType: { $ne: 'emergency-opd' } }
  if (access === 'Nurse') {
    if (isEmergencyDeskRole(auth?.role)) return { admissionType: 'emergency-opd' }
    return { admissionType: { $ne: 'emergency-opd' } }
  }
  return {}
}

export function stayVisibleToAuth(patient, auth) {
  const emergency = isEmergencyOpdAdmission(patient)
  const access = accessRoleOf(auth)
  if (access === 'Reception') return !emergency
  if (access === 'Nurse') {
    if (isEmergencyDeskRole(auth?.role)) return emergency
    return !emergency
  }
  return true
}

export function stayAccessDenied(patient, auth) {
  if (stayVisibleToAuth(patient, auth)) return null
  return { status: 404, error: 'Patient not found' }
}

export function emergencyServicesAutoApprove(patient, lines = []) {
  if (!isEmergencyOpdAdmission(patient)) return false
  return !lines.some((line) => departmentCategory(line.category))
}

export function canReviewStayCharges(patient, auth, record) {
  const emergency = isEmergencyOpdAdmission(patient)
  if (emergency) {
    if (!isEmergencyDeskRole(auth?.role)) return false
    if (!record) return true
    if (record.status !== 'pending') return false
    return Boolean(record.departmentCleared)
  }
  return roleHasPermission(auth?.role, 'admissions.edit')
}

export function orderVisibleToAuth(order, auth) {
  return stayVisibleToAuth({ admissionType: order?.admissionType }, auth)
}

export function departmentReleaseNote(patient, gate, detail) {
  if (isEmergencyOpdAdmission(patient) || isEmergencyOpdAdmission(patient?.admissionType)) {
    return `${detail} Confirm it on the Emergency Nurse record. Reception does not see Emergency OPD until inpatient conversion.`
  }
  if (gate === 'pharmacy') {
    return `${detail} This handover is not a billing approval.`
  }
  return `${detail} The charge is still pending reception approval.`
}
