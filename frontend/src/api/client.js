const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const USE_API = import.meta.env.VITE_USE_API !== 'false'

function getToken() {
  return sessionStorage.getItem('medbill_token')
}

export function setToken(token) {
  if (token) sessionStorage.setItem('medbill_token', token)
  else sessionStorage.removeItem('medbill_token')
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed')
  return data
}

export const api = {
  health: () => apiFetch('/api/health'),
  login: (email, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiFetch('/api/auth/me'),

  getPatientsFull: () => apiFetch('/api/patients?view=full'),
  getPatients: () => apiFetch('/api/patients'),
  getPatient: (id) => apiFetch(`/api/patients/${id}`),
  createPatient: (body) => apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(body) }),
  upsertMaternityBaby: (id, body) =>
    apiFetch(`/api/patients/${id}/baby`, { method: 'PUT', body: JSON.stringify(body) }),
  addDeposit: (id, body) =>
    apiFetch(`/api/patients/${id}/deposits`, { method: 'POST', body: JSON.stringify(body) }),
  transferRoom: (id, body) =>
    apiFetch(`/api/patients/${id}/transfer-room`, { method: 'POST', body: JSON.stringify(body) }),
  setDoctorVisit: (id, date, disabled) =>
    apiFetch(`/api/patients/${id}/doctor-visits/${date}`, {
      method: 'PATCH',
      body: JSON.stringify({ disabled }),
    }),
  getDoctors: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/doctors${qs ? `?${qs}` : ''}`)
  },
  getDoctor: (id) => apiFetch(`/api/doctors/${id}`),
  createDoctor: (body) => apiFetch('/api/doctors', { method: 'POST', body: JSON.stringify(body) }),
  updateDoctor: (id, body) => apiFetch(`/api/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getPatientDoctors: (id) => apiFetch(`/api/patients/${id}/doctors`),
  assignDoctor: (id, body) =>
    apiFetch(`/api/patients/${id}/doctors`, { method: 'POST', body: JSON.stringify(body) }),
  endDoctorAssignment: (id, assignmentId) =>
    apiFetch(`/api/patients/${id}/doctors/${assignmentId}/end`, { method: 'PATCH', body: JSON.stringify({}) }),
  runDailyCharges: (throughDate) =>
    apiFetch('/api/charges/daily', { method: 'POST', body: JSON.stringify({ throughDate }) }),
  getPendingDischarges: () => apiFetch('/api/patients/pending-discharge'),
  getDischargedPatients: () => apiFetch('/api/patients/discharged'),
  requestDischarge: (id, body = {}) =>
    apiFetch(`/api/patients/${id}/discharge-request`, { method: 'POST', body: JSON.stringify(body) }),
  approveDischarge: (id) =>
    apiFetch(`/api/patients/${id}/discharge/approve`, { method: 'POST', body: JSON.stringify({}) }),
  rejectDischarge: (id, reason) =>
    apiFetch(`/api/patients/${id}/discharge/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getRooms: () => apiFetch('/api/beds/rooms'),
  getAvailableBeds: (roomType) =>
    apiFetch(`/api/beds/available${roomType ? `?roomType=${encodeURIComponent(roomType)}` : ''}`),

  getRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/records${qs ? `?${qs}` : ''}`)
  },
  getPendingRecords: () => apiFetch('/api/records/pending'),
  getPatientRecords: (id) => apiFetch(`/api/patients/${id}/records`),
  submitRecord: (id, body) =>
    apiFetch(`/api/patients/${id}/records`, { method: 'POST', body: JSON.stringify(body) }),
  submitReturn: (id, body) =>
    apiFetch(`/api/patients/${id}/returns`, { method: 'POST', body: JSON.stringify(body) }),
  approveRecord: (id, note) =>
    apiFetch(`/api/records/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectRecord: (id, reason) =>
    apiFetch(`/api/records/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getSettings: () => apiFetch('/api/settings'),
  updateSettings: (body) => apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  getCategories: () => apiFetch('/api/settings/categories'),
  updateCategoryBillingType: (slug, billingType) =>
    apiFetch(`/api/settings/categories/${slug}/billing-type`, {
      method: 'PATCH',
      body: JSON.stringify({ billingType }),
    }),

  getManagerDashboard: () => apiFetch('/api/manager/dashboard'),
  getManagerReport: (type) => apiFetch(`/api/manager/reports/${type}`),
  getAdminDashboard: () => apiFetch('/api/admin/dashboard'),
  getNurseDashboard: () => apiFetch('/api/nurse/dashboard'),
  getReceptionDashboard: () => apiFetch('/api/reception/dashboard'),
  search: (q) => apiFetch(`/api/search?q=${encodeURIComponent(q)}`),

  getUsers: () => apiFetch('/api/users'),
  getUser: (id) => apiFetch(`/api/users/${id}`),
  createUser: (body) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => apiFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getRoles: () => apiFetch('/api/roles'),
  getRole: (id) => apiFetch(`/api/roles/${id}`),
  getPermissionCatalog: () => apiFetch('/api/roles/catalog'),
  createRole: (body) => apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(body) }),
  updateRole: (id, body) => apiFetch(`/api/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAuditLog: () => apiFetch('/api/audit'),

  getDepartments: () => apiFetch('/api/departments'),
  getDepartment: (id) => apiFetch(`/api/departments/${id}`),
  createDepartment: (body) => apiFetch('/api/departments', { method: 'POST', body: JSON.stringify(body) }),
  updateDepartment: (id, body) => apiFetch(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getWards: () => apiFetch('/api/wards'),
  getWard: (id) => apiFetch(`/api/wards/${id}`),
  createWard: (body) => apiFetch('/api/wards', { method: 'POST', body: JSON.stringify(body) }),
  updateWard: (id, body) => apiFetch(`/api/wards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getSetupRooms: () => apiFetch('/api/rooms'),
  createRoom: (body) => apiFetch('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
  updateRoom: (id, body) => apiFetch(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getSetupBeds: () => apiFetch('/api/beds'),
  createBed: (body) => apiFetch('/api/beds', { method: 'POST', body: JSON.stringify(body) }),
  updateBed: (id, body) => apiFetch(`/api/beds/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  previewBulkRooms: (body) => apiFetch('/api/rooms/bulk-preview', { method: 'POST', body: JSON.stringify(body) }),
  bulkCreateRooms: (body) => apiFetch('/api/rooms/bulk', { method: 'POST', body: JSON.stringify(body) }),
  previewBulkBeds: (body) => apiFetch('/api/beds/bulk-preview', { method: 'POST', body: JSON.stringify(body) }),
  bulkCreateBeds: (body) => apiFetch('/api/beds/bulk', { method: 'POST', body: JSON.stringify(body) }),
}

export { API_URL, USE_API }
