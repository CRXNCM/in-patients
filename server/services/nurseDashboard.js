import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'

export const NURSE_DASHBOARD_PERMISSION = 'patients.view'

const INPATIENT_STATUSES = ['admitted', 'pending-discharge']
const RECENT_SUBMISSIONS_LIMIT = 6
const NEEDS_ATTENTION_LIMIT = 6
const CURRENT_INPATIENTS_LIMIT = 8

export function recordTypeForDashboard(recordType) {
  if (recordType === 'return') return 'pharmacy_return'
  if (recordType === 'manual') return 'manual'
  return 'daily_services'
}

export function mapRecentSubmission(doc, patientName = '') {
  const recordedAt =
    doc.recordedAt?.toISOString?.() || doc.createdAt?.toISOString?.() || null
  return {
    id: String(doc._id),
    patientId: doc.patientId,
    patientName: patientName || '',
    recordName: doc.recordName || '',
    type: recordTypeForDashboard(doc.recordType),
    status: doc.status,
    recordedAt,
    source: doc.source || 'nurse',
  }
}

export function mapNeedsAttention(doc) {
  return {
    patientId: doc.patientId,
    name: doc.name,
    room: doc.room || null,
    bed: doc.bed || null,
    status: doc.status,
    admissionDate: doc.admissionDate || null,
  }
}

export function mapNurseDoctorAssignment(doc) {
  return {
    id: String(doc._id),
    doctorId: doc.doctorId,
    doctorName: doc.doctorNameSnapshot,
    specialty: doc.specialtySnapshot,
    subjectType: doc.subjectType === 'baby' ? 'baby' : 'mother',
    babyId: doc.babyId || null,
    status: doc.status,
    effectiveFrom: doc.effectiveFrom || null,
  }
}

export function mapCurrentInpatient(doc, assignedDoctors = []) {
  return {
    patientId: doc.patientId,
    name: doc.name,
    room: doc.room || null,
    bed: doc.bed || null,
    status: doc.status,
    admissionDate: doc.admissionDate || null,
    admissionType: doc.admissionType || 'normal',
    assignedDoctors,
  }
}

export function submitterName(user) {
  return typeof user?.name === 'string' && user.name ? user.name : null
}

function defaultDeps() {
  return { Patient, ServiceRecord, DoctorAssignment }
}

export async function buildNurseDashboard(user, injected = {}) {
  const deps = { ...defaultDeps(), ...injected }
  const submittedBy = submitterName(user)

  const [
    admitted,
    pendingDischarge,
    myPendingRecords,
    recentDocs,
    needsAttentionDocs,
    inpatientDocs,
  ] = await Promise.all([
    deps.Patient.countDocuments({ status: 'admitted' }),
    deps.Patient.countDocuments({ status: 'pending-discharge' }),
    submittedBy
      ? deps.ServiceRecord.countDocuments({ submittedBy, status: 'pending' })
      : Promise.resolve(0),
    submittedBy
      ? deps.ServiceRecord.find({ submittedBy })
          .sort({ recordedAt: -1, createdAt: -1 })
          .limit(RECENT_SUBMISSIONS_LIMIT)
          .select('patientId recordName recordType status recordedAt createdAt source submittedBy')
          .lean()
      : Promise.resolve([]),
    deps.Patient.find({ status: 'pending-discharge' })
      .sort({ dischargeRequestedAt: -1, admissionDate: -1, createdAt: -1 })
      .limit(NEEDS_ATTENTION_LIMIT)
      .select('patientId name room bed status admissionDate')
      .lean(),
    deps.Patient.find({ status: { $in: INPATIENT_STATUSES } })
      .sort({ admissionDate: -1, createdAt: -1 })
      .limit(CURRENT_INPATIENTS_LIMIT)
      .select('patientId name room bed status admissionDate admissionType')
      .lean(),
  ])

  const recentPatientIds = [...new Set(recentDocs.map((doc) => doc.patientId).filter(Boolean))]
  const inpatientIds = inpatientDocs.map((doc) => doc.patientId).filter(Boolean)

  const [nameDocs, assignmentDocs] = await Promise.all([
    recentPatientIds.length
      ? deps.Patient.find({ patientId: { $in: recentPatientIds } })
          .select('patientId name')
          .lean()
      : Promise.resolve([]),
    inpatientDocs.length
      ? deps.DoctorAssignment.find({
          patientId: { $in: inpatientIds },
          status: 'active',
        })
          .sort({ assignedAt: 1 })
          .select('patientId doctorId doctorNameSnapshot specialtySnapshot subjectType babyId status effectiveFrom')
          .lean()
      : Promise.resolve([]),
  ])

  const namesById = Object.fromEntries(nameDocs.map((doc) => [doc.patientId, doc.name]))
  const doctorsByPatient = {}
  for (const row of assignmentDocs) {
    if (!doctorsByPatient[row.patientId]) doctorsByPatient[row.patientId] = []
    doctorsByPatient[row.patientId].push(mapNurseDoctorAssignment(row))
  }

  return {
    generatedAt: new Date().toISOString(),
    census: {
      admitted,
      pendingDischarge,
    },
    workQueue: {
      myPendingRecords,
      pendingDischarge,
    },
    recentSubmissions: recentDocs.map((doc) => mapRecentSubmission(doc, namesById[doc.patientId] || '')),
    needsAttention: needsAttentionDocs.map(mapNeedsAttention),
    currentInpatients: inpatientDocs.map((doc) =>
      mapCurrentInpatient(doc, doctorsByPatient[doc.patientId] || [])
    ),
  }
}

export { RECENT_SUBMISSIONS_LIMIT, NEEDS_ATTENTION_LIMIT, CURRENT_INPATIENTS_LIMIT }
