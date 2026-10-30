import { ServiceRecord } from '../models/ServiceRecord.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { WardSubmission } from '../models/WardSubmission.js'
import { Patient } from '../models/Patient.js'
import { categoryNeedsDepartment, markReceptionDecision } from './departmentBilling.js'

function docId(doc) {
  return String(doc?.id || doc?._id || '')
}

function money(quantity, unitPrice) {
  return Math.round(Number(quantity) * Number(unitPrice) * 100) / 100
}

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

export function parentReceptionStatus(items = []) {
  const awaiting = items.filter((item) => item.eligibility === 'awaiting_department').length
  const pending = items.filter((item) => item.eligibility === 'eligible' && item.receptionCode === 'pending').length
  const charged = items.filter((item) => item.receptionCode === 'approved').length
  const rejected = items.filter((item) => item.receptionCode === 'rejected').length
  if (pending === 0 && charged === 0 && rejected === 0) return awaiting > 0 ? 'awaiting_department' : 'completed'
  if (pending > 0 && charged === 0 && rejected === 0) return 'pending'
  if (charged > 0 && (pending > 0 || awaiting > 0)) return 'partly_charged'
  if (charged === 0 && rejected > 0 && (pending > 0 || awaiting > 0)) return 'partly_decided'
  if (pending === 0 && awaiting === 0 && charged > 0) return 'completed'
  if (pending === 0 && awaiting === 0 && charged === 0 && rejected > 0) return 'rejected'
  return 'partly_decided'
}

export function requestInQueue(items = []) {
  const pending = items.some((item) => item.eligibility === 'eligible' && item.receptionCode === 'pending')
  const stillWithDepartment = items.some((item) => item.eligibility === 'awaiting_department')
  const receptionStarted = items.some((item) => item.receptionCode === 'approved' || item.receptionCode === 'rejected')
  return pending || (stillWithDepartment && receptionStarted)
}

function receptionCodeFor(record, eligibility) {
  if (record?.status === 'approved') return 'approved'
  if (record?.status === 'rejected') return 'rejected'
  if (eligibility === 'eligible') return 'pending'
  return 'ineligible'
}

function priceFields(eligibility, receptionCode, quantity, unitPrice) {
  if (eligibility !== 'eligible' && receptionCode !== 'approved' && receptionCode !== 'rejected') {
    return { unitPrice: null, total: null }
  }
  const price = Number(unitPrice) || 0
  return { unitPrice: price, total: money(quantity, price) }
}

function pharmacyDecision(item, released) {
  if (item.status === 'not_supplied') return 'Not supplied'
  if (released) return 'Released'
  return 'Pending'
}

function laboratoryDecision(status) {
  if (status === 'rejected') return 'Rejected'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'approved' || status === 'processing' || status === 'completed') return 'Approved'
  return 'Pending'
}

function receptionLabel(code) {
  if (code === 'approved') return 'Charged / approved'
  if (code === 'rejected') return 'Rejected'
  if (code === 'pending') return 'Pending reception approval'
  return 'Not yet eligible'
}

function billingFor(records, { orderId, lineId, kind }) {
  return records.find((record) => (
    record.workflowKind === kind
    && String(record.workflowOrderId) === String(orderId)
    && record.workflowLineId === lineId
  )) || null
}

function itemFromBilling(record, department) {
  const line = record.services?.[0] || {}
  const eligibility = record.departmentCleared || !categoryNeedsDepartment(line.category) ? 'eligible' : 'awaiting_department'
  const receptionCode = receptionCodeFor(record, eligibility === 'eligible' ? 'eligible' : 'awaiting_department')
  const quantity = line.quantity ?? null
  return {
    key: docId(record),
    itemId: record.workflowLineId || line.id || docId(record),
    lineId: line.id || record.workflowLineId || '',
    department,
    description: line.serviceName || record.recordName || 'Service',
    quantity,
    unit: line.unit || '',
    ...priceFields(eligibility, receptionCode, quantity, line.unitPrice),
    departmentDecision: record.departmentCleared ? 'Released' : 'Submitted',
    receptionCode,
    receptionDecision: receptionLabel(receptionCode),
    eligibility: receptionCode === 'approved' || receptionCode === 'rejected' ? 'eligible' : eligibility,
    billingRecordId: docId(record),
    sourceRecordId: docId(record),
    approveMode: record.status === 'pending' && eligibility === 'eligible' ? 'record' : 'none',
    departmentAt: record.departmentClearedAt || null,
    receptionAt: record.reviewedAt || null,
    decidedBy: record.approvedBy || '',
  }
}

function orderItem(order, item, kind, records) {
  const billing = billingFor(records, { orderId: docId(order), lineId: item.lineId, kind })
  const closed = kind === 'pharmacy'
    ? item.status === 'not_supplied'
    : item.status === 'rejected' || item.status === 'cancelled'
  const released = kind === 'pharmacy'
    ? !closed && ((Number(item.suppliedQuantity) || 0) > 0 || Boolean(billing))
    : !closed && ['approved', 'processing', 'completed'].includes(item.status)
  const eligibility = closed ? 'closed' : released ? 'eligible' : 'awaiting_department'
  const receptionCode = receptionCodeFor(billing, eligibility)
  const quantity = kind === 'pharmacy' ? item.requestedQuantity : item.quantity
  const unitPrice = billing?.services?.[0]?.unitPrice ?? item.unitPrice
  const department = kind === 'pharmacy' ? 'Pharmacy' : 'Laboratory'
  return {
    key: `${docId(order)}:${item.lineId}`,
    itemId: item.lineId,
    lineId: item.lineId,
    department,
    description: item.name || 'Item',
    quantity: quantity ?? null,
    unit: item.unit || '',
    ...priceFields(eligibility, receptionCode, billing?.services?.[0]?.quantity ?? quantity, unitPrice),
    departmentDecision: kind === 'pharmacy' ? pharmacyDecision(item, released) : laboratoryDecision(item.status),
    receptionCode,
    receptionDecision: receptionLabel(receptionCode),
    eligibility,
    billingRecordId: billing ? docId(billing) : '',
    sourceRecordId: billing ? docId(billing) : '',
    approveMode: billing && billing.status === 'pending' && eligibility === 'eligible' ? 'record' : 'none',
    departmentAt: billing?.departmentClearedAt || null,
    receptionAt: billing?.reviewedAt || null,
    decidedBy: billing?.approvedBy || '',
  }
}

function otherItems(record) {
  const lines = record.services || []
  const single = lines.length === 1
  return lines.map((line, index) => {
    const blocked = categoryNeedsDepartment(line.category) && !record.departmentCleared
    const eligibility = blocked ? 'awaiting_department' : 'eligible'
    const receptionCode = record.status === 'approved'
      ? 'approved'
      : record.status === 'rejected'
        ? 'rejected'
        : receptionCodeFor(null, eligibility)
    const lineId = line.id || `line-${index}`
    return {
      key: `${docId(record)}:${lineId}`,
      itemId: lineId,
      lineId,
      department: line.category || 'Other',
      description: line.serviceName || 'Service',
      quantity: line.quantity ?? null,
      unit: line.unit || '',
      ...priceFields(eligibility, receptionCode, line.quantity, line.unitPrice),
      departmentDecision: blocked ? 'Pending' : 'Not required',
      receptionCode,
      receptionDecision: receptionLabel(receptionCode),
      eligibility,
      billingRecordId: single && !blocked ? docId(record) : '',
      sourceRecordId: docId(record),
      approveMode: record.status !== 'pending' || blocked ? 'none' : single ? 'record' : 'line',
      departmentAt: null,
      receptionAt: record.reviewedAt || null,
      decidedBy: record.approvedBy || '',
    }
  })
}

function parentKey(record, orderById, submissionById) {
  const id = docId(record)
  if (record.recordType === 'return' || record.autoGenerated) return `record:${id}`
  if (record.submissionId) {
    const submission = submissionById.get(record.submissionId)
    if (submission && submission.patientId !== record.patientId) return `record:${id}`
    return `${record.patientId}:${record.submissionId}`
  }
  const order = orderById.get(String(record.workflowOrderId || ''))
  if (order?.submissionId && order.patientId === record.patientId) return `${record.patientId}:${order.submissionId}`
  return `record:${id}`
}

function summarize(requestId, ownerId, items, meta) {
  const eligibleCount = items.filter((item) => item.eligibility === 'eligible').length
  const pendingItems = items.filter((item) => item.eligibility === 'eligible' && item.receptionCode === 'pending')
  const pendingAmount = pendingItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const actionable = pendingItems.filter((item) => item.approveMode === 'record' && item.billingRecordId)
  const singleAction = items.length === 1 && actionable.length === 1 ? actionable[0].billingRecordId : ''
  return {
    id: requestId,
    patientId: ownerId,
    patientName: meta.patientName || '',
    admissionId: meta.admissionId || '',
    admissionType: meta.admissionType || '',
    convertedFromEmergency: Boolean(meta.convertedFromEmergency),
    submittedAt: meta.submittedAt || '',
    submittedBy: meta.submittedBy || '',
    eligibleCount,
    totalItems: items.length,
    status: parentReceptionStatus(items),
    inQueue: requestInQueue(items),
    pendingAmount,
    actionRecordId: singleAction,
    wholeRecord: Boolean(meta.wholeRecord),
    items,
  }
}

export function buildReceptionRequests({
  submissions = [],
  records = [],
  pharmacyOrders = [],
  laboratoryOrders = [],
  patients = [],
} = {}) {
  const submissionById = new Map(submissions.map((row) => [row.submissionId, row]))
  const patientByCode = new Map(patients.map((row) => [row.patientId, row]))
  const orderById = new Map()
  for (const order of [...pharmacyOrders, ...laboratoryOrders]) orderById.set(docId(order), order)

  const groups = new Map()
  function bucket(key) {
    if (!groups.has(key)) groups.set(key, { records: [], pharmacy: [], laboratory: [], submission: null })
    return groups.get(key)
  }

  for (const submission of submissions) {
    if (!submission?.submissionId || submission.status === 'processing') continue
    bucket(`${submission.patientId}:${submission.submissionId}`).submission = submission
  }
  for (const order of pharmacyOrders) {
    if (!order?.submissionId) continue
    bucket(`${order.patientId}:${order.submissionId}`).pharmacy.push(order)
  }
  for (const order of laboratoryOrders) {
    if (!order?.submissionId) continue
    bucket(`${order.patientId}:${order.submissionId}`).laboratory.push(order)
  }
  for (const record of records) {
    bucket(parentKey(record, orderById, submissionById)).records.push(record)
  }

  const requests = []
  for (const [key, group] of groups) {
    const submission = group.submission
    const ownerId = submission?.patientId || group.pharmacy[0]?.patientId || group.laboratory[0]?.patientId || group.records[0]?.patientId || ''
    const requestId = key.startsWith('record:') ? key.slice('record:'.length) : key.slice(ownerId.length + 1)
    const recordsHere = group.records.filter((record) => record.patientId === ownerId)
    const pharmacy = group.pharmacy.filter((order) => order.patientId === ownerId)
    const laboratory = group.laboratory.filter((order) => order.patientId === ownerId)
    const patient = patientByCode.get(ownerId)
    const used = new Set()
    const items = []

    for (const order of pharmacy) {
      for (const item of order.items || []) {
        const row = orderItem(order, item, 'pharmacy', recordsHere)
        if (row.billingRecordId) used.add(row.billingRecordId)
        items.push(row)
      }
    }
    for (const order of laboratory) {
      for (const item of order.items || []) {
        const row = orderItem(order, item, 'laboratory', recordsHere)
        if (row.billingRecordId) used.add(row.billingRecordId)
        items.push(row)
      }
    }

    for (const record of recordsHere) {
      if (used.has(docId(record))) continue
      if (record.workflowLineId || String(record.billingKey || '').startsWith('pharmacy:') || String(record.billingKey || '').startsWith('laboratory:')) {
        items.push(itemFromBilling(record, record.workflowKind === 'laboratory' ? 'Laboratory' : 'Pharmacy'))
        continue
      }
      if (String(record.billingKey || '').startsWith('reception:')) {
        items.push(...otherItems(record).map((item) => ({ ...item, approveMode: 'none' })))
        continue
      }
      if (record.recordType === 'return') {
        const row = itemFromBilling({
          ...record,
          services: (record.returnItems || []).map((line) => ({
            ...line,
            serviceName: line.serviceName,
            category: 'Return',
          })),
        }, 'Return')
        row.description = (record.returnItems || []).map((line) => line.serviceName).filter(Boolean).join(', ') || 'Pharmacy return'
        row.quantity = (record.returnItems || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
        row.total = -Math.abs((record.returnItems || []).reduce((sum, line) => sum + (Number(line.total) || 0), 0))
        row.departmentDecision = 'Return'
        row.approveMode = record.status === 'pending' ? 'record' : 'none'
        row.billingRecordId = docId(record)
        items.push(row)
        continue
      }
      items.push(...otherItems(record))
    }

    if (!items.length) continue
    const order = pharmacy[0] || laboratory[0]
    requests.push(summarize(requestId, ownerId, items, {
      patientName: patient?.name || order?.patientName || recordsHere[0]?.recordName || '',
      admissionId: order?.admissionId || (patient?._id ? String(patient._id) : ''),
      admissionType: patient?.admissionType || order?.admissionType || '',
      convertedFromEmergency: Boolean(patient?.convertedFromEmergency || order?.convertedFromEmergency),
      submittedAt: submission?.submittedAt || submission?.createdAt || order?.requestedAt || recordsHere[0]?.recordedAt || recordsHere[0]?.createdAt || '',
      submittedBy: submission?.submittedByName || order?.requestedByName || recordsHere[0]?.submittedBy || '',
      wholeRecord: recordsHere.some((record) => record.recordType === 'return'),
    }))
  }

  return requests.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
}

export async function loadReceptionQueue({ patientId = '' } = {}) {
  const pendingFilter = { status: 'pending' }
  if (patientId) pendingFilter.patientId = patientId
  const pending = await ServiceRecord.find(pendingFilter).lean()
  const submissionIds = new Set(pending.map((record) => record.submissionId).filter(Boolean))
  const orderIds = pending.map((record) => record.workflowOrderId).filter(Boolean)
  const [linkedPharmacy, linkedLaboratory] = await Promise.all([
    orderIds.length ? PharmacyOrder.find({ _id: { $in: orderIds } }).lean() : [],
    orderIds.length ? LaboratoryOrder.find({ _id: { $in: orderIds } }).lean() : [],
  ])
  for (const order of [...linkedPharmacy, ...linkedLaboratory]) {
    if (order.submissionId) submissionIds.add(order.submissionId)
  }
  const ids = [...submissionIds]
  const patientFilter = patientId ? { patientId } : {}
  const [submissions, pharmacyOrders, laboratoryOrders, relatedRecords] = ids.length
    ? await Promise.all([
      WardSubmission.find({ submissionId: { $in: ids }, ...patientFilter }).lean(),
      PharmacyOrder.find({ submissionId: { $in: ids }, ...patientFilter }).lean(),
      LaboratoryOrder.find({ submissionId: { $in: ids }, ...patientFilter }).lean(),
      ServiceRecord.find({ submissionId: { $in: ids }, ...patientFilter }).lean(),
    ])
    : [[], [], [], []]
  const byId = new Map()
  for (const record of [...pending, ...relatedRecords]) byId.set(docId(record), record)
  const patientIds = [...new Set([...byId.values()].map((record) => record.patientId).filter(Boolean))]
  for (const order of [...pharmacyOrders, ...laboratoryOrders]) {
    if (order.patientId) patientIds.push(order.patientId)
  }
  const patients = patientIds.length
    ? await Patient.find({ patientId: { $in: [...new Set(patientIds)] } }).select('patientId name admissionType convertedFromEmergency').lean()
    : []
  return buildReceptionRequests({
    submissions,
    records: [...byId.values()],
    pharmacyOrders: [...pharmacyOrders, ...linkedPharmacy.filter((order) => !ids.includes(order.submissionId))],
    laboratoryOrders: [...laboratoryOrders, ...linkedLaboratory.filter((order) => !ids.includes(order.submissionId))],
    patients,
  }).filter((request) => request.inQueue)
}

export function panelRow(request) {
  return {
    id: request.actionRecordId || request.id,
    requestId: request.id,
    patientId: request.patientId,
    patientName: request.patientName,
    recordName: request.patientName,
    type: request.wholeRecord ? 'pharmacy_return' : 'daily_services',
    status: request.status,
    recordedBy: request.submittedBy,
    recordedAt: request.submittedAt,
    itemCount: request.totalItems,
    eligibleCount: request.eligibleCount,
    amount: request.pendingAmount,
    reviewOnly: !request.actionRecordId,
  }
}

function lineOn(record, lineId) {
  return (record.services || []).find((line, index) => (line.id || `line-${index}`) === lineId) || null
}

export async function decideRecordItem({ record, lineId, actorName, decision, note }) {
  if (!record) return { error: 'Record not found.', status: 404 }
  if (record.recordType === 'return') return { error: 'Approve or reject the pharmacy return as one credit.', status: 400 }
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Decision is not recognized.', status: 400 }
  const billingKey = `reception:${record._id}:${lineId}`
  const existing = await ServiceRecord.findOne({ billingKey })
  if (existing) {
    if (existing.status === 'approved' || existing.status === 'rejected') {
      return { record: existing, duplicate: true }
    }
  }
  if (record.status !== 'pending') return { error: 'Record is not pending.', status: 400 }
  const line = lineOn(record, lineId)
  if (!line) return { error: 'Item not found on this request.', status: 404 }
  if (categoryNeedsDepartment(line.category) && !record.departmentCleared) {
    return { error: 'This item is not eligible until its department releases it.', status: 400 }
  }
  const now = new Date()
  let saved = existing
  if (!saved) {
    try {
      saved = await ServiceRecord.create({
        patientId: record.patientId,
        subjectType: record.subjectType,
        babyId: record.babyId,
        recordName: record.recordName,
        date: record.date,
        status: 'pending',
        submissionId: record.submissionId || '',
        recordType: 'daily',
        source: record.source || 'nurse',
        services: [line],
        submittedBy: record.submittedBy || actorName,
        recordedAt: record.recordedAt || now,
        billingKey,
        auditTrail: [audit('recorded', record.submittedBy || actorName, 'Charged separately from the original request so the other items stay unchanged.')],
      })
    } catch (err) {
      if (err?.code !== 11000) throw err
      saved = await ServiceRecord.findOne({ billingKey })
      if (!saved) throw err
      if (saved.status === 'approved' || saved.status === 'rejected') return { record: saved, duplicate: true }
    }
  }
  if (saved.status === 'pending') {
    saved.status = decision
    saved.approvedBy = actorName
    saved.reviewedAt = now
    if (decision === 'rejected') saved.rejectionReason = note
    saved.auditTrail = [...(saved.auditTrail || []), audit(decision, actorName, note)]
    await saved.save()
    await markReceptionDecision(saved, decision)
  }
  const remaining = (record.services || []).filter((entry, index) => (entry.id || `line-${index}`) !== lineId)
  record.services = remaining
  record.auditTrail = [
    ...(record.auditTrail || []),
    audit('edited', actorName, `${line.serviceName || 'Item'} was ${decision} on its own. The other items were left unchanged.`),
  ]
  if (!remaining.length) {
    record.status = 'logged'
    record.recordRole = 'source'
  }
  record.markModified('services')
  record.markModified('auditTrail')
  await record.save()
  return { record: saved, duplicate: false }
}
