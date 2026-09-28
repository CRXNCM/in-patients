export const ACTIVE_STAY_STATUSES = ['admitted', 'pending-discharge']

export function isActiveStay(patient) {
  return ACTIVE_STAY_STATUSES.includes(patient?.status)
}

export function stayId(patient) {
  return patient?.patientId || patient?.id || ''
}

export function locationForPatient(patient, bedsByLabel = {}) {
  const bed = bedsByLabel[patient?.bed] || null
  return {
    roomType: patient?.room || bed?.roomType || '',
    wardId: bed?.wardId || patient?.wardId || '',
    wardName: bed?.wardName || patient?.wardName || '',
  }
}

export function patientMatchesStayFilters(patient, { roomType = '', ward = '', status = '' } = {}, bedsByLabel = {}) {
  if (!isActiveStay(patient)) return false
  if (status && patient.status !== status) return false
  const loc = locationForPatient(patient, bedsByLabel)
  if (roomType && loc.roomType !== roomType) return false
  if (ward && loc.wardId !== ward && loc.wardName !== ward) return false
  return true
}

export function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

export function stayFilterQuery(filters) {
  const params = new URLSearchParams()
  if (filters.roomType) params.set('roomType', filters.roomType)
  if (filters.ward) params.set('ward', filters.ward)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()
  return query ? `?${query}` : ''
}
