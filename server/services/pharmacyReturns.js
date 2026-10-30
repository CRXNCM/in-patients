import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Patient } from '../models/Patient.js'
import { todayStr } from '../utils/dates.js'
import { overallStatus } from '../../frontend/src/services/pharmacyFulfillment.js'

function plainPharmacyOrder(doc) {
  if (!doc) return null
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc
  return {
    id: String(doc._id || obj.id || ''),
    updatedAt: doc.updatedAt?.toISOString?.() || obj.updatedAt || null,
    submissionId: obj.submissionId,
    patientId: obj.patientId,
    patientName: obj.patientName || '',
    admissionId: obj.admissionId || '',
    admissionNumber: obj.admissionNumber || obj.patientId,
    ward: obj.ward || '',
    room: obj.room || '',
    bed: obj.bed || '',
    requestedById: obj.requestedById || '',
    requestedByName: obj.requestedByName || '',
    requestedAt: obj.requestedAt,
    status: overallStatus(obj.items || []),
    items: obj.items || [],
    returns: obj.returns || [],
    history: obj.history || [],
  }
}

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

function plainEntry(entry) {
  return typeof entry.toObject === 'function' ? entry.toObject() : { ...entry }
}

export async function attachReturnBilling(doc, returnId, actorName) {
  if (!doc) return { error: 'Request not found.', status: 404 }
  const returns = (doc.returns || []).map(plainEntry)
  const index = returns.findIndex((entry) => entry.id === returnId)
  if (index < 0) return { order: plainPharmacyOrder(doc) }
  const entry = returns[index]
  if ((Number(entry.acceptedQuantity) || 0) <= 0 || entry.billingRecordId) {
    return { order: plainPharmacyOrder(doc) }
  }

  const item = (doc.items || []).map(plainEntry).find((line) => line.lineId === entry.lineId)
  const price = Number(item?.unitPrice)
  const at = new Date().toISOString()
  if (!item || !Number.isFinite(price) || price < 0) {
    returns[index] = {
      ...entry,
      billingStatus: 'not_eligible',
      billingNote: 'The stored handover has no price, so an adjustment was not created.',
    }
    doc.returns = returns
    doc.markModified('returns')
    await doc.save()
    return { order: plainPharmacyOrder(doc) }
  }

  const patient = await Patient.findOne({ patientId: doc.patientId })
  if (!patient || patient.status === 'discharged') {
    returns[index] = {
      ...entry,
      billingStatus: 'not_eligible',
      billingNote: 'This admission is discharged. A new billing adjustment cannot be posted. The verified return is kept.',
    }
    doc.returns = returns
    doc.markModified('returns')
    await doc.save()
    return { order: plainPharmacyOrder(doc) }
  }

  const quantity = Number(entry.acceptedQuantity)
  const total = Math.round(quantity * price * 100) / 100
  const billingKey = `pharmacy-return:${doc._id}:${entry.id}`
  let record
  try {
    record = await ServiceRecord.create({
      patientId: doc.patientId,
      recordName: doc.patientName || patient.name,
      date: todayStr(),
      status: 'pending',
      recordRole: 'billing',
      recordType: 'return',
      source: 'system',
      workflowKind: 'pharmacy-return',
      workflowOrderId: String(doc._id),
      workflowLineId: entry.lineId,
      billingKey,
      returnItems: [{
        id: entry.id,
        catalogItemId: item.catalogItemId || '',
        serviceName: item.name,
        quantity,
        unitPrice: price,
        baseUnitPrice: item.baseUnitPrice ?? price,
        priceMultiplier: item.priceMultiplier ?? 1,
        unit: item.unit || '',
        total,
        reason: entry.reason || '',
      }],
      services: [],
      submittedBy: actorName,
      recordedAt: new Date(),
      auditTrail: [audit('recorded', actorName, `Pharmacy verified ${quantity} of ${item.name} for reception review. This does not change the original handover or payment.`)],
    })
  } catch (err) {
    if (err?.code !== 11000) throw err
    record = await ServiceRecord.findOne({ billingKey })
    if (!record) throw err
  }

  const billingStatus = record.status === 'approved' ? 'approved' : record.status === 'rejected' ? 'rejected' : 'pending_reception'
  const sent = {
    action: 'sent_to_reception',
    by: actorName,
    at,
    lineId: entry.lineId,
    quantity,
    note: `Accepted ${quantity} sent for reception review.`,
    clientActionId: `billing:${entry.id}`,
  }
  returns[index] = {
    ...entry,
    billingStatus,
    billingRecordId: String(record._id),
    billingNote: '',
    history: [...(entry.history || []), sent],
  }
  doc.returns = returns
  doc.history = [...(doc.history || []).map(plainEntry), sent]
  doc.markModified('returns')
  doc.markModified('history')
  await doc.save()
  return { order: plainPharmacyOrder(doc) }
}

export async function syncPharmacyReturnDecision(record, decision, actorName, note) {
  if (!record || record.workflowKind !== 'pharmacy-return' || !record.workflowOrderId) return
  const order = await PharmacyOrder.findById(record.workflowOrderId)
  if (!order) return
  const recordId = String(record._id)
  const at = new Date().toISOString()
  let changed = false
  order.returns = (order.returns || []).map((entry) => {
    const plain = plainEntry(entry)
    if (plain.billingRecordId !== recordId) return plain
    if (plain.billingStatus === decision) return plain
    changed = true
    const event = {
      action: decision === 'approved' ? 'adjustment_approved' : 'adjustment_rejected',
      by: actorName,
      at,
      lineId: plain.lineId,
      quantity: plain.acceptedQuantity,
      note: note || '',
      clientActionId: `reception:${recordId}:${decision}`,
    }
    return {
      ...plain,
      physicalStatus: 'completed',
      billingStatus: decision === 'approved' ? 'approved' : 'rejected',
      receptionBy: actorName,
      receptionAt: at,
      receptionNote: note || '',
      history: [...(plain.history || []), event],
    }
  })
  if (!changed) return
  order.history = [...(order.history || []).map(plainEntry), {
    action: decision === 'approved' ? 'adjustment_approved' : 'adjustment_rejected',
    by: actorName,
    at,
    note: note || '',
    clientActionId: `reception:${recordId}:${decision}`,
  }]
  order.markModified('returns')
  order.markModified('history')
  await order.save()
}
