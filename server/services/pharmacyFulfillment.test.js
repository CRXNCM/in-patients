import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acceptedReturnQuantity,
  applyHandover,
  applyReturn,
  buildPharmacyOrder,
  medicineSummary,
  overallStatus,
  partitionServiceLines,
  returnableQuantity,
  verifyReturn,
} from '../../frontend/src/services/pharmacyFulfillment.js'

const nurse = { id: 'nurse-1', name: 'Nurse Almaz' }
const pharmacist = { id: 'pharm-1', name: 'Pharmacist Dawit' }
const at = '2026-10-25T08:00:00.000Z'

const stay = {
  patientId: 'PAT-100',
  patientName: 'Test Patient',
  admissionId: 'ADM-100',
  admissionNumber: 'PAT-100',
  ward: 'Medical',
  room: 'GW',
  bed: 'GW-01',
}

function orderFrom(lines) {
  const result = buildPharmacyOrder({
    submissionId: 'sub-1',
    stay,
    actor: nurse,
    lines,
    at,
  })
  assert.ok(result.order, result.error)
  return { ...result.order, id: 'order-1' }
}

const twoMedicines = [
  { id: 'line-a', category: 'Pharmacy', serviceName: 'Paracetamol 500mg', quantity: 10, unit: 'tablet', notes: '1 tablet at night' },
  { id: 'line-b', category: 'Pharmacy', serviceName: 'Ceftriaxone 1g', quantity: 4, unit: 'vial', notes: 'IV daily' },
]

test('one record splits pharmacy, laboratory, and other services', () => {
  const parts = partitionServiceLines([
    { category: 'Pharmacy', serviceName: 'Paracetamol 500mg' },
    { category: 'Laboratory', serviceName: 'CBC' },
    { category: 'Consultation', serviceName: 'Specialist review' },
  ])
  assert.equal(parts.pharmacy.length, 1)
  assert.equal(parts.laboratory.length, 1)
  assert.equal(parts.other.length, 1)
})

test('one pharmacy request holds multiple medicines', () => {
  const order = orderFrom(twoMedicines)
  assert.equal(order.items.length, 2)
  assert.equal(order.status, 'pending')
  assert.equal(order.items[0].instructions, '1 tablet at night')
  assert.equal(overallStatus(order.items), 'pending')
})

test('partial handover records supplied and outstanding quantities', () => {
  const order = orderFrom(twoMedicines)
  const result = applyHandover(order, pharmacist, {
    clientActionId: 'act-1',
    lineId: 'line-a',
    outcome: 'partial',
    quantity: 4,
    reasonCode: 'temporarily_unavailable',
  }, at)
  assert.ok(result.order, result.error)
  const item = result.order.items[0]
  assert.equal(item.suppliedQuantity, 4)
  assert.equal(item.requestedQuantity, 10)
  assert.equal(medicineSummary(result.order)[0].outstanding, 6)
  assert.equal(result.order.status, 'partially_fulfilled')
})

test('exceptions require a reason and other requires an explanation', () => {
  const order = orderFrom(twoMedicines)
  const missing = applyHandover(order, pharmacist, {
    clientActionId: 'act-2',
    lineId: 'line-b',
    outcome: 'not_supplied',
    quantity: 0,
  }, at)
  assert.match(missing.error, /reason/i)
  const other = applyHandover(order, pharmacist, {
    clientActionId: 'act-3',
    lineId: 'line-b',
    outcome: 'not_supplied',
    quantity: 0,
    reasonCode: 'other',
  }, at)
  assert.match(other.error, /explanation/i)
  const saved = applyHandover(order, pharmacist, {
    clientActionId: 'act-4',
    lineId: 'line-b',
    outcome: 'not_supplied',
    quantity: 0,
    reasonCode: 'out_of_stock',
  }, at)
  assert.equal(saved.order.items[1].suppliedQuantity, 0)
  assert.equal(saved.order.items[1].status, 'not_supplied')
  assert.equal(saved.order.items[1].requestedQuantity, 4)
})

test('a request is not fulfilled while a medicine is still unresolved', () => {
  const order = orderFrom(twoMedicines)
  const first = applyHandover(order, pharmacist, {
    clientActionId: 'act-5',
    lineId: 'line-a',
    outcome: 'fulfilled',
    quantity: 10,
  }, at)
  assert.equal(first.order.status, 'partially_fulfilled')
  assert.notEqual(first.order.status, 'fulfilled')
})

test('mixed outcomes can close a request as resolved with exceptions', () => {
  let order = orderFrom(twoMedicines)
  order = applyHandover(order, pharmacist, {
    clientActionId: 'act-6',
    lineId: 'line-a',
    outcome: 'fulfilled',
    quantity: 10,
  }, at).order
  order = applyHandover(order, pharmacist, {
    clientActionId: 'act-7',
    lineId: 'line-b',
    outcome: 'not_supplied',
    quantity: 0,
    reasonCode: 'out_of_stock',
  }, at).order
  assert.equal(order.status, 'resolved_with_exceptions')
})

test('repeated handover submission does not dispense the quantity twice', () => {
  const order = orderFrom(twoMedicines)
  const input = {
    clientActionId: 'act-8',
    lineId: 'line-a',
    outcome: 'partial',
    quantity: 3,
    reasonCode: 'out_of_stock',
  }
  const first = applyHandover(order, pharmacist, input, at)
  const second = applyHandover(first.order, pharmacist, input, at)
  assert.equal(second.duplicate, true)
  assert.equal(second.order.items[0].suppliedQuantity, 3)
})

test('a return is linked to the handover and cannot exceed the quantity still held', () => {
  let order = orderFrom(twoMedicines)
  order = applyHandover(order, pharmacist, {
    clientActionId: 'act-9',
    lineId: 'line-a',
    outcome: 'partial',
    quantity: 5,
    reasonCode: 'temporarily_unavailable',
  }, at).order
  const tooMuch = applyReturn(order, pharmacist, {
    clientActionId: 'ret-1',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 6,
    reason: 'Patient discharged early',
  }, at)
  assert.match(tooMuch.error, /cannot exceed/i)
  const wrongStay = applyReturn(order, pharmacist, {
    clientActionId: 'ret-2',
    lineId: 'line-a',
    admissionId: 'ADM-OTHER',
    quantity: 1,
    reason: 'Wrong stay',
  }, at)
  assert.match(wrongStay.error, /admission/i)
  const saved = applyReturn(order, pharmacist, {
    clientActionId: 'ret-3',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 2,
    reason: 'Unused tablets returned',
  }, at)
  assert.equal(saved.order.items[0].suppliedQuantity, 5)
  assert.equal(saved.order.returns.length, 1)
  assert.equal(returnableQuantity(saved.order, 'line-a'), 3)
  assert.equal(medicineSummary(saved.order)[0].netHeld, 3)
  const again = applyReturn(saved.order, pharmacist, {
    clientActionId: 'ret-3',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 2,
    reason: 'Unused tablets returned',
  }, at)
  assert.equal(again.duplicate, true)
  assert.equal(again.order.returns.length, 1)
})

test('verification accepts only part of a presented return and releases the rest', () => {
  let order = orderFrom(twoMedicines)
  order = applyHandover(order, pharmacist, {
    clientActionId: 'act-return-hand',
    lineId: 'line-a',
    outcome: 'fulfilled',
    quantity: 10,
  }, at).order
  order = applyReturn(order, pharmacist, {
    clientActionId: 'ret-present',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 3,
    reasonCode: 'unused',
  }, at).order
  assert.equal(order.returns[0].physicalStatus, 'pending_verification')
  assert.equal(order.returns[0].billingStatus, 'not_eligible')
  assert.equal(returnableQuantity(order, 'line-a'), 7)
  const verified = verifyReturn(order, pharmacist, {
    clientActionId: 'ret-verify',
    returnId: 'ret-present',
    acceptedQuantity: 2,
    discrepancyReason: 'One tablet was damaged',
  }, at)
  assert.equal(verified.order.returns[0].acceptedQuantity, 2)
  assert.equal(verified.order.returns[0].presentedQuantity, 3)
  assert.equal(verified.order.returns[0].physicalStatus, 'partially_accepted')
  assert.equal(verified.order.items[0].suppliedQuantity, 10)
  assert.equal(acceptedReturnQuantity(verified.order, 'line-a'), 2)
  assert.equal(returnableQuantity(verified.order, 'line-a'), 8)
  const replay = verifyReturn(verified.order, pharmacist, {
    clientActionId: 'ret-verify',
    returnId: 'ret-present',
    acceptedQuantity: 3,
  }, at)
  assert.equal(replay.duplicate, true)
  assert.equal(replay.order.returns.length, 1)
})

test('a later return cannot exceed the quantity still eligible after an accepted return', () => {
  let order = orderFrom(twoMedicines)
  order = applyHandover(order, pharmacist, {
    clientActionId: 'act-return-hand-2',
    lineId: 'line-a',
    outcome: 'partial',
    quantity: 8,
    reasonCode: 'out_of_stock',
  }, at).order
  order = applyReturn(order, pharmacist, {
    clientActionId: 'ret-a',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 2,
    reasonCode: 'unused',
  }, at).order
  order = verifyReturn(order, pharmacist, {
    clientActionId: 'ret-a-verify',
    returnId: 'ret-a',
    acceptedQuantity: 2,
  }, at).order
  order = applyReturn(order, pharmacist, {
    clientActionId: 'ret-b',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 3,
    reasonCode: 'excess_supplied',
  }, at).order
  order = verifyReturn(order, pharmacist, {
    clientActionId: 'ret-b-verify',
    returnId: 'ret-b',
    acceptedQuantity: 2,
    discrepancyReason: 'One tablet was not brought',
  }, at).order
  assert.equal(acceptedReturnQuantity(order, 'line-a'), 4)
  assert.equal(returnableQuantity(order, 'line-a'), 4)
  const tooMuch = applyReturn(order, pharmacist, {
    clientActionId: 'ret-c',
    lineId: 'line-a',
    admissionId: 'ADM-100',
    quantity: 5,
    reasonCode: 'unused',
  }, at)
  assert.match(tooMuch.error, /cannot exceed/i)
})

test('quantity cannot be negative or above the outstanding request', () => {
  const order = orderFrom(twoMedicines)
  const negative = applyHandover(order, pharmacist, {
    clientActionId: 'act-10',
    lineId: 'line-a',
    outcome: 'partial',
    quantity: -1,
    reasonCode: 'out_of_stock',
  }, at)
  assert.match(negative.error, /negative|whole/i)
  const over = applyHandover(order, pharmacist, {
    clientActionId: 'act-11',
    lineId: 'line-a',
    outcome: 'fulfilled',
    quantity: 11,
  }, at)
  assert.match(over.error, /full remaining|partial/i)
})
