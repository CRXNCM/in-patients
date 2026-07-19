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
  addDeposit: (id, body) =>
    apiFetch(`/api/patients/${id}/deposits`, { method: 'POST', body: JSON.stringify(body) }),
  transferRoom: (id, body) =>
    apiFetch(`/api/patients/${id}/transfer-room`, { method: 'POST', body: JSON.stringify(body) }),
  setDoctorVisit: (id, date, disabled) =>
    apiFetch(`/api/patients/${id}/doctor-visits/${date}`, {
      method: 'PATCH',
      body: JSON.stringify({ disabled }),
    }),

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
}

export { API_URL, USE_API }
