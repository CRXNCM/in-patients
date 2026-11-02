function trimText(value) {
  return String(value ?? '').trim()
}

function isReleased(status) {
  return status === 'approved' || status === 'processing' || status === 'completed'
}

export function groupLaboratoryPatients(orders = []) {
  const byId = new Map()
  for (const order of orders) {
    const patientId = String(order?.patientId || '').trim()
    if (!patientId) continue
    const items = Array.isArray(order.items) ? order.items : []
    const pendingTests = items.filter((item) => item.status === 'pending').length
    const releasedTests = items.filter((item) => isReleased(item.status)).length
    const existing = byId.get(patientId)
    const next = existing || {
      id: patientId,
      patientId,
      name: order.patientName || patientId,
      admissionNumber: order.admissionNumber || '',
      admissionType: order.admissionType || '',
      ward: order.ward || '',
      room: order.room || '',
      bed: order.bed || '',
      requestCount: 0,
      testCount: 0,
      pendingTests: 0,
      releasedTests: 0,
      lastRequestedAt: '',
      tests: [],
    }
    next.requestCount += 1
    next.testCount += items.length
    next.pendingTests += pendingTests
    next.releasedTests += releasedTests
    next.tests.push(...items.map((item) => item.name).filter(Boolean))
    if (String(order.requestedAt || '') >= String(next.lastRequestedAt || '')) {
      next.lastRequestedAt = order.requestedAt || next.lastRequestedAt
      next.name = order.patientName || next.name
      next.admissionNumber = order.admissionNumber || next.admissionNumber
      next.admissionType = order.admissionType || next.admissionType
      next.ward = order.ward || next.ward
      next.room = order.room || next.room
      next.bed = order.bed || next.bed
    }
    byId.set(patientId, next)
  }
  return [...byId.values()].sort((a, b) => String(b.lastRequestedAt || '').localeCompare(String(a.lastRequestedAt || '')))
}

export function laboratoryOverallStatus(items = []) {
  if (!items.length) return 'pending'
  const open = items.filter((item) => item.status !== 'cancelled' && item.status !== 'rejected')
  if (!open.length) return items.some((item) => item.status === 'rejected') ? 'rejected' : 'cancelled'
  if (open.every((item) => isReleased(item.status))) return 'approved'
  if (open.some((item) => item.status !== 'pending')) return 'partially_decided'
  return 'pending'
}

export function buildLaboratoryOrder({ submissionId, stay, actor, lines, at }) {
  if (!trimText(submissionId)) return { error: 'Submission id is required.' }
  if (!lines?.length) return { error: 'Add at least one laboratory test.' }
  const items = []
  for (const line of lines) {
    const name = trimText(line.serviceName || line.name)
    const qty = Number(line.quantity)
    if (!name) return { error: 'Laboratory test name is missing.' }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { error: `${name || 'Test'}: enter a whole quantity from 1 to 99.` }
    }
    const lineId = trimText(line.id || line.lineId) || `line-${items.length + 1}`
    if (items.some((item) => item.lineId === lineId)) return { error: 'Duplicate laboratory line.' }
    const priority = line.priority === 'urgent' ? 'urgent' : 'routine'
    items.push({
      lineId,
      catalogItemId: line.catalogItemId ? String(line.catalogItemId) : '',
      name,
      unit: trimText(line.unit),
      quantity: qty,
      unitPrice: Number(line.unitPrice) || 0,
      baseUnitPrice: Number(line.baseUnitPrice ?? line.unitPrice) || 0,
      priceMultiplier: Number(line.priceMultiplier) || 1,
      priority,
      note: trimText(line.notes || line.note).slice(0, 400),
      status: 'pending',
      receptionStatus: 'not_sent',
      billingRecordId: '',
      completionNote: '',
      reason: '',
      approvedBy: '',
      approvedAt: '',
      history: [],
    })
  }
  return {
    order: {
      id: '',
      submissionId: trimText(submissionId),
      sourceRecordId: '',
      patientId: String(stay?.patientId || ''),
      patientName: trimText(stay?.patientName),
      admissionId: trimText(stay?.admissionId),
      admissionNumber: trimText(stay?.admissionNumber) || String(stay?.patientId || ''),
      ward: trimText(stay?.ward),
      room: trimText(stay?.room),
      bed: trimText(stay?.bed),
      admissionType: trimText(stay?.admissionType),
      convertedFromEmergency: Boolean(stay?.convertedFromEmergency),
      requestedById: String(actor?.id || ''),
      requestedByName: actor?.name || 'Nurse',
      requestedAt: at,
      status: 'pending',
      items,
      history: [{
        action: 'submitted',
        by: actor?.name || 'Nurse',
        byId: String(actor?.id || ''),
        at,
        note: 'Laboratory tests routed from the patient record. Departmental approval does not approve a charge.',
        clientActionId: `submit:${trimText(submissionId)}`,
      }],
    },
  }
}

function findAction(order, clientActionId) {
  const id = trimText(clientActionId)
  if (!id) return false
  if ((order.history || []).some((event) => event.clientActionId === id)) return true
  return (order.items || []).some((item) => (item.history || []).some((event) => event.clientActionId === id))
}

function withItem(order, lineId, patch, event) {
  const items = order.items.map((item) => (
    item.lineId === lineId
      ? { ...item, ...patch, history: [...(item.history || []), event] }
      : item
  ))
  return {
    ...order,
    items,
    status: laboratoryOverallStatus(items),
    history: [...(order.history || []), event],
  }
}

function requireItem(order, input) {
  const clientActionId = trimText(input.clientActionId)
  if (!clientActionId) return { error: 'Missing action id.' }
  if (findAction(order, clientActionId)) return { order, duplicate: true }
  const item = (order.items || []).find((entry) => entry.lineId === input.lineId)
  if (!item) return { error: 'Test not found on this request.' }
  return { item, clientActionId }
}

function reasonText(value, label) {
  const note = trimText(value)
  if (note.length < 3) return { error: `Enter a ${label}.` }
  if (note.length > 400) return { error: `Keep the ${label} under 400 characters.` }
  return { note }
}

export function approveLaboratoryItem(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const found = requireItem(order, input)
  if (found.error || found.duplicate) return found
  if (found.item.status !== 'pending') return { error: 'Only a pending test can be approved by the laboratory.' }
  const event = {
    action: 'department_approved',
    by: actor?.name || 'Laboratory',
    byId: String(actor?.id || ''),
    at,
    lineId: found.item.lineId,
    note: 'Laboratory approved this test for reception billing review. The charge is not approved yet.',
    clientActionId: found.clientActionId,
  }
  return {
    order: withItem(order, found.item.lineId, {
      status: 'approved',
      approvedBy: actor?.name || 'Laboratory',
      approvedAt: at,
    }, event),
  }
}

export function rejectLaboratoryItem(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const found = requireItem(order, input)
  if (found.error || found.duplicate) return found
  if (found.item.status !== 'pending') return { error: 'Only a pending test can be rejected.' }
  const reason = reasonText(input.reason, 'rejection reason')
  if (reason.error) return reason
  const event = {
    action: 'department_rejected',
    by: actor?.name || 'Laboratory',
    byId: String(actor?.id || ''),
    at,
    lineId: found.item.lineId,
    note: reason.note,
    clientActionId: found.clientActionId,
  }
  return {
    order: withItem(order, found.item.lineId, {
      status: 'rejected',
      reason: reason.note,
      receptionStatus: 'not_sent',
    }, event),
  }
}

export function cancelLaboratoryItem(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const found = requireItem(order, input)
  if (found.error || found.duplicate) return found
  if (found.item.status !== 'pending' && found.item.status !== 'approved' && found.item.status !== 'processing') {
    return { error: 'This test can no longer be cancelled.' }
  }
  if (found.item.receptionStatus === 'approved') {
    return { error: 'Reception has already approved the charge. Cancellation does not remove that charge.' }
  }
  const reason = reasonText(input.reason, 'cancellation reason')
  if (reason.error) return reason
  const event = {
    action: 'cancelled',
    by: actor?.name || 'Staff',
    byId: String(actor?.id || ''),
    at,
    lineId: found.item.lineId,
    note: reason.note,
    clientActionId: found.clientActionId,
  }
  return {
    order: withItem(order, found.item.lineId, {
      status: 'cancelled',
      reason: reason.note,
    }, event),
    billingRecordId: found.item.billingRecordId || '',
  }
}
