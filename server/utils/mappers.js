import { computeCreditState } from './credit.js'
import { resolveSettings, SETTINGS_KEYS } from './settings.js'

const ROOM_IDS = {
  'General Ward': 'ROOM-GW',
  'Private Room': 'ROOM-PR',
  ICU: 'ROOM-ICU',
  Operation: 'ROOM-OP',
  'Delivery Room': 'ROOM-DR',
}

export function toFrontendDischarge(doc) {
  if (!doc) return null
  return {
    requestedBy: doc.dischargeRequestedBy || null,
    requestedAt: doc.dischargeRequestedAt?.toISOString?.() || doc.dischargeRequestedAt || null,
    requestNotes: doc.dischargeRequestNotes || '',
    rejectedBy: doc.dischargeRejectedBy || null,
    rejectedAt: doc.dischargeRejectedAt?.toISOString?.() || doc.dischargeRejectedAt || null,
    rejectionReason: doc.dischargeRejectionReason || '',
    completedBy: doc.dischargeCompletedBy || null,
    completedAt: doc.dischargeCompletedAt?.toISOString?.() || doc.dischargeCompletedAt || null,
    finalCharges: doc.dischargeFinalCharges ?? null,
    finalDeposits: doc.dischargeFinalDeposits ?? null,
    finalBalance: doc.dischargeFinalBalance ?? null,
    finalRoom: doc.room || null,
    finalBed: doc.bed || null,
    events: doc.dischargeEvents || [],
  }
}

export function toFrontendPatient(doc, balance) {
  const disabled = (doc.disabledDoctorVisitDates || []).reduce((m, d) => {
    m[d] = true
    return m
  }, {})
  const status = doc.status
  const credit = computeCreditState({
    admissionPaymentMode: doc.admissionPaymentMode,
    requiredInitialDeposit: doc.requiredInitialDeposit,
    depositTotal: doc.depositTotal,
  })
  return {
    id: doc.patientId,
    name: doc.name,
    age: doc.age,
    gender: doc.gender,
    phone: doc.phone,
    room: doc.room,
    bed: doc.bed,
    admissionDate: doc.admissionDate,
    admissionType: doc.admissionType === 'maternity' ? 'maternity' : 'normal',
    baby: doc.baby || null,
    deposit: doc.depositTotal,
    requiredInitialDeposit: credit.requiredInitialDeposit,
    admissionPaymentMode: doc.admissionPaymentMode || 'paid',
    isCreditPatient: credit.isCreditPatient,
    depositStatus: credit.depositStatus,
    outstandingDeposit: credit.outstandingDeposit,
    creditMarkedBy: doc.creditMarkedBy || null,
    creditMarkedAt: doc.creditMarkedAt?.toISOString?.() || doc.creditMarkedAt || null,
    assignedDoctors: doc.assignedDoctors || [],
    totalCharges: balance?.totalCharges ?? doc.dischargeFinalCharges ?? 0,
    status,
    pendingDischarge: status === 'pending-discharge',
    discharge: toFrontendDischarge(doc),
    disabledDoctorVisits: disabled,
  }
}

export function toFrontendAssignment(doc) {
  return {
    id: doc._id.toString(),
    admission_id: doc.patientId,
    room_id: ROOM_IDS[doc.roomType] || doc.roomType,
    bed_id: `BED-${doc.bedLabel}`,
    start_date: doc.startDate,
    end_date: doc.endDate,
    daily_rate: doc.dailyRate,
    transfer_reason: doc.reason,
    assigned_by: doc.assignedBy,
  }
}

export function toFrontendDeposit(doc) {
  return {
    id: doc._id.toString(),
    date: doc.date,
    amount: doc.amount,
    method: doc.method,
    referenceNumber: doc.referenceNumber || '',
    receivedBy: doc.receivedBy,
    isInitial: doc.isInitial,
    createdAt: doc.createdAt?.toISOString?.() || null,
  }
}

export function buildRoomsFromBeds(beds) {
  const grouped = {}
  for (const b of beds) {
    if (!grouped[b.roomType]) {
      grouped[b.roomType] = {
        id: ROOM_IDS[b.roomType] || b.roomType,
        roomType: b.roomType,
        dailyRate: b.dailyRate,
        beds: [],
      }
    }
    grouped[b.roomType].beds.push({
      id: `BED-${b.label}`,
      label: b.label,
      status: b.status,
      patientId: b.patientId,
    })
  }
  return Object.values(grouped)
}

export function buildRoomHistory(assignments) {
  return [...assignments]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((a) => ({
      room: a.roomType,
      bed: a.bedLabel,
      fromDate: a.startDate,
      toDate: a.endDate,
    }))
}

export function toFrontendRecord(doc, patientName) {
  const type = doc.recordType === 'return' ? 'pharmacy_return' : 'daily_services'
  return {
    id: doc._id.toString(),
    recordName: doc.recordName || patientName || '',
    patientId: doc.patientId,
    subjectType: doc.subjectType === 'baby' ? 'baby' : 'mother',
    babyId: doc.babyId || null,
    recordDate: doc.date,
    type,
    status: doc.status,
    source: doc.source || 'nurse',
    services: (doc.services || []).map((s, i) => ({
      id: s.id || `svc-${doc._id}-${i}`,
      category: s.category,
      serviceName: s.serviceName,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      total: s.total,
      notes: s.notes || '',
      doctorId: s.doctorId || null,
      specialty: s.specialty || null,
    })),
    returnItems: (doc.returnItems || []).map((r, i) => ({
      id: r.id || `ret-${doc._id}-${i}`,
      serviceName: r.serviceName,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      total: r.total,
      reason: r.reason || '',
    })),
    autoGenerated: doc.autoGenerated || false,
    autoType: doc.autoType || null,
    recordedAt: doc.recordedAt?.toISOString?.() || doc.createdAt?.toISOString?.() || new Date().toISOString(),
    recordedBy: doc.submittedBy || 'System',
    reviewedAt: doc.reviewedAt?.toISOString?.() || null,
    reviewedBy: doc.approvedBy || null,
    rejectionReason: doc.rejectionReason || null,
    auditTrail: doc.auditTrail || [],
  }
}

export function toFrontendCategory(doc) {
  return {
    id: doc.slug,
    name: doc.name,
    description: doc.description,
    billingType: doc.billingType,
    services: doc.services || [],
  }
}

export function toFrontendSettings(doc) {
  if (!doc) return {}
  const resolved = resolveSettings(doc)
  const settings = {}
  for (const key of SETTINGS_KEYS) settings[key] = resolved[key] ?? null
  return settings
}
