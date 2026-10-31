function trimText(value) {
  return String(value ?? '').trim()
}

export const EXCEPTION_REASONS = [
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'temporarily_unavailable', label: 'Temporarily unavailable' },
  { value: 'other', label: 'Other reason' },
]

const REASON_LABELS = Object.fromEntries(EXCEPTION_REASONS.map((reason) => [reason.value, reason.label]))

export const RETURN_REASONS = [
  { value: 'excess_supplied', label: 'Excess medicine supplied' },
  { value: 'discontinued', label: 'Medicine discontinued or changed' },
  { value: 'patient_discharged', label: 'Patient discharged' },
  { value: 'unused', label: 'Medicine unused' },
  { value: 'other', label: 'Other' },
]

const RETURN_REASON_LABELS = Object.fromEntries(RETURN_REASONS.map((reason) => [reason.value, reason.label]))

export function normalizeCategory(value) {
  const raw = trimText(value).toLowerCase()
  if (raw === 'pharmacy' || raw === 'medicine' || raw === 'medicines') return 'pharmacy'
  if (raw === 'laboratory' || raw === 'lab' || raw === 'laboratory tests') return 'laboratory'
  return 'other'
}

export function partitionServiceLines(lines = []) {
  const pharmacy = []
  const laboratory = []
  const other = []
  for (const line of lines) {
    const key = normalizeCategory(line?.category)
    if (key === 'pharmacy') pharmacy.push(line)
    else if (key === 'laboratory') laboratory.push(line)
    else other.push(line)
  }
  return { pharmacy, laboratory, other }
}

export function serviceLineSignature(lines = []) {
  return lines
    .map((line) => [
      line?.id || line?.lineId || '',
      line?.catalogItemId || '',
      line?.serviceName || line?.name || '',
      line?.quantity ?? line?.requestedQuantity ?? '',
      line?.notes || line?.instructions || '',
      normalizeCategory(line?.category),
    ].join(':'))
    .join('|')
}

function roundQty(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function wholeQuantity(value) {
  const qty = Number(value)
  if (!Number.isInteger(qty)) return null
  return qty
}

function findAction(order, clientActionId) {
  const id = trimText(clientActionId)
  if (!id) return null
  if ((order.history || []).some((event) => event.clientActionId === id)) return true
  if ((order.returns || []).some((entry) => entry.clientActionId === id || entry.verifyActionId === id)) return true
  return (order.items || []).some((item) => (item.history || []).some((event) => event.clientActionId === id))
}

export function overallStatus(items = []) {
  if (!items.length) return 'pending'
  const open = items.some((item) => item.status === 'pending' || item.status === 'partial')
  if (items.every((item) => item.status === 'fulfilled')) return 'fulfilled'
  if (!open) return 'resolved_with_exceptions'
  if (items.every((item) => item.status === 'pending')) return 'pending'
  return 'partially_fulfilled'
}

export function returnedQuantity(order, lineId) {
  return roundQty(
    (order.returns || [])
      .filter((entry) => entry.lineId === lineId)
      .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
  )
}

export function acceptedReturnQuantity(order, lineId) {
  return roundQty(
    (order.returns || [])
      .filter((entry) => entry.lineId === lineId)
      .reduce((sum, entry) => {
        if (entry.physicalStatus === 'pending_verification') return sum
        if (entry.physicalStatus) return sum + (Number(entry.acceptedQuantity) || 0)
        return sum + (Number(entry.quantity) || 0)
      }, 0)
  )
}

export function medicineSummary(order) {
  return (order?.items || []).map((item) => {
    const returned = returnedQuantity(order, item.lineId)
    const supplied = roundQty(item.suppliedQuantity || 0)
    const requested = roundQty(item.requestedQuantity || 0)
    return {
      ...item,
      suppliedQuantity: supplied,
      requestedQuantity: requested,
      returned,
      acceptedReturned: acceptedReturnQuantity(order, item.lineId),
      pendingPresented: roundQty(returned - acceptedReturnQuantity(order, item.lineId)),
      outstanding: roundQty(requested - supplied),
      netHeld: roundQty(supplied - returned),
    }
  })
}

export function returnableQuantity(order, lineId) {
  const item = (order.items || []).find((entry) => entry.lineId === lineId)
  if (!item) return 0
  return roundQty(Number(item.suppliedQuantity || 0) - returnedQuantity(order, lineId))
}

function returnReason(input = {}) {
  const code = trimText(input.reasonCode)
  if (code) {
    if (!RETURN_REASON_LABELS[code]) return { error: 'Select a return reason.' }
    const note = trimText(input.reasonNote)
    if (note.length > 400) return { error: 'Keep the explanation under 400 characters.' }
    if (code === 'other' && note.length < 3) return { error: 'Enter an explanation for the other reason.' }
    const label = code === 'other' ? note : RETURN_REASON_LABELS[code]
    return { code, note, label }
  }
  const reason = trimText(input.reason)
  if (reason.length < 3) return { error: 'Enter a return reason.' }
  if (reason.length > 400) return { error: 'Keep the return reason under 400 characters.' }
  return { code: '', note: reason, label: reason }
}

export function returnReasonLabel(code, note = '') {
  if (code === 'other') return note || 'Other'
  return RETURN_REASON_LABELS[code] || note || ''
}

function requireException(input = {}) {
  const code = trimText(input.reasonCode)
  if (!REASON_LABELS[code]) return { error: 'Select a reason for the quantity that was not supplied.' }
  const note = trimText(input.reasonNote)
  if (code === 'other') {
    if (note.length < 3) return { error: 'Enter a short explanation for the other reason.' }
    if (note.length > 400) return { error: 'Keep the explanation under 400 characters.' }
    return { code, note }
  }
  return { code, note: '' }
}

function eventNote(outcome, quantity, reason) {
  if (outcome === 'fulfilled') return `Handed over ${quantity}.`
  if (outcome === 'partial') return `Handed over ${quantity}. ${reason?.note || REASON_LABELS[reason?.code] || ''}`.trim()
  return `Not supplied. ${reason?.note || REASON_LABELS[reason?.code] || ''}`.trim()
}

export function buildPharmacyOrder({ submissionId, stay, actor, lines, at }) {
  if (!trimText(submissionId)) return { error: 'Submission id is required.' }
  if (!lines?.length) return { error: 'Add at least one medicine.' }
  const items = []
  for (const line of lines) {
    const name = trimText(line.serviceName || line.name)
    const qty = wholeQuantity(line.quantity ?? line.requestedQuantity)
    if (!name) return { error: 'Medicine name is missing.' }
    if (qty == null || qty < 1 || qty > 999) {
      return { error: `${name || 'Medicine'}: enter a whole quantity from 1 to 999.` }
    }
    const lineId = trimText(line.id || line.lineId) || `line-${items.length + 1}`
    if (items.some((item) => item.lineId === lineId)) return { error: 'Duplicate medicine line.' }
    items.push({
      lineId,
      catalogItemId: line.catalogItemId ? String(line.catalogItemId) : '',
      name,
      unit: trimText(line.unit),
      requestedQuantity: qty,
      unitPrice: Number(line.unitPrice) || 0,
      baseUnitPrice: Number(line.baseUnitPrice ?? line.unitPrice) || 0,
      priceMultiplier: Number(line.priceMultiplier) || 1,
      instructions: trimText(line.notes || line.instructions).slice(0, 400),
      suppliedQuantity: 0,
      billedQuantity: 0,
      receptionStatus: 'not_sent',
      billingRecordId: '',
      status: 'pending',
      reasonCode: '',
      reasonNote: '',
      history: [],
    })
  }
  return {
    order: {
      id: '',
      submissionId: trimText(submissionId),
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
      returns: [],
      history: [{
        action: 'submitted',
        by: actor?.name || 'Nurse',
        byId: String(actor?.id || ''),
        at,
        note: 'Medicines routed from the patient record. This is not a reception billing approval.',
        clientActionId: `submit:${trimText(submissionId)}`,
      }],
    },
  }
}

export function applyHandover(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const clientActionId = trimText(input.clientActionId)
  if (!clientActionId) return { error: 'Missing action id.' }
  if (findAction(order, clientActionId)) return { order, duplicate: true }

  const item = (order.items || []).find((entry) => entry.lineId === input.lineId)
  if (!item) return { error: 'Medicine not found on this request.' }
  if (item.status === 'fulfilled' || item.status === 'not_supplied' || item.status === 'closed_partial') {
    return { error: 'This medicine is already resolved.' }
  }

  const outcome = trimText(input.outcome)
  const qty = wholeQuantity(input.quantity)
  if (qty == null || qty < 0) return { error: 'Quantity cannot be negative.' }
  const outstanding = roundQty(item.requestedQuantity - item.suppliedQuantity)
  let reason = { code: '', note: '' }

  if (outcome === 'fulfilled') {
    if (outstanding <= 0) return { error: 'There is no remaining quantity to hand over.' }
    if (qty !== outstanding) return { error: 'Hand over the full remaining quantity, or record a partial handover.' }
  } else if (outcome === 'partial') {
    if (!(qty > 0 && qty < outstanding)) {
      return { error: 'Partial quantity must be greater than zero and less than the remaining quantity.' }
    }
    reason = requireException(input)
    if (reason.error) return reason
  } else if (outcome === 'not_supplied') {
    if (qty !== 0) return { error: 'A medicine that is not supplied cannot be recorded as handed over.' }
    reason = requireException(input)
    if (reason.error) return reason
  } else {
    return { error: 'Choose a fulfillment outcome.' }
  }

  const supplied = outcome === 'not_supplied' ? roundQty(item.suppliedQuantity) : roundQty(item.suppliedQuantity + qty)
  let status = 'partial'
  if (outcome === 'fulfilled') status = 'fulfilled'
  else if (outcome === 'not_supplied') status = item.suppliedQuantity > 0 ? 'closed_partial' : 'not_supplied'

  const entry = {
    action: outcome === 'fulfilled' ? 'handed_over' : outcome === 'partial' ? 'partial_handover' : 'not_supplied',
    by: actor?.name || 'Pharmacist',
    byId: String(actor?.id || ''),
    at,
    lineId: item.lineId,
    quantity: outcome === 'not_supplied' ? 0 : qty,
    outcome,
    reasonCode: reason.code,
    reasonNote: reason.note || (reason.code ? REASON_LABELS[reason.code] : ''),
    note: trimText(input.note).slice(0, 400) || eventNote(outcome, outcome === 'not_supplied' ? 0 : qty, reason),
    clientActionId,
  }
  const items = order.items.map((current) => (
    current.lineId === item.lineId
      ? {
          ...current,
          suppliedQuantity: supplied,
          status,
          reasonCode: outcome === 'fulfilled' ? '' : reason.code,
          reasonNote: outcome === 'fulfilled' ? '' : (reason.note || REASON_LABELS[reason.code] || ''),
          history: [...(current.history || []), entry],
        }
      : current
  ))
  return {
    order: {
      ...order,
      items,
      status: overallStatus(items),
      history: [...(order.history || []), entry],
    },
  }
}

export function applyReturn(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const clientActionId = trimText(input.clientActionId)
  if (!clientActionId) return { error: 'Missing action id.' }
  if (findAction(order, clientActionId)) return { order, duplicate: true }

  const item = (order.items || []).find((entry) => entry.lineId === input.lineId)
  if (!item) return { error: 'Medicine not found on this request.' }
  if (trimText(order.admissionId) && trimText(input.admissionId) && trimText(order.admissionId) !== trimText(input.admissionId)) {
    return { error: 'This return does not match the admission for the original handover.' }
  }
  const qty = wholeQuantity(input.quantity)
  if (qty == null || qty < 1) return { error: 'Enter a whole returned quantity of at least 1.' }
  const eligible = returnableQuantity(order, item.lineId)
  if (qty > eligible) return { error: 'Return quantity cannot exceed the quantity still held after previous handovers and returns.' }
  if (!(Number(item.suppliedQuantity) > 0)) return { error: 'This medicine has no recorded handover to return against.' }
  const reason = returnReason(input)
  if (reason.error) return reason

  const historyEntry = {
    action: 'return_initiated',
    by: actor?.name || 'Pharmacist',
    byId: String(actor?.id || ''),
    at,
    lineId: item.lineId,
    quantity: qty,
    note: `Presented ${qty}${item.unit ? ` ${item.unit}` : ''} for verification. ${reason.label}`,
    reasonCode: reason.code,
    reasonNote: reason.label,
    clientActionId,
  }
  const entry = {
    id: clientActionId,
    lineId: item.lineId,
    quantity: qty,
    presentedQuantity: qty,
    acceptedQuantity: 0,
    notAcceptedQuantity: 0,
    reason: reason.label,
    reasonCode: reason.code,
    reasonNote: reason.note,
    discrepancyReason: '',
    verificationNotes: '',
    physicalStatus: 'pending_verification',
    billingStatus: 'not_eligible',
    billingNote: '',
    billingRecordId: '',
    pharmacistId: String(actor?.id || ''),
    pharmacistName: actor?.name || 'Pharmacist',
    at,
    verifiedById: '',
    verifiedByName: '',
    verifiedAt: '',
    receptionBy: '',
    receptionAt: '',
    receptionNote: '',
    clientActionId,
    verifyActionId: '',
    history: [historyEntry],
  }
  return {
    order: {
      ...order,
      returns: [...(order.returns || []), entry],
      history: [...(order.history || []), historyEntry],
    },
  }
}

export function verifyReturn(order, actor, input = {}, at = new Date().toISOString()) {
  if (!order) return { error: 'Request not found.' }
  const verifyActionId = trimText(input.clientActionId)
  if (!verifyActionId) return { error: 'Missing action id.' }
  if (findAction(order, verifyActionId)) {
    const existing = (order.returns || []).find((entry) => entry.verifyActionId === verifyActionId)
    return { order, duplicate: true, returnId: existing?.id || '' }
  }
  const returnId = trimText(input.returnId)
  const current = (order.returns || []).find((entry) => entry.id === returnId)
  if (!current) return { error: 'Return not found on this handover.' }
  if (current.physicalStatus !== 'pending_verification') {
    return { error: 'This return has already been verified.' }
  }
  const presented = wholeQuantity(current.presentedQuantity ?? current.quantity)
  const accepted = wholeQuantity(input.acceptedQuantity)
  if (presented == null || accepted == null || accepted < 0 || accepted > presented) {
    return { error: 'Accepted quantity must be a whole number from zero up to the quantity presented.' }
  }
  if (input.rejectedQuantity !== undefined && input.rejectedQuantity !== null && input.rejectedQuantity !== '') {
    const rejected = wholeQuantity(input.rejectedQuantity)
    if (rejected == null || rejected < 0) {
      return { error: 'Rejected quantity must be a whole number of zero or more.' }
    }
    if (accepted + rejected > presented) {
      return { error: 'Accepted and rejected quantities cannot exceed the quantity presented.' }
    }
    if (accepted + rejected !== presented) {
      return { error: 'Accepted plus rejected must equal the quantity presented.' }
    }
  }
  const discrepancy = trimText(input.discrepancyReason)
  if (accepted < presented && discrepancy.length < 3) {
    return { error: 'Enter why part of the presented quantity was not accepted.' }
  }
  if (discrepancy.length > 400) return { error: 'Keep the discrepancy reason under 400 characters.' }
  const notes = trimText(input.verificationNotes)
  if (notes.length > 400) return { error: 'Keep the verification notes under 400 characters.' }

  const physicalStatus = accepted === 0 ? 'rejected' : accepted < presented ? 'partially_accepted' : 'verified'
  const billingStatus = accepted === 0 ? 'no_adjustment' : 'not_eligible'
  const historyEntry = {
    action: accepted === 0 ? 'return_rejected' : 'return_verified',
    by: actor?.name || 'Pharmacist',
    byId: String(actor?.id || ''),
    at,
    lineId: current.lineId,
    quantity: accepted,
    note: accepted === 0
      ? `Pharmacy did not accept the presented return. ${discrepancy}`
      : `Accepted ${accepted} of ${presented} presented.${accepted < presented ? ` ${discrepancy}` : ''}`,
    reasonNote: discrepancy,
    clientActionId: verifyActionId,
  }
  const next = {
    ...current,
    quantity: accepted,
    acceptedQuantity: accepted,
    notAcceptedQuantity: roundQty(presented - accepted),
    discrepancyReason: discrepancy,
    verificationNotes: notes,
    physicalStatus,
    billingStatus,
    billingNote: accepted === 0 ? 'No medicine was accepted, so there is no billing adjustment.' : '',
    verifiedById: String(actor?.id || ''),
    verifiedByName: actor?.name || 'Pharmacist',
    verifiedAt: at,
    verifyActionId,
    history: [...(current.history || []), historyEntry],
  }
  return {
    returnId: current.id,
    order: {
      ...order,
      returns: order.returns.map((entry) => (entry.id === current.id ? next : entry)),
      history: [...(order.history || []), historyEntry],
    },
  }
}

export function describeMedicineReturn(order, entry) {
  const item = (order?.items || []).find((line) => line.lineId === entry.lineId) || {}
  const price = Number(item.unitPrice)
  const presented = Number(entry.presentedQuantity ?? entry.quantity) || 0
  const accepted = entry.physicalStatus === 'pending_verification'
    ? 0
    : Number(entry.physicalStatus ? entry.acceptedQuantity : entry.quantity) || 0
  const hasPrice = Number.isFinite(price) && price >= 0
  return {
    id: entry.id,
    orderId: order?.id || '',
    submissionId: order?.submissionId || '',
    patientId: order?.patientId || '',
    patientName: order?.patientName || '',
    admissionId: order?.admissionId || '',
    ward: order?.ward || '',
    room: order?.room || '',
    bed: order?.bed || '',
    lineId: entry.lineId,
    medicineName: item.name || '',
    unit: item.unit || '',
    requestedQuantity: Number(item.requestedQuantity) || 0,
    suppliedQuantity: Number(item.suppliedQuantity) || 0,
    presentedQuantity: presented,
    acceptedQuantity: accepted,
    notAcceptedQuantity: Number(entry.notAcceptedQuantity) || 0,
    acceptedOnLine: acceptedReturnQuantity(order, entry.lineId),
    remainingEligible: returnableQuantity(order, entry.lineId),
    reason: entry.reason || '',
    reasonCode: entry.reasonCode || '',
    discrepancyReason: entry.discrepancyReason || '',
    verificationNotes: entry.verificationNotes || '',
    physicalStatus: entry.physicalStatus || 'completed',
    billingStatus: entry.billingStatus || 'no_adjustment',
    billingNote: entry.billingNote || '',
    billingRecordId: entry.billingRecordId || '',
    chargeReference: item.billingRecordId || '',
    chargeStatus: item.receptionStatus || '',
    unitPrice: hasPrice ? price : null,
    proposedAdjustment: hasPrice && accepted > 0 ? -Math.round(accepted * price * 100) / 100 : null,
    pharmacistName: entry.pharmacistName || '',
    at: entry.at || '',
    verifiedByName: entry.verifiedByName || '',
    verifiedAt: entry.verifiedAt || '',
    receptionBy: entry.receptionBy || '',
    receptionAt: entry.receptionAt || '',
    receptionNote: entry.receptionNote || '',
  }
}

export function listMedicineReturns(orders = [], { includePending = true } = {}) {
  const rows = []
  for (const order of orders) {
    for (const entry of order.returns || []) {
      const row = describeMedicineReturn(order, entry)
      if (!includePending && row.physicalStatus === 'pending_verification') continue
      rows.push(row)
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function queryPharmacyOrders(orders = [], { status = 'all', search = '', sort = 'newest' } = {}) {
  const q = trimText(search).toLowerCase()
  const rows = orders.filter((order) => {
    if (status === 'open' && order.status !== 'pending' && order.status !== 'partially_fulfilled') return false
    if (status && status !== 'all' && status !== 'open' && order.status !== status) return false
    if (!q) return true
    const haystack = [
      order.patientName,
      order.patientId,
      order.admissionNumber,
      order.admissionId,
      order.requestedByName,
      order.ward,
      order.room,
      order.bed,
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })
  return [...rows].sort((a, b) => {
    const left = a.requestedAt || ''
    const right = b.requestedAt || ''
    return sort === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
  })
}

export function formatStayLocation(order) {
  return [order?.ward, order?.room, order?.bed].filter(Boolean).join(' · ') || '—'
}

export function reasonLabel(code, note = '') {
  if (code === 'other') return note || 'Other reason'
  return REASON_LABELS[code] || note || ''
}
