export function isOfflineWorkflowUser(user) {
  if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('medbill_token')) return false
  return user?.roleKey === 'pharmacist' || user?.roleKey === 'laboratory'
}

export function workflowActor(user) {
  return {
    id: String(user?.id || ''),
    name: user?.name || 'Staff',
  }
}

export function canCreateWorkflowRequest(user) {
  return user?.roleKey === 'nurse'
}

export function canApprovePharmacy(user) {
  return user?.roleKey === 'pharmacist'
}

export function canProcessLaboratory(user) {
  return user?.roleKey === 'laboratory'
}

export function canCancelRequest(user, request) {
  if (!user || !request) return false
  if (user.roleKey === 'nurse') {
    return request.status === 'pending' && String(request.requestedById) === String(user.id)
  }
  if (user.roleKey === 'laboratory' && request.kind === 'laboratory') {
    return request.status === 'pending' || request.status === 'processing'
  }
  return false
}

export function canViewPharmacyQueue(user) {
  return user?.roleKey === 'pharmacist' || user?.roleKey === 'nurse' || user?.roleKey === 'admin'
}

export function canViewLaboratoryQueue(user) {
  return user?.roleKey === 'laboratory' || user?.roleKey === 'nurse' || user?.roleKey === 'admin'
}
