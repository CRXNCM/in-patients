import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { MaternityBaby } from '../models/MaternityBaby.js'
import { roleHasPermission } from '../utils/permissions.js'
import { calcPatientBalance } from './autoCharges.js'
import { listAssignments } from './doctorAssignments.js'
import { recordAmount } from './receptionDashboard.js'
import { toFrontendBaby } from '../utils/maternity.js'
import {
  toFrontendDeposit,
  toFrontendDischarge,
  toFrontendRecord,
  buildRoomHistory,
} from '../utils/mappers.js'

export const PATIENT_PROFILE_PERMISSION = 'patients.view'

const ACTIVE_STATUSES = ['admitted', 'pending-discharge']

function defaultDeps() {
  return { Patient, ServiceRecord, Deposit, RoomAssignment, MaternityBaby, calcPatientBalance, listAssignments }
}

function forbidUnless(allowed) {
  if (allowed) return
  const error = new Error('Forbidden')
  error.status = 403
  throw error
}

function notFound() {
  const error = new Error('Patient not found')
  error.status = 404
  throw error
}

function iso(value) {
  if (!value) return null
  if (typeof value.toISOString === 'function') return value.toISOString()
  return value
}

function stripMoneyFromLines(lines = []) {
  return lines.map((line) => {
    const { unitPrice, total, ...rest } = line
    return rest
  })
}

function mapRecord(doc, includeMoney) {
  const record = toFrontendRecord(doc)
  const amount = recordAmount(doc)
  if (!includeMoney) {
    return {
      ...record,
      services: stripMoneyFromLines(record.services),
      returnItems: stripMoneyFromLines(record.returnItems),
    }
  }
  return { ...record, amount }
}

function mapDoctor(row, includeMoney) {
  if (!row) return null
  if (includeMoney) return row
  const { visitPrice, ...rest } = row
  return rest
}

function mapDischarge(doc, includeMoney) {
  const discharge = toFrontendDischarge(doc)
  if (!discharge) return null
  if (includeMoney) return discharge
  const { finalCharges, finalDeposits, finalBalance, ...rest } = discharge
  return rest
}

function mapRoomAssignment(doc, includeMoney) {
  return {
    id: String(doc._id),
    room: doc.roomType || null,
    bed: doc.bedLabel || null,
    startDate: doc.startDate || null,
    endDate: doc.endDate || null,
    status: doc.endDate ? 'ended' : 'current',
    reason: doc.reason || null,
    assignedBy: doc.assignedBy || null,
    dailyRate: includeMoney ? doc.dailyRate ?? null : undefined,
  }
}

export function splitApprovedTotals(records = []) {
  let approvedCharges = 0
  let approvedReturns = 0
  for (const doc of records) {
    if (doc.status && doc.status !== 'approved') continue
    const amount = recordAmount(doc)
    if (doc.recordType === 'return') approvedReturns += Math.abs(amount)
    else approvedCharges += amount
  }
  return { approvedCharges, approvedReturns }
}

export async function buildPatientProfile(auth, patientId, injected = {}) {
  forbidUnless(roleHasPermission(auth?.role, PATIENT_PROFILE_PERMISSION))
  const id = String(patientId || '').trim()
  if (!id) notFound()

  const deps = { ...defaultDeps(), ...injected }
  const includeMoney = roleHasPermission(auth?.role, 'payments.view')
  const includeCredit = roleHasPermission(auth?.role, 'credit.view')

  const found = deps.Patient.findOne({ patientId: id })
  const patient = typeof found?.lean === 'function' ? await found.lean() : await found
  if (!patient) notFound()

  const [records, deposits, assignments, doctors, baby, balance] = await Promise.all([
    deps.ServiceRecord.find({ patientId: id }).sort({ date: -1, createdAt: -1 }),
    includeMoney ? deps.Deposit.find({ patientId: id }).sort({ date: -1, createdAt: -1 }) : Promise.resolve([]),
    deps.RoomAssignment.find({ patientId: id }).sort({ startDate: 1 }),
    deps.listAssignments(id),
    deps.MaternityBaby.findOne({ motherPatientId: id }),
    includeMoney ? deps.calcPatientBalance(id) : Promise.resolve(null),
  ])

  const recordDocs = typeof records?.map === 'function' ? records : []
  const assignmentDocs = typeof assignments?.map === 'function' ? assignments : []
  const depositDocs = typeof deposits?.map === 'function' ? deposits : []
  const { approvedCharges, approvedReturns } = includeMoney ? splitApprovedTotals(recordDocs) : { approvedCharges: 0, approvedReturns: 0 }

  const active = ACTIVE_STATUSES.includes(patient.status)
  const profile = {
    id: patient.patientId,
    name: patient.name || '',
    patientId: patient.patientId,
    gender: patient.gender || null,
    age: patient.age ?? null,
    dateOfBirth: patient.dateOfBirth || null,
    phone: patient.phone || null,
    address: patient.address || null,
    emergencyContact: patient.emergencyContact || null,
    emergencyPhone: patient.emergencyPhone || null,
    mrn: patient.mrn || null,
    nationalId: patient.nationalId || null,
    createdAt: iso(patient.createdAt),
    status: patient.status,
    admissionType: patient.admissionType === 'maternity' ? 'maternity' : 'normal',
    admissionDate: patient.admissionDate || null,
    admissionReason: patient.admissionReason || null,
    room: patient.room || null,
    bed: patient.bed || null,
    discharge: mapDischarge(patient, includeMoney),
  }

  if (includeCredit) {
    profile.isCreditPatient = Boolean(patient.isCreditPatient)
    profile.admissionPaymentMode = patient.admissionPaymentMode || 'paid'
  }

  const finance = includeMoney
    ? {
        approvedCharges,
        approvedReturns,
        deposits: balance?.depositTotal ?? patient.depositTotal ?? 0,
        remaining: balance?.balance ?? (patient.depositTotal || 0) - (balance?.totalCharges || 0),
        totalCharges: balance?.totalCharges ?? approvedCharges - approvedReturns,
      }
    : null

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      payments: includeMoney,
      credit: includeCredit,
    },
    patient: profile,
    admission: active
      ? {
          status: patient.status,
          admissionDate: patient.admissionDate || null,
          admissionType: profile.admissionType,
          admissionReason: patient.admissionReason || null,
          room: patient.room || null,
          bed: patient.bed || null,
        }
      : null,
    finance,
    credit: includeCredit
      ? {
          isCreditPatient: Boolean(patient.isCreditPatient),
          admissionPaymentMode: patient.admissionPaymentMode || 'paid',
        }
      : null,
    baby: patient.admissionType === 'maternity' ? toFrontendBaby(typeof baby?.toObject === 'function' ? baby : baby) : null,
    doctors: (doctors || []).map((row) => mapDoctor(row, includeMoney)).filter(Boolean),
    records: recordDocs.map((doc) => mapRecord(doc, includeMoney)),
    deposits: includeMoney ? depositDocs.map(toFrontendDeposit) : undefined,
    roomHistory: buildRoomHistory(assignmentDocs),
    roomAssignments: assignmentDocs.map((doc) => mapRoomAssignment(doc, includeMoney)),
  }
}
