function trimText(value) {
  return String(value ?? '').trim()
}

/**
 * Frontend-only inpatient pharmacy and laboratory requests.
 * These are ward service requests. They are not billing records and must not
 * be written into the daily service-record or pharmacy-return flow.
 *
 * Future API contract (do not implement these paths in the frontend task):
 * The backend should expose operations, not a guessed URL scheme:
 * - List pharmacy requests with status, search (patient name, patient id, medicine), and sort.
 * - List laboratory requests with status, search (patient name, patient id, test), priority, request date, and sort.
 * - Read one request, including its history.
 * - Create a pharmacy request: patientId, admissionId, catalogItemId, itemName, quantity, unit, dosage, note.
 * - Create a laboratory request: patientId, admissionId, catalogItemId, itemName, priority, note.
 * - Approve a pending pharmacy request. Approval means the medicine was handed to the nurse.
 * - Reject a pending pharmacy request with a required reason.
 * - Accept a pending laboratory request (pending -> processing).
 * - Complete a processing laboratory request with a required completion note.
 * - Cancel with a required reason: the requesting nurse may cancel their own pending request;
 *   laboratory staff may cancel a pending or processing laboratory request.
 * Authorization has to be enforced on the server. Suggested actors:
 * nurse (create, read, cancel own pending), pharmacist (read, approve, reject),
 * laboratory staff (read, accept, complete, cancel laboratory requests),
 * admin (read). Reception keeps the existing service-record approval flow.
 * Pharmacist and laboratory roles do not exist in the backend yet.
 */
export const WORKFLOW_API_CONTRACT = {
  listPharmacyRequests: ['status', 'search', 'sort'],
  listLaboratoryRequests: ['status', 'search', 'priority', 'date', 'sort'],
  getRequest: ['id'],
  createPharmacyRequest: ['patientId', 'admissionId', 'catalogItemId', 'itemName', 'quantity', 'unit', 'dosage', 'note'],
  createLaboratoryRequest: ['patientId', 'admissionId', 'catalogItemId', 'itemName', 'priority', 'note'],
  approvePharmacyRequest: ['id'],
  rejectPharmacyRequest: ['id', 'reason'],
  acceptLaboratoryRequest: ['id'],
  completeLaboratoryRequest: ['id', 'completionNote'],
  cancelRequest: ['id', 'reason'],
}

export const PHARMACY_STATUSES = ['pending', 'approved', 'rejected', 'cancelled']
export const LABORATORY_STATUSES = ['pending', 'processing', 'completed', 'cancelled']
export const LAB_PRIORITIES = ['routine', 'urgent']

export const DEMONSTRATION_MEDICATIONS = [
  { id: 'demo-med-ceftriaxone', name: 'Ceftriaxone 1g', unit: 'vial', demonstration: true },
  { id: 'demo-med-paracetamol', name: 'Paracetamol 500mg', unit: 'tablet', demonstration: true },
  { id: 'demo-med-saline', name: 'IV Normal Saline 500ml', unit: 'bag', demonstration: true },
  { id: 'demo-med-metformin', name: 'Metformin 500mg', unit: 'tablet', demonstration: true },
]

export const DEMONSTRATION_LAB_TESTS = [
  { id: 'demo-lab-cbc', name: 'Complete Blood Count (CBC)', unit: 'test', demonstration: true },
  { id: 'demo-lab-lft', name: 'Liver Function Test', unit: 'test', demonstration: true },
  { id: 'demo-lab-fbs', name: 'Blood Sugar (FBS)', unit: 'test', demonstration: true },
  { id: 'demo-lab-urine', name: 'Urinalysis', unit: 'test', demonstration: true },
]

const REASON_MIN = 3

export function workflowCatalogItems(categories, kind) {
  const slug = kind === 'pharmacy' ? 'pharmacy' : 'laboratory'
  const category = (categories || []).find((item) => item.id === slug || item.slug === slug)
  const items = (category?.services || [])
    .filter((item) => item && item.active !== false && trimText(item.name))
    .map((item) => ({
      id: String(item.id || item.name),
      name: item.name,
      unit: item.unit || '',
      demonstration: false,
    }))
  if (items.length) return { items, demonstrationCatalog: false }
  return {
    items: kind === 'pharmacy' ? DEMONSTRATION_MEDICATIONS : DEMONSTRATION_LAB_TESTS,
    demonstrationCatalog: true,
  }
}

export function requestDay(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function locationLabel(request) {
  const parts = [request?.ward, request?.room, request?.bed].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

export function admissionLabel(request) {
  return request?.admissionId || 'Current stay'
}

export function historyActionLabel(action) {
  const labels = {
    submitted: 'Submitted',
    approved: 'Approved and handed to the nurse',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    accepted: 'Accepted for processing',
    completed: 'Completed',
  }
  return labels[action] || action
}

function appendHistory(request, { action, actor, at, note, patch }) {
  return {
    ...request,
    ...patch,
    history: [
      ...(request.history || []),
      {
        id: `${request.id}-h${(request.history || []).length + 1}`,
        action,
        at,
        byId: String(actor?.id || ''),
        byName: actor?.name || 'Staff',
        note: note || '',
      },
    ],
  }
}

function requireReason(value, label) {
  const note = trimText(value)
  if (note.length < REASON_MIN) return { error: `Enter a ${label}.` }
  if (note.length > 400) return { error: `Keep the ${label} under 400 characters.` }
  return { note }
}

export function validatePharmacyDraft(draft = {}) {
  const errors = {}
  if (!trimText(draft.patientId)) errors.patientId = 'Select an admitted patient.'
  if (!trimText(draft.patientName)) errors.patientName = 'Patient name is missing.'
  if (!trimText(draft.itemName)) errors.itemName = 'Enter the medication name.'
  else if (trimText(draft.itemName).length > 120) errors.itemName = 'Keep the medication name under 120 characters.'
  const quantity = Number(draft.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    errors.quantity = 'Enter a whole quantity from 1 to 999.'
  }
  if (trimText(draft.dosage).length > 200) errors.dosage = 'Keep the dosage or instructions under 200 characters.'
  if (trimText(draft.note).length > 400) errors.note = 'Keep the note under 400 characters.'
  return errors
}

export function validateLaboratoryDraft(draft = {}) {
  const errors = {}
  if (!trimText(draft.patientId)) errors.patientId = 'Select an admitted patient.'
  if (!trimText(draft.patientName)) errors.patientName = 'Patient name is missing.'
  if (!trimText(draft.itemName)) errors.itemName = 'Select a laboratory test.'
  else if (trimText(draft.itemName).length > 120) errors.itemName = 'Keep the test name under 120 characters.'
  if (draft.priority !== 'routine' && draft.priority !== 'urgent') errors.priority = 'Select a priority.'
  if (trimText(draft.note).length > 400) errors.note = 'Keep the note under 400 characters.'
  return errors
}

export function firstDraftError(errors = {}) {
  return Object.values(errors)[0] || ''
}

function baseRequest(draft, actor, id, at, kind) {
  return {
    id,
    kind,
    demonstration: Boolean(draft.demonstration),
    patientId: String(draft.patientId),
    patientName: trimText(draft.patientName),
    admissionId: trimText(draft.admissionId),
    ward: trimText(draft.ward),
    room: trimText(draft.room),
    bed: trimText(draft.bed),
    catalogItemId: draft.catalogItemId || null,
    itemName: trimText(draft.itemName),
    quantity: kind === 'laboratory' ? 1 : Number(draft.quantity),
    unit: trimText(draft.unit),
    dosage: kind === 'pharmacy' ? trimText(draft.dosage) : '',
    priority: kind === 'laboratory' ? draft.priority : null,
    note: trimText(draft.note),
    status: 'pending',
    requestedById: String(actor?.id || ''),
    requestedByName: actor?.name || 'Nurse',
    requestedAt: at,
    rejectionReason: '',
    cancellationReason: '',
    completionNote: '',
    history: [],
  }
}

export function buildPharmacyRequest(draft, actor, id, at = new Date().toISOString()) {
  const errors = validatePharmacyDraft(draft)
  if (Object.keys(errors).length) return { errors }
  const request = baseRequest(draft, actor, id, at, 'pharmacy')
  return {
    request: appendHistory(request, {
      action: 'submitted',
      actor,
      at,
      note: request.note || 'Request submitted.',
      patch: { status: 'pending' },
    }),
  }
}

export function buildLaboratoryRequest(draft, actor, id, at = new Date().toISOString()) {
  const errors = validateLaboratoryDraft(draft)
  if (Object.keys(errors).length) return { errors }
  const request = baseRequest(draft, actor, id, at, 'laboratory')
  return {
    request: appendHistory(request, {
      action: 'submitted',
      actor,
      at,
      note: request.note || 'Request submitted.',
      patch: { status: 'pending' },
    }),
  }
}

export function approvePharmacyRequest(request, actor, at = new Date().toISOString()) {
  if (!request || request.kind !== 'pharmacy') return { error: 'This is not a pharmacy request.' }
  if (request.status !== 'pending') return { error: 'Only a pending request can be approved.' }
  return {
    request: appendHistory(request, {
      action: 'approved',
      actor,
      at,
      note: 'Medicine handed to the nurse.',
      patch: { status: 'approved' },
    }),
  }
}

export function rejectPharmacyRequest(request, actor, reason, at = new Date().toISOString()) {
  if (!request || request.kind !== 'pharmacy') return { error: 'This is not a pharmacy request.' }
  if (request.status !== 'pending') return { error: 'Only a pending request can be rejected.' }
  const reasonCheck = requireReason(reason, 'rejection reason')
  if (reasonCheck.error) return reasonCheck
  return {
    request: appendHistory(request, {
      action: 'rejected',
      actor,
      at,
      note: reasonCheck.note,
      patch: { status: 'rejected', rejectionReason: reasonCheck.note },
    }),
  }
}

export function acceptLaboratoryRequest(request, actor, at = new Date().toISOString()) {
  if (!request || request.kind !== 'laboratory') return { error: 'This is not a laboratory request.' }
  if (request.status !== 'pending') return { error: 'Only a pending request can be accepted.' }
  return {
    request: appendHistory(request, {
      action: 'accepted',
      actor,
      at,
      note: 'Request accepted for processing.',
      patch: { status: 'processing' },
    }),
  }
}

export function completeLaboratoryRequest(request, actor, completionNote, at = new Date().toISOString()) {
  if (!request || request.kind !== 'laboratory') return { error: 'This is not a laboratory request.' }
  if (request.status !== 'processing') return { error: 'Accept the request before marking it complete.' }
  const noteCheck = requireReason(completionNote, 'completion note')
  if (noteCheck.error) return noteCheck
  return {
    request: appendHistory(request, {
      action: 'completed',
      actor,
      at,
      note: noteCheck.note,
      patch: { status: 'completed', completionNote: noteCheck.note },
    }),
  }
}

export function cancelWorkflowRequest(request, actor, reason, at = new Date().toISOString()) {
  if (!request) return { error: 'Request not found.' }
  const reasonCheck = requireReason(reason, 'cancellation reason')
  if (reasonCheck.error) return reasonCheck
  if (request.kind === 'pharmacy' && request.status !== 'pending') {
    return { error: 'Only a pending pharmacy request can be cancelled.' }
  }
  if (request.kind === 'laboratory' && request.status !== 'pending' && request.status !== 'processing') {
    return { error: 'This laboratory request can no longer be cancelled.' }
  }
  if (request.kind !== 'pharmacy' && request.kind !== 'laboratory') {
    return { error: 'This request cannot be cancelled.' }
  }
  return {
    request: appendHistory(request, {
      action: 'cancelled',
      actor,
      at,
      note: reasonCheck.note,
      patch: { status: 'cancelled', cancellationReason: reasonCheck.note },
    }),
  }
}

export function nextRequestId(requests, kind) {
  const prefix = kind === 'pharmacy' ? 'PHR' : 'LAB'
  let max = 2400
  for (const request of requests || []) {
    if (request.kind !== kind) continue
    const match = String(request.id || '').match(/(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${max + 1}`
}

export function queryWorkflowRequests(requests, filters = {}) {
  const {
    kind = '',
    status = 'all',
    search = '',
    priority = 'all',
    date = '',
    sort = 'newest',
    patientId = '',
  } = filters

  const needle = trimText(search).toLowerCase()
  const rows = (requests || []).filter((request) => {
    if (kind && request.kind !== kind) return false
    if (patientId && request.patientId !== patientId) return false
    if (status === 'open') {
      if (request.status !== 'pending' && request.status !== 'processing') return false
    } else if (status && status !== 'all' && request.status !== status) {
      return false
    }
    if (priority && priority !== 'all' && request.priority !== priority) return false
    if (date && requestDay(request.requestedAt) !== date) return false
    if (!needle) return true
    const haystack = [
      request.patientName,
      request.patientId,
      request.admissionId,
      request.itemName,
      request.requestedByName,
    ].join(' ').toLowerCase()
    return haystack.includes(needle)
  })

  rows.sort((a, b) => {
    const delta = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    if (delta === 0) return String(a.id).localeCompare(String(b.id))
    return sort === 'oldest' ? delta : -delta
  })
  return rows
}

export function countPending(requests, kind) {
  return (requests || []).filter((request) => request.kind === kind && request.status === 'pending').length
}
