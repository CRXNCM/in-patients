import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeedWorkflowRequests } from '../data/workflowSeed.js'
import { canCancelRequest } from '../lib/workflowAccess.js'
import {
  acceptLaboratoryRequest,
  approvePharmacyRequest,
  buildLaboratoryRequest,
  buildPharmacyRequest,
  cancelWorkflowRequest,
  completeLaboratoryRequest,
  queryWorkflowRequests,
  rejectPharmacyRequest,
  requestDay,
} from './workflowRequests.js'

const nurse = { id: 'nurse-1', name: 'Nurse Almaz Tsegaye' }
const pharmacist = { id: 'pharm-1', name: 'Pharmacist Dawit Bekele' }
const tech = { id: 'lab-1', name: 'Meron Alemu' }

const stay = {
  patientId: 'PAT-100',
  patientName: 'Test Patient',
  admissionId: 'ADM-100',
  ward: 'Medical Ward',
  room: 'MW-1',
  bed: 'Bed 1',
}

function pharmacy(extra = {}) {
  const result = buildPharmacyRequest({
    ...stay,
    itemName: 'Paracetamol 500mg',
    quantity: 2,
    dosage: '500 mg once',
    note: 'Pain',
    ...extra,
  }, nurse, 'PHR-1', '2026-10-25T06:00:00.000Z')
  assert.ok(result.request, result.errors && JSON.stringify(result.errors))
  return result.request
}

test('seed requests cover the status model and stay marked as demonstration data', () => {
  const rows = createSeedWorkflowRequests()
  const ids = new Set(rows.map((row) => row.id))
  assert.equal(ids.size, rows.length)
  assert.ok(rows.every((row) => row.demonstration === true))
  assert.ok(rows.every((row) => String(row.patientId).startsWith('DEMO-')))
  const pharmacyStatuses = new Set(rows.filter((row) => row.kind === 'pharmacy').map((row) => row.status))
  const labStatuses = new Set(rows.filter((row) => row.kind === 'laboratory').map((row) => row.status))
  assert.deepEqual([...pharmacyStatuses].sort(), ['approved', 'cancelled', 'pending', 'rejected'])
  assert.deepEqual([...labStatuses].sort(), ['cancelled', 'completed', 'pending', 'processing'])
  assert.ok(rows.every((row) => row.history[0].action === 'submitted'))
})

test('pharmacy approval is explicit and cannot be repeated', () => {
  const pending = pharmacy()
  const approved = approvePharmacyRequest(pending, pharmacist, '2026-10-25T07:00:00.000Z')
  assert.equal(pending.status, 'pending')
  assert.equal(approved.request.status, 'approved')
  assert.equal(approved.request.history.at(-1).note, 'Medicine handed to the nurse.')
  const again = approvePharmacyRequest(approved.request, pharmacist)
  assert.match(again.error, /pending/)
})

test('rejection keeps the request and requires a reason', () => {
  const pending = pharmacy()
  assert.match(rejectPharmacyRequest(pending, pharmacist, 'no').error, /rejection reason/)
  const rejected = rejectPharmacyRequest(pending, pharmacist, 'Not dispensed. Confirm the written order.')
  assert.equal(rejected.request.status, 'rejected')
  const visible = queryWorkflowRequests([rejected.request], { kind: 'pharmacy', status: 'all' })
  assert.equal(visible.length, 1)
  assert.equal(visible[0].rejectionReason, 'Not dispensed. Confirm the written order.')
})

test('laboratory moves from pending to processing to completed', () => {
  const created = buildLaboratoryRequest({
    ...stay,
    itemName: 'Complete Blood Count (CBC)',
    priority: 'urgent',
    note: 'This morning',
  }, nurse, 'LAB-1', '2026-10-25T05:00:00.000Z')
  assert.equal(completeLaboratoryRequest(created.request, tech, 'Done').error.includes('Accept'), true)
  const accepted = acceptLaboratoryRequest(created.request, tech, '2026-10-25T05:10:00.000Z')
  assert.equal(accepted.request.status, 'processing')
  const completed = completeLaboratoryRequest(
    accepted.request,
    tech,
    'Worksheet filed. No analyzer result is stored in this prototype.',
    '2026-10-25T08:00:00.000Z'
  )
  assert.equal(completed.request.status, 'completed')
  assert.equal(completed.request.history.map((event) => event.action).join(','), 'submitted,accepted,completed')
})

test('filters search, priority, date, and sort', () => {
  const rows = createSeedWorkflowRequests()
  const byMedicine = queryWorkflowRequests(rows, { kind: 'pharmacy', search: 'metformin' })
  assert.deepEqual(byMedicine.map((row) => row.id), ['PHR-2406'])
  const urgent = queryWorkflowRequests(rows, { kind: 'laboratory', priority: 'urgent', status: 'all' })
  assert.ok(urgent.every((row) => row.priority === 'urgent'))
  assert.ok(urgent.some((row) => row.id === 'LAB-2401'))
  const sample = rows.find((row) => row.id === 'LAB-2401')
  const sameDay = queryWorkflowRequests(rows, { kind: 'laboratory', date: requestDay(sample.requestedAt) })
  assert.ok(sameDay.every((row) => requestDay(row.requestedAt) === requestDay(sample.requestedAt)))
  const oldest = queryWorkflowRequests(rows, { kind: 'pharmacy', sort: 'oldest', status: 'all' })
  assert.equal(oldest[0].id, 'PHR-2407')
  const open = queryWorkflowRequests(rows, { kind: 'laboratory', status: 'open' })
  assert.ok(open.every((row) => row.status === 'pending' || row.status === 'processing'))
})

test('a nurse can cancel only their own pending request', () => {
  const pending = pharmacy()
  assert.equal(canCancelRequest({ id: 'nurse-1', roleKey: 'nurse' }, pending), true)
  assert.equal(canCancelRequest({ id: 'other', roleKey: 'nurse' }, pending), false)
  const cancelled = cancelWorkflowRequest(pending, nurse, 'Entered for the wrong patient.')
  assert.equal(cancelled.request.status, 'cancelled')
  const approved = approvePharmacyRequest(pending, pharmacist).request
  assert.match(cancelWorkflowRequest(approved, nurse, 'Too late to cancel.').error, /pending/)
})

test('pharmacy draft validation rejects a missing medicine and a fractional quantity', () => {
  const missing = buildPharmacyRequest({ ...stay, quantity: 1 }, nurse, 'PHR-9')
  assert.match(missing.errors.itemName, /medication/)
  const fraction = buildPharmacyRequest({ ...stay, itemName: 'Gauze', quantity: 1.5 }, nurse, 'PHR-9')
  assert.match(fraction.errors.quantity, /whole quantity/)
})
