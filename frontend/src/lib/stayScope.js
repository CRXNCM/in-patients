import { isEmergencyOpdAdmission } from './admissions.js'
import { hasPermission } from './permissions.js'

export function isEmergencyDeskUser(user) {
  return hasPermission(user, 'admissions.create_emergency') && !hasPermission(user, 'admissions.create')
}

export function stayVisibleToUser(patient, user) {
  const emergency = isEmergencyOpdAdmission(patient)
  const role = String(user?.roleKey || '').toLowerCase()
  if (role === 'reception') return !emergency
  if (role === 'nurse') {
    if (isEmergencyDeskUser(user)) return emergency
    return !emergency
  }
  return true
}

export function canRequestStayDischarge(patient, user) {
  if (String(user?.roleKey || '').toLowerCase() !== 'nurse') return false
  return stayVisibleToUser(patient, user)
}

export function canCompleteStayDischarge(patient, user) {
  if (!stayVisibleToUser(patient, user)) return false
  if (isEmergencyOpdAdmission(patient)) return isEmergencyDeskUser(user)
  return hasPermission(user, 'admissions.discharge')
}

export function canReviewEmergencyDepartmentRelease(patient, user, record) {
  if (!isEmergencyOpdAdmission(patient) || !isEmergencyDeskUser(user)) return false
  if (!record || record.status !== 'pending') return false
  return Boolean(record.departmentCleared)
}
