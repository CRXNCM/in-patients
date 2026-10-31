import { ConversionRequest, ACTIVE_CONVERSION_STATUSES } from '../models/ConversionRequest.js'
import { Patient } from '../models/Patient.js'
import { isEmergencyOpdAdmission } from '../utils/admissions.js'
import { convertEmergencyOpdToInpatient } from './emergencyConversion.js'

export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

export function actorFromReq(req) {
  return {
    id: req.user?.id || '',
    name: req.user?.name || '',
    role: req.auth?.role?.slug || req.user?.roleKey || req.user?.role || '',
  }
}

function trimText(value) {
  return String(value || '').trim()
}

function requireReason(value, label = 'Reason') {
  const reason = trimText(value)
  if (!reason) throw httpError(400, `${label} is required.`)
  return reason
}

function pushEvent(doc, action, actor, extra = {}) {
  doc.events = [
    ...(doc.events || []),
    {
      action,
      byId: actor?.id || '',
      byName: actor?.name || '',
      byRole: actor?.role || '',
      at: new Date().toISOString(),
      note: extra.note || '',
      before: extra.before ?? null,
      after: extra.after ?? null,
    },
  ]
}

export function toFrontendConversionRequest(doc, patient = null) {
  if (!doc) return null
  return {
    id: String(doc._id),
    patientId: doc.patientId,
    admissionId: doc.admissionId || '',
    patientName: patient?.name || '',
    admissionType: patient?.admissionType || null,
    admissionStatus: patient?.status || null,
    status: doc.status,
    pathway: doc.pathway,
    reason: doc.reason || '',
    notes: doc.notes || '',
    requestedById: doc.requestedById || '',
    requestedByName: doc.requestedByName || '',
    requestedByRole: doc.requestedByRole || '',
    requestedAt: doc.requestedAt?.toISOString?.() || doc.requestedAt || null,
    receptionNote: doc.receptionNote || '',
    returnedReason: doc.returnedReason || '',
    rejectedReason: doc.rejectedReason || '',
    cancelledReason: doc.cancelledReason || '',
    completedById: doc.completedById || '',
    completedByName: doc.completedByName || '',
    completedByRole: doc.completedByRole || '',
    completedAt: doc.completedAt?.toISOString?.() || doc.completedAt || null,
    conversionEvent: doc.conversionEvent || null,
    events: doc.events || [],
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt || null,
    updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt || null,
  }
}

export async function findActiveConversionRequest(patientId) {
  return ConversionRequest.findOne({
    patientId,
    status: { $in: ACTIVE_CONVERSION_STATUSES },
  })
}

export async function latestConversionRequest(patientId) {
  return ConversionRequest.findOne({ patientId }).sort({ createdAt: -1 })
}

async function loadEmergencyPatient(patientId) {
  const patient = await Patient.findOne({ patientId })
  if (!patient) throw httpError(404, 'Patient not found')
  if (!isEmergencyOpdAdmission(patient)) {
    throw httpError(400, 'Only Emergency OPD admissions can use inpatient conversion requests.')
  }
  if (patient.status === 'discharged') {
    throw httpError(400, 'A discharged admission cannot be converted.')
  }
  return patient
}

async function loadRequest(id) {
  const request = await ConversionRequest.findById(id)
  if (!request) throw httpError(404, 'Conversion request not found')
  return request
}

export async function requestInpatientAdmission({ patientId, body, actor }) {
  const patient = await loadEmergencyPatient(patientId)
  const reason = requireReason(body?.reason, 'Reason for inpatient admission')
  const notes = trimText(body?.notes)
  const active = await findActiveConversionRequest(patient.patientId)
  if (active) {
    throw httpError(409, 'An inpatient admission request is already open for this patient.')
  }

  try {
    const doc = await ConversionRequest.create({
      patientId: patient.patientId,
      admissionId: patient._id != null ? String(patient._id) : '',
      status: 'pending',
      pathway: 'reception',
      reason,
      notes,
      requestedById: actor.id,
      requestedByName: actor.name,
      requestedByRole: actor.role,
      requestedAt: new Date(),
      events: [],
    })
    pushEvent(doc, 'submitted', actor, { after: { reason, notes, status: 'pending' } })
    await doc.save()
    return doc
  } catch (err) {
    if (err?.code === 11000) {
      throw httpError(409, 'An inpatient admission request is already open for this patient.')
    }
    throw err
  }
}

export async function resubmitConversionRequest({ requestId, body, actor }) {
  const request = await loadRequest(requestId)
  if (request.status !== 'returned') {
    throw httpError(400, 'Only returned requests can be corrected and resubmitted.')
  }
  const patient = await loadEmergencyPatient(request.patientId)
  const reason = requireReason(body?.reason ?? request.reason, 'Reason for inpatient admission')
  const notes = body?.notes != null ? trimText(body.notes) : request.notes
  const before = { status: request.status, reason: request.reason, notes: request.notes }
  request.reason = reason
  request.notes = notes
  request.status = 'resubmitted'
  request.returnedReason = ''
  pushEvent(request, 'resubmitted', actor, { before, after: { status: 'resubmitted', reason, notes } })
  await request.save()
  return { request, patient }
}

export async function returnConversionRequest({ requestId, body, actor }) {
  const request = await loadRequest(requestId)
  if (!['pending', 'resubmitted'].includes(request.status)) {
    throw httpError(400, 'Only pending requests can be returned for correction.')
  }
  const reason = requireReason(body?.reason, 'Return reason')
  const before = { status: request.status }
  request.status = 'returned'
  request.returnedReason = reason
  request.receptionNote = reason
  pushEvent(request, 'returned', actor, { before, after: { status: 'returned' }, note: reason })
  await request.save()
  return request
}

export async function rejectConversionRequest({ requestId, body, actor }) {
  const request = await loadRequest(requestId)
  if (!ACTIVE_CONVERSION_STATUSES.includes(request.status)) {
    throw httpError(400, 'Only an open request can be rejected.')
  }
  const reason = requireReason(body?.reason, 'Rejection reason')
  const before = { status: request.status }
  request.status = 'rejected'
  request.rejectedReason = reason
  request.receptionNote = reason
  pushEvent(request, 'rejected', actor, { before, after: { status: 'rejected' }, note: reason })
  await request.save()
  return request
}

export async function cancelConversionRequest({ requestId, body, actor }) {
  const request = await loadRequest(requestId)
  if (!ACTIVE_CONVERSION_STATUSES.includes(request.status)) {
    throw httpError(400, 'Only an open request can be cancelled.')
  }
  const reason = trimText(body?.reason) || 'Cancelled before completion'
  const before = { status: request.status }
  request.status = 'cancelled'
  request.cancelledReason = reason
  pushEvent(request, 'cancelled', actor, { before, after: { status: 'cancelled' }, note: reason })
  await request.save()
  return request
}

function markRequestCompleted(request, actor, pathway, conversionEvent) {
  if (!ACTIVE_CONVERSION_STATUSES.includes(request.status) && request.status !== 'completed') {
    throw httpError(400, 'This conversion request can no longer be completed.')
  }
  if (request.status === 'completed') {
    throw httpError(409, 'This conversion has already been completed.')
  }
  const before = { status: request.status }
  request.status = 'completed'
  request.pathway = pathway
  request.completedById = actor.id
  request.completedByName = actor.name
  request.completedByRole = actor.role
  request.completedAt = new Date()
  request.conversionEvent = conversionEvent || null
  pushEvent(request, pathway === 'self' ? 'self_converted' : 'completed', actor, {
    before,
    after: { status: 'completed', pathway, bed: conversionEvent?.bed, doctorIds: conversionEvent?.doctorIds },
  })
  return request
}

export async function recordCompletedConversion({
  patient,
  actor,
  pathway,
  conversionEvent,
  existingRequest = null,
}) {
  if (existingRequest) {
    markRequestCompleted(existingRequest, actor, pathway, conversionEvent)
    await existingRequest.save()
    return existingRequest
  }
  const doc = await ConversionRequest.create({
    patientId: patient.patientId,
    admissionId: patient._id != null ? String(patient._id) : '',
    status: 'completed',
    pathway,
    reason: pathway === 'self' ? 'Emergency Nurse self-conversion' : 'Reception conversion',
    requestedById: actor.id,
    requestedByName: actor.name,
    requestedByRole: actor.role,
    requestedAt: new Date(),
    completedById: actor.id,
    completedByName: actor.name,
    completedByRole: actor.role,
    completedAt: new Date(),
    conversionEvent: conversionEvent || null,
    events: [],
  })
  pushEvent(doc, pathway === 'self' ? 'self_converted' : 'completed', actor, {
    after: { status: 'completed', pathway },
  })
  await doc.save()
  return doc
}

export async function completeReceptionConversion({ requestId, body, actor, userName, rules }) {
  const request = await loadRequest(requestId)
  if (!['pending', 'resubmitted'].includes(request.status)) {
    throw httpError(400, 'Only pending or resubmitted requests can be completed by Reception.')
  }
  const result = await convertEmergencyOpdToInpatient({
    patientId: request.patientId,
    body,
    userName,
    actor,
    pathway: 'reception',
    conversionRequestId: String(request._id),
    rules,
  })
  markRequestCompleted(request, actor, 'reception', result.conversionEvent)
  await request.save()
  return { ...result, request }
}

export async function completeSelfConversion({ patientId, body, actor, userName, rules }) {
  const patient = await loadEmergencyPatient(patientId)
  const active = await findActiveConversionRequest(patient.patientId)
  const result = await convertEmergencyOpdToInpatient({
    patientId: patient.patientId,
    body,
    userName,
    actor,
    pathway: 'self',
    conversionRequestId: active ? String(active._id) : '',
    rules,
  })
  const request = await recordCompletedConversion({
    patient: result.patient,
    actor,
    pathway: 'self',
    conversionEvent: result.conversionEvent,
    existingRequest: active,
  })
  return { ...result, request }
}

export async function listReceptionConversionQueue() {
  const requests = await ConversionRequest.find({
    status: { $in: ['pending', 'resubmitted'] },
  }).sort({ requestedAt: 1, createdAt: 1 })
  const ids = [...new Set(requests.map((row) => row.patientId))]
  const patients = ids.length
    ? await Patient.find({ patientId: { $in: ids } }).select('patientId name admissionType status admissionDate')
    : []
  const byId = Object.fromEntries(patients.map((row) => [row.patientId, row]))
  return requests.map((row) => toFrontendConversionRequest(row, byId[row.patientId]))
}

export async function listPatientConversionRequests(patientId) {
  const rows = await ConversionRequest.find({ patientId }).sort({ createdAt: -1 })
  return rows.map((row) => toFrontendConversionRequest(row))
}
