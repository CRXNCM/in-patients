import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SERVICE_RECEIPT_DISCLAIMER,
  assembleRequests,
  buildConsolidatedReceipt,
  collectRequests,
  itemsFromSavedResponse,
  moneyKeys,
  originalItemsFromLines,
} from './serviceHistory.js'

describe('service history', () => {
  it('keeps the original submitted lines and strips prices', () => {
    const items = originalItemsFromLines([
      { category: 'Pharmacy', serviceName: 'Amoxicillin', quantity: 2, unit: 'tab', notes: 'After food', unitPrice: 12, total: 24 },
      { category: 'Laboratory', serviceName: 'CBC', quantity: 1, unitPrice: 80, total: 80 },
    ])
    assert.deepEqual(items, [
      { category: 'Pharmacy', name: 'Amoxicillin', quantity: 2, unit: 'tab', instructions: 'After food' },
      { category: 'Laboratory', name: 'CBC', quantity: 1, unit: '', instructions: '' },
    ])
    assert.deepEqual(moneyKeys(items), [])
  })

  it('groups one nurse submission and does not list its department orders again', () => {
    const requests = collectRequests({
      submissions: [{
        submissionId: 'sub-1',
        status: 'saved',
        submittedByName: 'Nurse Almaz',
        submittedAt: '2026-10-25T16:00:00.000Z',
        originalItems: [
          { category: 'Pharmacy', name: 'Diclofenac', quantity: 1 },
          { category: 'Laboratory', name: 'CBC', quantity: 1 },
          { category: 'Procedures', name: 'Dressing', quantity: 1 },
        ],
        response: { record: { id: 'rec-1' } },
      }],
      records: [{ id: 'rec-1', status: 'pending', services: [{ serviceName: 'Dressing', quantity: 9 }] }],
      pharmacyOrders: [{ submissionId: 'sub-1', status: 'pending', items: [{ name: 'Diclofenac' }] }],
      laboratoryOrders: [{ submissionId: 'sub-1', status: 'approved', items: [{ name: 'CBC' }] }],
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].id, 'sub-1')
    assert.equal(requests[0].count, 3)
    assert.match(requests[0].status, /Pharmacy pending/)
    assert.match(requests[0].status, /Laboratory approved/)
  })

  it('keeps each nurse request separate and does not rewrite an earlier submission', () => {
    const saved = itemsFromSavedResponse({
      pharmacyOrder: { items: [{ name: 'Diclofenac', requestedQuantity: 1, unitPrice: 4 }] },
      record: { services: [{ category: 'Procedures', serviceName: 'Dressing', quantity: 1, unitPrice: 50, total: 50 }] },
    })
    const entries = assembleRequests({
      submissions: [
        {
          submissionId: 'sub-late',
          status: 'saved',
          submittedByName: 'Nurse Almaz',
          staffAccount: 'almaz',
          submittedAt: '2026-10-25T11:30:00.000Z',
          response: {
            pharmacyOrder: { items: [{ name: 'Diclofenac', requestedQuantity: 1, unitPrice: 4 }] },
            record: { id: 'rec-1', services: [{ category: 'Procedures', serviceName: 'Dressing', quantity: 1, unitPrice: 50, total: 50 }] },
          },
        },
        {
          submissionId: 'sub-early',
          status: 'saved',
          submittedByName: 'Nurse Bethlehem',
          staffAccount: 'bethlehem',
          submittedAt: '2026-10-25T06:15:00.000Z',
          originalItems: [
            { category: 'Laboratory', name: 'CBC', quantity: 1 },
            { category: 'Pharmacy', name: 'Amoxicillin', quantity: 2 },
          ],
        },
      ],
      records: [{
        id: 'rec-1',
        status: 'pending',
        services: [{ serviceName: 'Dressing', quantity: 3, unitPrice: 50, total: 150 }],
        auditTrail: [{ at: '2026-10-25T12:00:00.000Z', by: 'Nurse Almaz', action: 'edited', note: 'Quantity changed to 3' }],
      }],
      pharmacyOrders: [],
      laboratoryOrders: [{ submissionId: 'sub-early', status: 'completed', items: [{ name: 'CBC' }] }],
    })
    assert.deepEqual(saved.map((item) => item.name), ['Diclofenac', 'Dressing'])
    const receipt = buildConsolidatedReceipt({
      patient: { name: 'Edilawit', patientId: 'PAT-002' },
      admission: { id: 'stay-1', admissionNumber: 'PAT-002', admissionDate: '2026-10-25' },
      requests: entries,
      generatedAt: '2026-10-25T18:00:00.000Z',
    })
    assert.deepEqual(receipt.requests.map((section) => section.requestId), ['sub-early', 'sub-late'])
    assert.equal(receipt.requests[0].submittedBy, 'Nurse Bethlehem')
    assert.equal(receipt.requests[0].staffAccount, 'bethlehem')
    assert.equal(receipt.requests[0].items[1].name, 'Amoxicillin')
    assert.equal(receipt.requests[0].items[1].quantity, 2)
    assert.match(receipt.requests[0].status, /Laboratory completed/)
    assert.equal(receipt.requests[1].submittedBy, 'Nurse Almaz')
    assert.equal(receipt.requests[1].items[1].quantity, 1)
    assert.equal(receipt.requests[1].audit.at(-1).action, 'edited')
    assert.equal(receipt.requests[1].audit.at(-1).requestId, 'sub-late')
    assert.equal(receipt.disclaimer, SERVICE_RECEIPT_DISCLAIMER)
    assert.equal(receipt.label, 'NON-FINANCIAL DOCUMENT')
    assert.deepEqual(moneyKeys(receipt), [])
  })

  it('marks a record without a snapshot as current stored lines', () => {
    const requests = collectRequests({
      submissions: [],
      records: [{
        id: 'rec-9',
        status: 'pending',
        submittedBy: 'Nurse Almaz',
        recordedAt: '2026-10-25T12:00:00.000Z',
        services: [{ category: 'Procedures', serviceName: 'Dressing', quantity: 1 }],
      }],
      pharmacyOrders: [],
      laboratoryOrders: [],
    })
    assert.equal(requests[0].id, 'record-rec-9')
    assert.equal(requests[0].evidence, 'stored-lines')
    const [entry] = assembleRequests({
      records: [{
        id: 'rec-9',
        status: 'pending',
        submittedBy: 'Nurse Almaz',
        recordedAt: '2026-10-25T12:00:00.000Z',
        services: [{ category: 'Procedures', serviceName: 'Dressing', quantity: 1 }],
      }],
    })
    const receipt = buildConsolidatedReceipt({ requests: [entry] })
    assert.match(receipt.requests[0].evidenceNote, /may have changed/)
    assert.equal(receipt.available, true)
    assert.equal(buildConsolidatedReceipt({ requests: [] }).available, false)
  })
})
