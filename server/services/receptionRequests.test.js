import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildReceptionRequests, parentReceptionStatus } from './receptionRequests.js'

const submission = {
  submissionId: 'SR-001',
  patientId: 'PAT-1',
  status: 'saved',
  submittedByName: 'Nurse A',
  submittedAt: '2026-10-25T06:15:00.000Z',
}

function pharmacyItem(lineId, name, status, supplied, receptionStatus = 'not_sent') {
  return { lineId, name, requestedQuantity: 1, suppliedQuantity: supplied, status, receptionStatus, unitPrice: 10 }
}

describe('reception request grouping', () => {
  it('keeps several pharmacy items on one reception entry', () => {
    const requests = buildReceptionRequests({
      submissions: [submission],
      pharmacyOrders: [{
        id: 'order-p',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        patientName: 'Patient A',
        admissionId: 'stay-1',
        requestedByName: 'Nurse A',
        requestedAt: submission.submittedAt,
        items: [
          pharmacyItem('a', 'Medicine A', 'fulfilled', 1, 'pending'),
          pharmacyItem('b', 'Medicine B', 'pending', 0),
        ],
      }],
      records: [{
        _id: 'bill-a',
        patientId: 'PAT-1',
        submissionId: 'SR-001',
        status: 'pending',
        workflowKind: 'pharmacy',
        workflowOrderId: 'order-p',
        workflowLineId: 'a',
        billingKey: 'pharmacy:order-p:a',
        departmentCleared: true,
        services: [{ id: 'a', serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
      }],
      patients: [{ patientId: 'PAT-1', name: 'Patient A', _id: 'stay-1' }],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].id, 'SR-001')
    assert.equal(requests[0].submittedBy, 'Nurse A')
    assert.equal(requests[0].totalItems, 2)
    assert.equal(requests[0].eligibleCount, 1)
    assert.equal(requests[0].status, 'pending')
    assert.equal(requests[0].items[1].receptionDecision, 'Not yet eligible')
    assert.equal(requests[0].items[1].unitPrice, null)
  })

  it('keeps several laboratory items on one reception entry', () => {
    const requests = buildReceptionRequests({
      submissions: [submission],
      laboratoryOrders: [{
        id: 'order-l',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        items: [
          { lineId: 'c', name: 'Test C', quantity: 1, status: 'approved', unitPrice: 20 },
          { lineId: 'd', name: 'Test D', quantity: 1, status: 'pending', unitPrice: 30 },
        ],
      }],
      records: [{
        _id: 'bill-c',
        patientId: 'PAT-1',
        submissionId: 'SR-001',
        status: 'pending',
        workflowKind: 'laboratory',
        workflowOrderId: 'order-l',
        workflowLineId: 'c',
        departmentCleared: true,
        services: [{ serviceName: 'Test C', quantity: 1, unitPrice: 20, total: 20 }],
      }],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].items.map((item) => item.description).join(','), 'Test C,Test D')
    assert.equal(requests[0].items[1].eligibility, 'awaiting_department')
  })

  it('keeps pharmacy and laboratory items in the same parent request', () => {
    const requests = buildReceptionRequests({
      submissions: [submission],
      pharmacyOrders: [{
        id: 'order-p',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        items: [pharmacyItem('a', 'Medicine A', 'fulfilled', 1, 'approved')],
      }],
      laboratoryOrders: [{
        id: 'order-l',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        items: [{ lineId: 'c', name: 'Test C', quantity: 1, status: 'approved' }],
      }],
      records: [
        {
          _id: 'bill-a',
          patientId: 'PAT-1',
          submissionId: 'SR-001',
          status: 'approved',
          workflowKind: 'pharmacy',
          workflowOrderId: 'order-p',
          workflowLineId: 'a',
          approvedBy: 'Reception',
          services: [{ serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
        },
        {
          _id: 'bill-c',
          patientId: 'PAT-1',
          submissionId: 'SR-001',
          status: 'pending',
          workflowKind: 'laboratory',
          workflowOrderId: 'order-l',
          workflowLineId: 'c',
          departmentCleared: true,
          services: [{ serviceName: 'Test C', quantity: 1, unitPrice: 20, total: 20 }],
        },
      ],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].status, 'partly_charged')
    assert.equal(requests[0].items[0].receptionCode, 'approved')
    assert.equal(requests[0].items[1].receptionCode, 'pending')
    assert.equal(requests[0].items[1].approveMode, 'record')
    assert.notEqual(requests[0].items[0].billingRecordId, requests[0].items[1].billingRecordId)
  })

  it('does not mix a different patient into the request', () => {
    const requests = buildReceptionRequests({
      submissions: [submission, { ...submission, submissionId: 'SR-002', patientId: 'PAT-2', submittedByName: 'Nurse B' }],
      pharmacyOrders: [
        { id: 'order-1', submissionId: 'SR-001', patientId: 'PAT-1', items: [pharmacyItem('a', 'Medicine A', 'fulfilled', 1)] },
        { id: 'order-2', submissionId: 'SR-002', patientId: 'PAT-2', items: [pharmacyItem('z', 'Medicine Z', 'fulfilled', 1)] },
      ],
      records: [
        {
          _id: 'bill-1',
          patientId: 'PAT-1',
          submissionId: 'SR-001',
          status: 'pending',
          workflowKind: 'pharmacy',
          workflowOrderId: 'order-1',
          workflowLineId: 'a',
          departmentCleared: true,
          services: [{ serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
        },
        {
          _id: 'bill-2',
          patientId: 'PAT-2',
          submissionId: 'SR-002',
          status: 'pending',
          workflowKind: 'pharmacy',
          workflowOrderId: 'order-2',
          workflowLineId: 'z',
          departmentCleared: true,
          services: [{ serviceName: 'Medicine Z', quantity: 1, unitPrice: 8, total: 8 }],
        },
      ],
    })
    assert.equal(requests.length, 2)
    assert.equal(requests.find((row) => row.id === 'SR-001').items.some((item) => item.description === 'Medicine Z'), false)
    assert.equal(requests.find((row) => row.id === 'SR-002').patientId, 'PAT-2')
  })

  it('adds a newly released item to the existing parent instead of a second request', () => {
    const before = buildReceptionRequests({
      submissions: [submission],
      pharmacyOrders: [{
        id: 'order-p',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        items: [
          pharmacyItem('a', 'Medicine A', 'fulfilled', 1),
          pharmacyItem('b', 'Medicine B', 'pending', 0),
        ],
      }],
      records: [{
        _id: 'bill-a',
        patientId: 'PAT-1',
        submissionId: 'SR-001',
        status: 'approved',
        workflowKind: 'pharmacy',
        workflowOrderId: 'order-p',
        workflowLineId: 'a',
        services: [{ serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
      }],
    })
    const after = buildReceptionRequests({
      submissions: [submission],
      pharmacyOrders: [{
        id: 'order-p',
        submissionId: 'SR-001',
        patientId: 'PAT-1',
        items: [
          pharmacyItem('a', 'Medicine A', 'fulfilled', 1, 'approved'),
          pharmacyItem('b', 'Medicine B', 'partial', 1),
        ],
      }],
      records: [
        before[0].items[0] && {
          _id: 'bill-a',
          patientId: 'PAT-1',
          submissionId: 'SR-001',
          status: 'approved',
          workflowKind: 'pharmacy',
          workflowOrderId: 'order-p',
          workflowLineId: 'a',
          services: [{ serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
        },
        {
          _id: 'bill-b',
          patientId: 'PAT-1',
          submissionId: 'SR-001',
          status: 'pending',
          workflowKind: 'pharmacy',
          workflowOrderId: 'order-p',
          workflowLineId: 'b',
          departmentCleared: true,
          services: [{ serviceName: 'Medicine B', quantity: 1, unitPrice: 12, total: 12 }],
        },
      ],
    })
    assert.equal(before.length, 1)
    assert.equal(after.length, 1)
    assert.equal(after[0].id, 'SR-001')
    assert.equal(after[0].eligibleCount, 2)
    assert.equal(after[0].status, 'partly_charged')
  })

  it('does not mark a request complete while a department item is still undecided', () => {
    const status = parentReceptionStatus([
      { eligibility: 'eligible', receptionCode: 'approved' },
      { eligibility: 'awaiting_department', receptionCode: 'ineligible' },
    ])
    assert.equal(status, 'partly_charged')
    assert.equal(parentReceptionStatus([
      { eligibility: 'eligible', receptionCode: 'pending' },
      { eligibility: 'eligible', receptionCode: 'rejected' },
    ]), 'partly_decided')
    assert.equal(parentReceptionStatus([
      { eligibility: 'eligible', receptionCode: 'approved' },
      { eligibility: 'eligible', receptionCode: 'rejected' },
    ]), 'completed')
  })

  it('charges one other-service line without treating its sibling as the same decision', () => {
    const requests = buildReceptionRequests({
      submissions: [submission],
      records: [{
        _id: 'rec-1',
        patientId: 'PAT-1',
        submissionId: 'SR-001',
        status: 'pending',
        submittedBy: 'Nurse A',
        services: [
          { id: 'dressing', category: 'Nursing', serviceName: 'Dressing', quantity: 1, unitPrice: 15, total: 15 },
          { id: 'oxygen', category: 'Nursing', serviceName: 'Oxygen', quantity: 1, unitPrice: 40, total: 40 },
        ],
      }],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].items[0].approveMode, 'line')
    assert.equal(requests[0].items[1].approveMode, 'line')
    assert.notEqual(requests[0].items[0].lineId, requests[0].items[1].lineId)
    assert.equal(requests[0].actionRecordId, '')
  })

  it('shows accepted quantity and credit on a pharmacy return request', () => {
    const requests = buildReceptionRequests({
      records: [{
        _id: 'ret-1',
        patientId: 'PAT-1',
        recordName: 'Patient A',
        status: 'pending',
        recordType: 'return',
        workflowKind: 'pharmacy-return',
        workflowOrderId: 'order-p',
        workflowLineId: 'a',
        billingKey: 'pharmacy-return:order-p:ret-entry',
        submittedBy: 'Pharmacist',
        recordedAt: '2026-10-31T08:00:00.000Z',
        services: [],
        returnItems: [{
          id: 'ret-entry',
          serviceName: 'Amoxicillin',
          quantity: 3,
          unitPrice: 12,
          unit: 'tab',
          total: 36,
        }],
      }],
      patients: [{ patientId: 'PAT-1', name: 'Patient A', _id: 'stay-1' }],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].wholeRecord, true)
    assert.equal(requests[0].items.length, 1)
    assert.equal(requests[0].items[0].description, 'Amoxicillin')
    assert.equal(requests[0].items[0].quantity, 3)
    assert.equal(requests[0].items[0].unit, 'tab')
    assert.equal(requests[0].items[0].total, -36)
    assert.equal(requests[0].pendingAmount, -36)
    assert.equal(requests[0].items[0].approveMode, 'record')
    assert.equal(requests[0].actionRecordId, 'ret-1')
    assert.equal(requests[0].id, 'PAT-1:pharmacy-returns')
  })

  it('groups later pharmacy returns for the same patient on one request', () => {
    const requests = buildReceptionRequests({
      records: [
        {
          _id: 'ret-1',
          patientId: 'PAT-1',
          recordName: 'Patient A',
          status: 'pending',
          recordType: 'return',
          workflowKind: 'pharmacy-return',
          workflowLineId: 'a',
          billingKey: 'pharmacy-return:order-p:one',
          submittedBy: 'Pharmacist A',
          recordedAt: '2026-10-31T08:00:00.000Z',
          services: [],
          returnItems: [{ serviceName: 'Amoxicillin', quantity: 2, unitPrice: 10, total: 20 }],
        },
        {
          _id: 'ret-2',
          patientId: 'PAT-1',
          recordName: 'Patient A',
          status: 'pending',
          recordType: 'return',
          workflowKind: 'pharmacy-return',
          workflowLineId: 'b',
          billingKey: 'pharmacy-return:order-q:two',
          submittedBy: 'Pharmacist B',
          recordedAt: '2026-10-31T09:00:00.000Z',
          services: [],
          returnItems: [{ serviceName: 'Paracetamol', quantity: 1, unitPrice: 8, total: 8 }],
        },
        {
          _id: 'ret-other',
          patientId: 'PAT-2',
          recordName: 'Patient B',
          status: 'pending',
          recordType: 'return',
          workflowKind: 'pharmacy-return',
          workflowLineId: 'c',
          billingKey: 'pharmacy-return:order-r:three',
          submittedBy: 'Pharmacist A',
          recordedAt: '2026-10-31T09:30:00.000Z',
          services: [],
          returnItems: [{ serviceName: 'Ibuprofen', quantity: 1, unitPrice: 15, total: 15 }],
        },
      ],
      patients: [
        { patientId: 'PAT-1', name: 'Patient A', _id: 'stay-1' },
        { patientId: 'PAT-2', name: 'Patient B', _id: 'stay-2' },
      ],
    })
    const forA = requests.find((row) => row.patientId === 'PAT-1')
    const forB = requests.find((row) => row.patientId === 'PAT-2')
    assert.equal(requests.length, 2)
    assert.equal(forA.items.length, 2)
    assert.equal(forA.totalItems, 2)
    assert.equal(forA.pendingAmount, -28)
    assert.equal(forA.actionRecordId, '')
    assert.equal(forA.submittedAt, '2026-10-31T09:00:00.000Z')
    assert.equal(forA.submittedBy, 'Pharmacist B')
    assert.deepEqual(forA.items.map((item) => item.description).sort(), ['Amoxicillin', 'Paracetamol'])
    assert.equal(forB.items.length, 1)
    assert.equal(forB.items[0].description, 'Ibuprofen')
  })
})
