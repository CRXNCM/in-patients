import { ClinicalNote } from '../models/ClinicalNote.js'
import { Patient } from '../models/Patient.js'
import { User } from '../models/User.js'
import { roleHasPermission } from '../utils/permissions.js'
import { inpatientActionError } from '../utils/validation.js'

export const NOTE_MAX_LENGTH = 4000
export const CLINICAL_NOTES_VIEW = 'clinicalNotes.view'
export const CLINICAL_NOTES_CREATE = 'clinicalNotes.create'
export const CLINICAL_NOTES_EDIT_OWN = 'clinicalNotes.editOwn'
export const CLINICAL_NOTES_MANAGE = 'clinicalNotes.manage'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function defaultDeps() {
  return { ClinicalNote, Patient, User }
}

export function normalizeNoteText(value, { maxLength = NOTE_MAX_LENGTH } = {}) {
  const note = String(value ?? '').trim()
  if (!note) throw httpError(400, 'Note is required.')
  if (note.length > maxLength) {
    throw httpError(400, `Note must be ${maxLength} characters or fewer.`)
  }
  return note
}

export function stayIdForPatient(patient) {
  if (!patient?._id) return null
  return String(patient._id)
}

export function authorId(ref) {
  if (!ref) return null
  if (typeof ref === 'object' && ref._id) return String(ref._id)
  return String(ref)
}

export function authorLabel(user) {
  if (!user) return 'Staff'
  const name = user.name || 'Staff'
  const role = user.role ? String(user.role) : ''
  return role ? `${role} ${name}` : name
}

export function canMutateStay(patient) {
  return inpatientActionError(patient, 'clinical-notes')
}

export function canEditNote(note, auth, patient) {
  if (!note || !auth) return false
  if (note.isVoided) return false
  if (canMutateStay(patient)) return false
  if (roleHasPermission(auth.role, CLINICAL_NOTES_MANAGE)) return true
  return (
    roleHasPermission(auth.role, CLINICAL_NOTES_EDIT_OWN) &&
    authorId(note.createdBy) === String(auth.user?._id || auth.user?.id || '')
  )
}

function requirePermission(auth, key) {
  if (!roleHasPermission(auth?.role, key)) throw httpError(403, 'Forbidden')
}

export async function resolveAdmissionStay(patientId, admissionId, injected = {}) {
  const id = String(patientId || '').trim()
  const stayId = String(admissionId || '').trim()
  if (!id || !stayId) throw httpError(404, 'Admission not found')

  const deps = { ...defaultDeps(), ...injected }
  const found = deps.Patient.findOne({ patientId: id })
  const patient = typeof found?.then === 'function' ? await found : found
  if (!patient) throw httpError(404, 'Patient not found')
  if (stayIdForPatient(patient) !== stayId) throw httpError(404, 'Admission not found')
  return patient
}

function populateQuery(query) {
  if (typeof query?.populate !== 'function') return query
  return query
    .populate('createdBy', 'name role')
    .populate('voidedBy', 'name role')
    .populate('editHistory.editedBy', 'name role')
}

export function toFrontendNote(doc, auth, patient, { includeHistory = false } = {}) {
  const createdBy = doc.createdBy && typeof doc.createdBy === 'object' && doc.createdBy.name
    ? doc.createdBy
    : null
  const lastEdit = Array.isArray(doc.editHistory) && doc.editHistory.length
    ? doc.editHistory[doc.editHistory.length - 1]
    : null
  const payload = {
    id: String(doc._id),
    patientId: doc.patientId,
    admissionId: doc.admissionId,
    note: doc.note,
    createdById: authorId(doc.createdBy),
    createdByName: createdBy?.name || null,
    createdByRole: createdBy?.role || null,
    createdByLabel: authorLabel(createdBy),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    isEdited: Boolean(doc.isEdited),
    lastEditedAt: lastEdit?.editedAt
      ? lastEdit.editedAt instanceof Date
        ? lastEdit.editedAt.toISOString()
        : lastEdit.editedAt
      : null,
    isVoided: Boolean(doc.isVoided),
    voidedAt: doc.voidedAt instanceof Date ? doc.voidedAt.toISOString() : doc.voidedAt || null,
    voidReason: doc.voidReason || null,
    canEdit: canEditNote(doc, auth, patient),
  }

  if (includeHistory) {
    payload.editHistory = (doc.editHistory || []).map((entry) => ({
      previousNote: entry.previousNote,
      editedById: authorId(entry.editedBy),
      editedByName: entry.editedBy?.name || null,
      editedAt: entry.editedAt instanceof Date ? entry.editedAt.toISOString() : entry.editedAt,
    }))
  }

  return payload
}

export async function listClinicalNotes(auth, patientId, admissionId, injected = {}) {
  requirePermission(auth, CLINICAL_NOTES_VIEW)
  const patient = await resolveAdmissionStay(patientId, admissionId, injected)
  const deps = { ...defaultDeps(), ...injected }
  const includeHistory = roleHasPermission(auth.role, CLINICAL_NOTES_MANAGE)

  const found = deps.ClinicalNote.find({ patientId: patient.patientId, admissionId: stayIdForPatient(patient) }).sort({
    createdAt: -1,
  })
  const query = populateQuery(found)
  const rows = typeof query?.then === 'function' ? await query : await found

  return {
    admissionId: stayIdForPatient(patient),
    patientId: patient.patientId,
    status: patient.status,
    readOnly: Boolean(canMutateStay(patient)),
    canCreate: roleHasPermission(auth.role, CLINICAL_NOTES_CREATE) && !canMutateStay(patient),
    notes: (rows || []).map((doc) => toFrontendNote(doc, auth, patient, { includeHistory })),
  }
}

export async function createClinicalNote(auth, patientId, admissionId, body, injected = {}) {
  requirePermission(auth, CLINICAL_NOTES_CREATE)
  const patient = await resolveAdmissionStay(patientId, admissionId, injected)
  const stayError = canMutateStay(patient)
  if (stayError) throw httpError(400, stayError)

  const note = normalizeNoteText(body?.note)
  const userId = auth.user?._id || auth.user?.id
  if (!userId) throw httpError(401, 'Unauthorized')

  const deps = { ...defaultDeps(), ...injected }
  const created = await deps.ClinicalNote.create({
    patient: patient._id,
    patientId: patient.patientId,
    admissionId: stayIdForPatient(patient),
    note,
    createdBy: userId,
  })

  const loaded = typeof deps.ClinicalNote.findById === 'function'
    ? await populateQuery(deps.ClinicalNote.findById(created._id))
    : created
  return toFrontendNote(loaded || created, auth, patient, {
    includeHistory: roleHasPermission(auth.role, CLINICAL_NOTES_MANAGE),
  })
}

export async function updateClinicalNote(auth, noteId, body, injected = {}) {
  const deps = { ...defaultDeps(), ...injected }
  const found = populateQuery(deps.ClinicalNote.findById(noteId))
  const noteDoc = typeof found?.then === 'function' ? await found : found
  if (!noteDoc) throw httpError(404, 'Clinical note not found')

  const patient = await resolveAdmissionStay(noteDoc.patientId, noteDoc.admissionId, injected)
  if (!canEditNote(noteDoc, auth, patient)) {
    if (!roleHasPermission(auth?.role, CLINICAL_NOTES_EDIT_OWN) && !roleHasPermission(auth?.role, CLINICAL_NOTES_MANAGE)) {
      throw httpError(403, 'Forbidden')
    }
    const stayError = canMutateStay(patient)
    if (stayError) throw httpError(400, stayError)
    if (noteDoc.isVoided) throw httpError(400, 'This clinical note has been voided.')
    throw httpError(403, 'You can only edit your own clinical notes.')
  }

  const nextNote = normalizeNoteText(body?.note)
  if (nextNote === noteDoc.note) {
    return toFrontendNote(noteDoc, auth, patient, {
      includeHistory: roleHasPermission(auth.role, CLINICAL_NOTES_MANAGE),
    })
  }

  const userId = auth.user?._id || auth.user?.id
  noteDoc.editHistory = [
    ...(noteDoc.editHistory || []),
    {
      previousNote: noteDoc.note,
      editedBy: userId,
      editedAt: new Date(),
    },
  ]
  noteDoc.note = nextNote
  noteDoc.isEdited = true
  await noteDoc.save()

  const reloaded = typeof deps.ClinicalNote.findById === 'function'
    ? await populateQuery(deps.ClinicalNote.findById(noteDoc._id))
    : noteDoc
  return toFrontendNote(reloaded || noteDoc, auth, patient, {
    includeHistory: roleHasPermission(auth.role, CLINICAL_NOTES_MANAGE),
  })
}

export async function voidClinicalNote(auth, noteId, body, injected = {}) {
  requirePermission(auth, CLINICAL_NOTES_MANAGE)
  const deps = { ...defaultDeps(), ...injected }
  const found = populateQuery(deps.ClinicalNote.findById(noteId))
  const noteDoc = typeof found?.then === 'function' ? await found : found
  if (!noteDoc) throw httpError(404, 'Clinical note not found')

  const patient = await resolveAdmissionStay(noteDoc.patientId, noteDoc.admissionId, injected)
  if (noteDoc.isVoided) {
    return toFrontendNote(noteDoc, auth, patient, { includeHistory: true })
  }

  noteDoc.isVoided = true
  noteDoc.voidedBy = auth.user?._id || auth.user?.id
  noteDoc.voidedAt = new Date()
  noteDoc.voidReason = String(body?.reason || '').trim() || 'Voided by administrator'
  await noteDoc.save()

  const reloaded = typeof deps.ClinicalNote.findById === 'function'
    ? await populateQuery(deps.ClinicalNote.findById(noteDoc._id))
    : noteDoc
  return toFrontendNote(reloaded || noteDoc, auth, patient, { includeHistory: true })
}
