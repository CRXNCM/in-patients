export const SERVICE_RECEIPT_DISCLAIMER =
  'This document records service requests submitted during the selected patient admission. It is not a bill, a receipt of payment, or proof that the requested services were supplied.'

const MONEY_KEY = /price|amount|subtotal|vat|payment|balance|deposit|billed|billing|total/i

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function originalItemsFromLines(lines = []) {
  return lines.map((line) => ({
    category: line.category || '',
    name: line.serviceName || line.name || '',
    quantity: line.quantity ?? line.requestedQuantity ?? null,
    unit: line.unit || '',
    instructions: String(line.notes || line.instructions || line.note || '').slice(0, 400),
  }))
}

export function itemsFromSavedResponse(response) {
  if (!response) return []
  const items = []
  for (const item of response.pharmacyOrder?.items || []) {
    items.push({
      category: 'Pharmacy',
      name: item.name || '',
      quantity: item.requestedQuantity ?? null,
      unit: item.unit || '',
      instructions: item.instructions || '',
    })
  }
  for (const item of response.laboratoryOrder?.items || []) {
    items.push({
      category: 'Laboratory',
      name: item.name || '',
      quantity: item.quantity ?? null,
      unit: item.unit || '',
      instructions: item.note || '',
    })
  }
  for (const line of response.record?.services || []) {
    items.push({
      category: line.category || '',
      name: line.serviceName || '',
      quantity: line.quantity ?? null,
      unit: line.unit || '',
      instructions: line.notes || '',
    })
  }
  return items
}

export function summarizeItems(items = []) {
  const names = items.map((item) => item.name).filter(Boolean)
  if (!names.length) return 'No stored items'
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
}

export function itemCategories(items = []) {
  return [...new Set(items.map((item) => item.category).filter(Boolean))]
}

function statusWord(status) {
  return String(status || 'recorded').replaceAll('_', ' ')
}

export function describeWorkflow({ pharmacy, laboratory, record }) {
  const parts = []
  if (pharmacy) parts.push(`Pharmacy ${statusWord(pharmacy.status)}`)
  if (laboratory) parts.push(`Laboratory ${statusWord(laboratory.status)}`)
  if (record) parts.push(`Other services ${statusWord(record.status)}`)
  return parts.join(' · ') || 'Recorded'
}

function atValue(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function event(at, actor, action, detail, reason = '') {
  if (!at && !actor && !detail) return null
  return {
    at: atValue(at),
    actor: actor || 'Unavailable',
    action: action || 'recorded',
    detail: detail || '',
    reason: reason || '',
  }
}

export function buildAuditEvents({ submission, pharmacy, laboratory, record }) {
  const events = []
  if (submission) {
    events.push(event(
      submission.submittedAt || submission.createdAt,
      submission.submittedByName || submission.response?.pharmacyOrder?.requestedByName || submission.response?.laboratoryOrder?.requestedByName || submission.response?.record?.recordedBy,
      'submitted',
      'Service request recorded from the nurse account.',
    ))
  }
  for (const entry of pharmacy?.history || []) {
    events.push(event(entry.at, entry.by, entry.action, entry.note || '', entry.reasonNote || ''))
  }
  for (const entry of laboratory?.history || []) {
    events.push(event(entry.at, entry.by, entry.action, entry.note || ''))
  }
  for (const entry of record?.auditTrail || []) {
    events.push(event(entry.at, entry.by, entry.action, entry.note || ''))
  }
  return events.filter(Boolean).sort((a, b) => String(a.at).localeCompare(String(b.at)))
}

export function moneyKeys(value, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => moneyKeys(item, found))
    return found
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (MONEY_KEY.test(key)) found.push(key)
      moneyKeys(child, found)
    }
  }
  return found
}

function requestEntry({ id, items, submittedBy, staffAccount, submittedAt, status, evidence, audit }) {
  return {
    id,
    summary: summarizeItems(items),
    categories: itemCategories(items),
    submittedBy: submittedBy || 'Unavailable',
    staffAccount: staffAccount || '',
    submittedAt: atValue(submittedAt),
    status: status || 'Recorded',
    count: items.length,
    items,
    evidence,
    evidenceNote: evidenceNote(evidence),
    audit: (audit || []).map((entry) => ({ ...entry, requestId: id })),
  }
}

export function assembleRequests({ submissions = [], records = [], pharmacyOrders = [], laboratoryOrders = [] }) {
  const coveredSubmissions = new Set()
  const coveredRecords = new Set()
  const requests = []

  for (const submission of submissions) {
    const saved = submission.status === 'saved' || submission.originalItems?.length || submission.response
    if (!saved || submission.status === 'processing') continue
    coveredSubmissions.add(submission.submissionId)
    const recordId = submission.response?.record?.id
    if (recordId) coveredRecords.add(String(recordId))
    const pharmacy = pharmacyOrders.find((order) => order.submissionId === submission.submissionId) || null
    const laboratory = laboratoryOrders.find((order) => order.submissionId === submission.submissionId) || null
    const record = records.find((row) => String(row.id || row._id) === String(recordId)) || null
    const items = submission.originalItems?.length
      ? submission.originalItems
      : itemsFromSavedResponse(submission.response)
    const evidence = submission.originalItems?.length ? 'snapshot' : items.length ? 'saved-response' : 'unavailable'
    requests.push(requestEntry({
      id: submission.submissionId,
      items,
      submittedBy: submission.submittedByName || pharmacy?.requestedByName || laboratory?.requestedByName || record?.submittedBy || record?.recordedBy,
      staffAccount: submission.staffAccount || '',
      submittedAt: submission.submittedAt || submission.createdAt,
      status: describeWorkflow({ pharmacy, laboratory, record }),
      evidence,
      audit: buildAuditEvents({ submission, pharmacy, laboratory, record }),
    }))
  }

  const orphanIds = new Set()
  for (const order of [...pharmacyOrders, ...laboratoryOrders]) {
    if (!coveredSubmissions.has(order.submissionId)) orphanIds.add(order.submissionId)
  }
  for (const submissionId of orphanIds) {
    const pharmacy = pharmacyOrders.find((order) => order.submissionId === submissionId) || null
    const laboratory = laboratoryOrders.find((order) => order.submissionId === submissionId) || null
    const items = [
      ...(pharmacy?.items || []).map((item) => ({
        category: 'Pharmacy',
        name: item.name,
        quantity: item.requestedQuantity,
        unit: item.unit || '',
        instructions: item.instructions || '',
      })),
      ...(laboratory?.items || []).map((item) => ({
        category: 'Laboratory',
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || '',
        instructions: item.note || '',
      })),
    ]
    const source = pharmacy || laboratory
    requests.push(requestEntry({
      id: submissionId,
      items,
      submittedBy: source?.requestedByName,
      staffAccount: '',
      submittedAt: source?.requestedAt || source?.createdAt,
      status: describeWorkflow({ pharmacy, laboratory, record: null }),
      evidence: 'stored-lines',
      audit: buildAuditEvents({ pharmacy, laboratory }),
    }))
  }

  for (const record of records) {
    const id = String(record.id || record._id || '')
    if (!id || coveredRecords.has(id)) continue
    if (record.autoGenerated || record.recordType === 'return') continue
    if (record.workflowKind === 'pharmacy' || record.workflowKind === 'laboratory' || record.billingKey) continue
    const items = originalItemsFromLines(record.services || [])
    const requestId = `record-${id}`
    requests.push(requestEntry({
      id: requestId,
      items,
      submittedBy: record.submittedBy || record.recordedBy,
      staffAccount: '',
      submittedAt: record.recordedAt || record.createdAt,
      status: describeWorkflow({ pharmacy: null, laboratory: null, record }),
      evidence: 'stored-lines',
      audit: buildAuditEvents({ record }),
    }))
  }

  return requests.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
}

export function collectRequests(sources) {
  return assembleRequests(sources).map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    categories: entry.categories,
    submittedBy: entry.submittedBy,
    submittedAt: entry.submittedAt,
    status: entry.status,
    count: entry.count,
    evidence: entry.evidence,
  }))
}

function numberedItems(items = []) {
  return items.map((item, index) => ({
    number: index + 1,
    category: item.category || '',
    name: item.name || '',
    quantity: item.quantity ?? null,
    unit: item.unit || '',
    instructions: item.instructions || '',
  }))
}

export function buildConsolidatedReceipt({ hospitalName, patient, admission, requests = [], generatedAt }) {
  const sections = [...requests]
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
    .map((entry) => ({
      requestId: entry.id,
      submittedAt: atValue(entry.submittedAt),
      submittedBy: entry.submittedBy || '',
      staffAccount: entry.staffAccount || '',
      status: entry.status || 'Recorded',
      evidence: entry.evidence || 'unavailable',
      evidenceNote: entry.evidenceNote || evidenceNote(entry.evidence),
      items: numberedItems(entry.items),
      audit: entry.audit || [],
    }))
  return {
    hospitalName: hospitalName || 'Central City Hospital',
    title: 'SERVICE REQUEST RECEIPT',
    label: 'NON-FINANCIAL DOCUMENT',
    disclaimer: SERVICE_RECEIPT_DISCLAIMER,
    generatedAt: atValue(generatedAt),
    patient: {
      name: patient?.name || '',
      patientId: patient?.patientId || '',
    },
    admission: {
      id: admission?.id || '',
      admissionNumber: admission?.admissionNumber || '',
      admissionDate: admission?.admissionDate || '',
      ward: admission?.ward || '',
      room: admission?.room || '',
      bed: admission?.bed || '',
      status: admission?.status || '',
    },
    requests: sections,
    available: sections.length > 0,
  }
}

function evidenceNote(evidence) {
  if (evidence === 'snapshot') return 'These lines are the original items stored when the request was submitted.'
  if (evidence === 'saved-response') return 'These lines are the items saved with the original submission.'
  if (evidence === 'stored-lines') return 'An original submission snapshot was not stored for this request. The lines shown are the items currently stored, so an earlier edit may have changed them.'
  return 'The original requested items were not stored for this request.'
}
