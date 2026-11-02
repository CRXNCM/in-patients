import { ServiceRecord } from '../models/ServiceRecord.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { isEmergencyOpdAdmission } from '../utils/admissions.js'
import { departmentReleaseNote } from '../utils/stayScope.js'

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

function money(quantity, unitPrice) {
  return Math.round(Number(quantity) * Number(unitPrice) * 100) / 100
}

function receptionStatusFor(record) {
  if (!record) return 'not_sent'
  if (record.status === 'approved') return 'approved'
  if (record.status === 'rejected') return 'rejected'
  return 'pending'
}

function chargeLine(line, quantity, price) {
  return {
    ...line,
    quantity,
    unitPrice: price,
    baseUnitPrice: line.baseUnitPrice ?? price,
    priceMultiplier: line.priceMultiplier ?? 1,
    total: money(quantity, price),
  }
}

async function writePendingRelease(existing, { gate, orderId, lineId, eligible, price, line, actorName, note, billingKey, submissionId }) {
  existing.services = [chargeLine(line, eligible, price)]
  existing.departmentGate = gate
  existing.departmentCleared = true
  existing.departmentClearedBy = actorName
  existing.departmentClearedAt = new Date()
  existing.workflowKind = gate
  existing.workflowOrderId = String(orderId)
  existing.workflowLineId = lineId
  existing.billingKey = existing.billingKey || billingKey
  if (!existing.submissionId && submissionId) existing.submissionId = submissionId
  existing.auditTrail = [...(existing.auditTrail || []), audit('edited', actorName, note)]
  await existing.save()
  return { billingRecordId: String(existing._id), billedQuantity: eligible, receptionStatus: 'pending' }
}

export async function releaseDepartmentCharge({
  patientId,
  recordName,
  recordDate,
  subjectType = 'mother',
  babyId = null,
  gate,
  orderId,
  lineId,
  submissionId = '',
  alreadyBilled = 0,
  eligibleQuantity,
  billingRecordId = '',
  line,
  actorName,
  note,
}) {
  const eligible = Number(eligibleQuantity) || 0
  const billed = Number(alreadyBilled) || 0
  if (eligible <= billed) {
    return { billingRecordId: billingRecordId || '', billedQuantity: billed, receptionStatus: billingRecordId ? undefined : 'not_sent' }
  }

  const price = Number(line.unitPrice) || 0
  const billingKey = `${gate}:${orderId}:${lineId}`
  const existing = billingRecordId
    ? await ServiceRecord.findById(billingRecordId)
    : await ServiceRecord.findOne({ billingKey })

  // An approved or rejected release is final. Extra quantity is not given a second charge.
  if (existing && existing.status !== 'pending') {
    return {
      billingRecordId: String(existing._id),
      billedQuantity: billed,
      receptionStatus: receptionStatusFor(existing),
    }
  }
  if (existing) {
    return writePendingRelease(existing, { gate, orderId, lineId, eligible, price, line, actorName, note, billingKey, submissionId })
  }

  try {
    const saved = await ServiceRecord.create({
      patientId,
      subjectType,
      babyId,
      recordName,
      date: recordDate,
      status: 'pending',
      recordRole: 'billing',
      recordType: 'daily',
      source: 'nurse',
      departmentGate: gate,
      departmentCleared: true,
      departmentClearedBy: actorName,
      departmentClearedAt: new Date(),
      workflowKind: gate,
      workflowOrderId: String(orderId),
      workflowLineId: lineId,
      billingKey,
      submissionId: submissionId || '',
      services: [chargeLine(line, eligible, price)],
      submittedBy: actorName,
      recordedAt: new Date(),
      auditTrail: [audit('recorded', actorName, note)],
    })
    return { billingRecordId: String(saved._id), billedQuantity: eligible, receptionStatus: 'pending' }
  } catch (err) {
    if (err?.code !== 11000) throw err
    const raced = await ServiceRecord.findOne({ billingKey })
    if (!raced) throw err
    if (raced.status === 'pending') {
      return writePendingRelease(raced, { gate, orderId, lineId, eligible, price, line, actorName, note, billingKey, submissionId })
    }
    return {
      billingRecordId: String(raced._id),
      billedQuantity: billed,
      receptionStatus: receptionStatusFor(raced),
    }
  }
}

export async function syncPharmacyItemCharge(order, item, actorName, recordDate) {
  const release = await releaseDepartmentCharge({
    patientId: order.patientId,
    recordName: order.patientName,
    recordDate,
    gate: 'pharmacy',
    orderId: order.id,
    lineId: item.lineId,
    submissionId: order.submissionId || '',
    alreadyBilled: item.billedQuantity || 0,
    eligibleQuantity: item.suppliedQuantity || 0,
    billingRecordId: item.billingRecordId || '',
    actorName,
    note: departmentReleaseNote(order, 'pharmacy', `Pharmacy released ${item.suppliedQuantity} of ${item.name}.`),
    line: {
      id: item.lineId,
      catalogItemId: item.catalogItemId || '',
      category: 'Pharmacy',
      serviceName: item.name,
      unitPrice: Number(item.unitPrice) || 0,
      baseUnitPrice: item.baseUnitPrice ?? (Number(item.unitPrice) || 0),
      priceMultiplier: item.priceMultiplier ?? 1,
      unit: item.unit || '',
      notes: [item.instructions, `Department: ${actorName}`].filter(Boolean).join(' · '),
    },
  })
  return {
    ...item,
    billingRecordId: release.billingRecordId || item.billingRecordId || '',
    billedQuantity: release.billedQuantity ?? item.billedQuantity ?? 0,
    receptionStatus: release.receptionStatus || item.receptionStatus || 'not_sent',
  }
}

export async function syncLaboratoryItemCharge(order, item, actorName, recordDate) {
  const release = await releaseDepartmentCharge({
    patientId: order.patientId,
    recordName: order.patientName,
    recordDate,
    gate: 'laboratory',
    orderId: order.id,
    lineId: item.lineId,
    submissionId: order.submissionId || '',
    alreadyBilled: item.receptionStatus === 'not_sent' ? 0 : item.quantity,
    eligibleQuantity: item.quantity,
    billingRecordId: item.billingRecordId || '',
    actorName,
    note: departmentReleaseNote(order, 'laboratory', `Laboratory approved ${item.name}.`),
    line: {
      id: item.lineId,
      catalogItemId: item.catalogItemId || '',
      category: 'Laboratory',
      serviceName: item.name,
      unitPrice: Number(item.unitPrice) || 0,
      baseUnitPrice: item.baseUnitPrice ?? (Number(item.unitPrice) || 0),
      priceMultiplier: item.priceMultiplier ?? 1,
      unit: item.unit || '',
      notes: [item.note, item.priority === 'urgent' ? 'Urgent' : '', `Department: ${actorName}`].filter(Boolean).join(' · '),
    },
  })
  return {
    ...item,
    billingRecordId: release.billingRecordId || '',
    receptionStatus: release.receptionStatus || 'pending',
  }
}

export async function markReceptionDecision(record, status) {
  if (!record?.workflowKind || !record.workflowOrderId || !record.workflowLineId) return
  const Model = record.workflowKind === 'pharmacy' ? PharmacyOrder : LaboratoryOrder
  const order = await Model.findById(record.workflowOrderId)
  if (!order) return
  order.items = (order.items || []).map((item) => {
    const plain = typeof item.toObject === 'function' ? item.toObject() : item
    return plain.lineId === record.workflowLineId ? { ...plain, receptionStatus: status } : plain
  })
  order.markModified('items')
  await order.save()
}

export function categoryNeedsDepartment(category) {
  const raw = String(category || '').trim().toLowerCase()
  return raw === 'pharmacy' || raw === 'laboratory' || raw === 'lab'
}

export function departmentGateForLines(lines = []) {
  const kinds = new Set()
  for (const line of lines) {
    const raw = String(line?.category || '').trim().toLowerCase()
    if (raw === 'pharmacy') kinds.add('pharmacy')
    else if (raw === 'laboratory' || raw === 'lab') kinds.add('laboratory')
  }
  if (kinds.size === 1) return [...kinds][0]
  return ''
}

export function receptionHoldError(record) {
  if (!record || record.recordType === 'return') return null
  if (record.recordRole === 'source' || record.status === 'logged') {
    return 'This is the nurse source record. It is not a charge. Reception approves the departmental release separately.'
  }
  if (record.departmentCleared) return null
  const departmental = (record.services || []).some((line) => categoryNeedsDepartment(line.category))
  if (record.departmentGate || departmental) {
    return isEmergencyOpdAdmission(record.admissionType)
      ? 'Pharmacy and laboratory items return to the Emergency Nurse after the department releases them.'
      : 'Pharmacy and laboratory items stay off the bill until the department releases them and reception approves that release.'
  }
  return null
}

export async function withdrawPendingDepartmentCharge(billingRecordId, actorName, reason) {
  if (!billingRecordId) return false
  const record = await ServiceRecord.findById(billingRecordId)
  if (!record || record.status !== 'pending') return false
  record.status = 'rejected'
  record.rejectionReason = reason
  record.approvedBy = actorName
  record.reviewedAt = new Date()
  record.auditTrail = [...(record.auditTrail || []), audit('rejected', actorName, reason)]
  await record.save()
  return true
}
