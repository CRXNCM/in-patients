const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const USE_API = import.meta.env.VITE_USE_API !== 'false'

function getToken() {
  return sessionStorage.getItem('medbill_token')
}

export function hasToken() {
  return Boolean(getToken())
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
  getPatientProfile: (id) => apiFetch(`/api/patients/${encodeURIComponent(id)}/profile`),
  getClinicalNotes: (patientId, admissionId) =>
    apiFetch(
      `/api/patients/${encodeURIComponent(patientId)}/admissions/${encodeURIComponent(admissionId)}/clinical-notes`
    ),
  createClinicalNote: (patientId, admissionId, body) =>
    apiFetch(
      `/api/patients/${encodeURIComponent(patientId)}/admissions/${encodeURIComponent(admissionId)}/clinical-notes`,
      { method: 'POST', body: JSON.stringify(body) }
    ),
  updateClinicalNote: (noteId, body) =>
    apiFetch(`/api/clinical-notes/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createPatient: (body) => apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(body) }),
  convertToInpatient: (id, body) =>
    apiFetch(`/api/patients/${id}/convert-to-inpatient`, { method: 'POST', body: JSON.stringify(body) }),
  getConversionRequests: () => apiFetch('/api/conversion-requests'),
  getPatientConversionRequests: (id) => apiFetch(`/api/patients/${encodeURIComponent(id)}/conversion-requests`),
  requestInpatientAdmission: (id, body) =>
    apiFetch(`/api/patients/${encodeURIComponent(id)}/conversion-requests`, { method: 'POST', body: JSON.stringify(body) }),
  resubmitConversionRequest: (id, body) =>
    apiFetch(`/api/conversion-requests/${encodeURIComponent(id)}/resubmit`, { method: 'POST', body: JSON.stringify(body) }),
  returnConversionRequest: (id, body) =>
    apiFetch(`/api/conversion-requests/${encodeURIComponent(id)}/return`, { method: 'POST', body: JSON.stringify(body) }),
  rejectConversionRequest: (id, body) =>
    apiFetch(`/api/conversion-requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify(body) }),
  cancelConversionRequest: (id, body) =>
    apiFetch(`/api/conversion-requests/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify(body) }),
  completeConversionRequest: (id, body) =>
    apiFetch(`/api/conversion-requests/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(body) }),

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
  submitWardServices: (id, body) =>
    apiFetch(`/api/patients/${id}/ward-services`, { method: 'POST', body: JSON.stringify(body) }),
  submitReturn: (id, body) =>
    apiFetch(`/api/patients/${id}/returns`, { method: 'POST', body: JSON.stringify(body) }),
  updateRecord: (id, body) =>
    apiFetch(`/api/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  approveRecord: (id, note) =>
    apiFetch(`/api/records/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectRecord: (id, reason) =>
    apiFetch(`/api/records/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getReceptionRequests: () => apiFetch('/api/records/reception-requests'),
  approveReceptionItem: (recordId, lineId, note) =>
    apiFetch(`/api/records/${recordId}/items/${encodeURIComponent(lineId)}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectReceptionItem: (recordId, lineId, reason) =>
    apiFetch(`/api/records/${recordId}/items/${encodeURIComponent(lineId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getPharmacyOrders: () => apiFetch('/api/pharmacy/orders'),
  handoverPharmacyOrder: (id, body) =>
    apiFetch(`/api/pharmacy/orders/${id}/handover`, { method: 'POST', body: JSON.stringify(body) }),
  returnPharmacyOrder: (id, body) =>
    apiFetch(`/api/pharmacy/orders/${id}/returns`, { method: 'POST', body: JSON.stringify(body) }),
  verifyPharmacyReturn: (orderId, returnId, body) =>
    apiFetch(`/api/pharmacy/orders/${orderId}/returns/${encodeURIComponent(returnId)}/verify`, { method: 'POST', body: JSON.stringify(body) }),
  listMedicineReturns: () => apiFetch('/api/pharmacy/returns'),
  searchServiceHistory: ({ q, page, pageSize } = {}) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    const query = params.toString()
    return apiFetch(`/api/service-history/patients${query ? `?${query}` : ''}`)
  },
  getServiceHistoryPatient: (patientId) => apiFetch(`/api/service-history/patients/${encodeURIComponent(patientId)}`),
  getServiceHistoryRequests: (patientId, admissionId) =>
    apiFetch(`/api/service-history/patients/${encodeURIComponent(patientId)}/admissions/${encodeURIComponent(admissionId)}/requests`),
  getServiceHistoryReceipt: (patientId, admissionId) =>
    apiFetch(`/api/service-history/patients/${encodeURIComponent(patientId)}/admissions/${encodeURIComponent(admissionId)}/receipt`),
  getLaboratoryOrders: () => apiFetch('/api/laboratory/orders'),
  approveLaboratoryItem: (orderId, lineId, body) =>
    apiFetch(`/api/laboratory/orders/${orderId}/items/${encodeURIComponent(lineId)}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  rejectLaboratoryItem: (orderId, lineId, body) =>
    apiFetch(`/api/laboratory/orders/${orderId}/items/${encodeURIComponent(lineId)}/reject`, { method: 'POST', body: JSON.stringify(body) }),
  cancelLaboratoryItem: (orderId, lineId, body) =>
    apiFetch(`/api/laboratory/orders/${orderId}/items/${encodeURIComponent(lineId)}/cancel`, { method: 'POST', body: JSON.stringify(body) }),

  getSettings: () => apiFetch('/api/settings'),
  updateSettings: (body) => apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  getCategories: () => apiFetch('/api/settings/categories'),
  createCategory: (body) =>
    apiFetch('/api/settings/categories', { method: 'POST', body: JSON.stringify(body) }),
  getCategoryServices: (slug) =>
    apiFetch(`/api/settings/categories/${encodeURIComponent(slug)}/services`),
  createCategoryService: (slug, body) =>
    apiFetch(`/api/settings/categories/${encodeURIComponent(slug)}/services`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCategoryService: (slug, serviceId, body) =>
    apiFetch(
      `/api/settings/categories/${encodeURIComponent(slug)}/services/${encodeURIComponent(serviceId)}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    ),
  updateCategoryBillingType: (slug, billingType) =>
    apiFetch(`/api/settings/categories/${slug}/billing-type`, {
      method: 'PATCH',
      body: JSON.stringify({ billingType }),
    }),
  previewCatalogImport: (body) =>
    apiFetch('/api/settings/catalog/import/preview', { method: 'POST', body: JSON.stringify(body) }),
  applyCatalogImport: (body) =>
    apiFetch('/api/settings/catalog/import', { method: 'POST', body: JSON.stringify(body) }),

  getManagerDashboard: () => apiFetch('/api/manager/dashboard'),
  getManagerReport: (type, params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/reports/${type}${query ? `?${query}` : ''}`)
  },
  listCreditCompanies: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/credit-companies${query ? `?${query}` : ''}`)
  },
  createCreditCompany: (body) =>
    apiFetch('/api/credit-companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCreditCompany: (id, body) =>
    apiFetch(`/api/credit-companies/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getManagerDeposits: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/deposits${query ? `?${query}` : ''}`)
  },
  getManagerCharges: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/charges${query ? `?${query}` : ''}`)
  },
  getManagerOutstanding: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/outstanding${query ? `?${query}` : ''}`)
  },
  getManagerCreditPatients: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/credit-patients${query ? `?${query}` : ''}`)
  },
  getManagerDischargedPatients: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/manager/discharged-patients${query ? `?${query}` : ''}`)
  },
  getAdminDashboard: () => apiFetch('/api/admin/dashboard'),
  getNurseDashboard: () => apiFetch('/api/nurse/dashboard'),
  getReceptionDashboard: () => apiFetch('/api/reception/dashboard'),
  getReceptionCriticalBalances: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/reception/critical-balances${query ? `?${query}` : ''}`)
  },
  getReceptionRecentlyApproved: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qs.set(key, value)
    })
    const query = qs.toString()
    return apiFetch(`/api/reception/recently-approved${query ? `?${query}` : ''}`)
  },
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
