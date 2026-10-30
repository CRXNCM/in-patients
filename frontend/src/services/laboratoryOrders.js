function trimText(value) {
  return String(value ?? '').trim()
}

export function laboratoryOverallStatus(items = []) {
  if (!items.length) return 'pending'
  const open = items.filter((item) => item.status !== 'cancelled' && item.status !== 'rejected')
  if (!open.length) return items.some((item) => item.status === 'rejected') ? 'rejected' : 'cancelled'
  if (open.every((item) => item.status === 'completed')) return 'completed'
  if (open.some((item) => item.status === 'processing')) return 'processing'
  if (open.every((item) => item.status === 'approved' || item.status === 'processing' || item.status === 'completed')) {
    return open.every((item) => item.status === 'approved') ? 'approved' : 'processing'
  }
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

function optionalNote(value) {
  const note = trimText(value)
  if (note.length > 400) return { error: 'Keep the completion note under 400 characters.' }
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

export function processLaboratoryItem(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const found = requireItem(order, input)
  if (found.error || found.duplicate) return found
  if (found.item.status !== 'approved') return { error: 'Approve the test before processing it.' }
  const event = {
    action: 'processing',
    by: actor?.name || 'Laboratory',
    byId: String(actor?.id || ''),
    at,
    lineId: found.item.lineId,
    note: 'Test accepted for processing. This does not approve the charge.',
    clientActionId: found.clientActionId,
  }
  return { order: withItem(order, found.item.lineId, { status: 'processing' }, event) }
}

export function completeLaboratoryItem(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const found = requireItem(order, input)
  if (found.error || found.duplicate) return found
  if (found.item.status !== 'processing') return { error: 'Accept the test for processing before completing it.' }
  const note = optionalNote(input.note || input.completionNote)
  if (note.error) return note
  const event = {
    action: 'completed',
    by: actor?.name || 'Laboratory',
    byId: String(actor?.id || ''),
    at,
    lineId: found.item.lineId,
    note: note.note || 'Test completed.',
    clientActionId: found.clientActionId,
  }
  return {
    order: withItem(order, found.item.lineId, {
      status: 'completed',
      completionNote: note.note,
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
