import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  approveLaboratoryItem,
  buildLaboratoryOrder,
  completeLaboratoryItem,
  processLaboratoryItem,
  rejectLaboratoryItem,
} from '../../frontend/src/services/laboratoryOrders.js'

const actor = { id: 'lab-1', name: 'Laboratory' }

function order() {
  return buildLaboratoryOrder({
    submissionId: 'lab-submission-1',
    stay: { patientId: 'PAT-1', patientName: 'Patient', admissionId: 'stay-1' },
    actor: { id: 'nurse-1', name: 'Nurse' },
    lines: [
      { id: 't1', serviceName: 'CBC', quantity: 1, unitPrice: 80 },
      { id: 't2', serviceName: 'FBS', quantity: 1, unitPrice: 40 },
    ],
    at: '2026-10-25T08:00:00.000Z',
  }).order
}

describe('laboratory item workflow', () => {
  it('approves one test without approving or billing the other', () => {
    const approved = approveLaboratoryItem(order(), actor, { lineId: 't1', clientActionId: 'approve-1' })
    assert.equal(approved.order.items.find((item) => item.lineId === 't1').status, 'approved')
    assert.equal(approved.order.items.find((item) => item.lineId === 't1').receptionStatus, 'not_sent')
    assert.equal(approved.order.items.find((item) => item.lineId === 't2').status, 'pending')
    assert.equal(approved.order.status, 'partially_decided')
  })

  it('requires processing before completion and allows an empty completion note', () => {
    const approved = approveLaboratoryItem(order(), actor, { lineId: 't1', clientActionId: 'approve-1' })
    const early = completeLaboratoryItem(approved.order, actor, { lineId: 't1', clientActionId: 'done-early', note: 'Finished' })
    assert.match(early.error, /processing/)
    const started = processLaboratoryItem(approved.order, actor, { lineId: 't1', clientActionId: 'process-1' })
    const blank = completeLaboratoryItem(started.order, actor, { lineId: 't1', clientActionId: 'done-blank', note: '' })
    assert.equal(blank.order.items.find((item) => item.lineId === 't1').status, 'completed')
    assert.equal(blank.order.items.find((item) => item.lineId === 't1').completionNote, '')
    const done = completeLaboratoryItem(started.order, actor, { lineId: 't1', clientActionId: 'done-1', note: 'Run finished' })
    assert.equal(done.order.items.find((item) => item.lineId === 't1').status, 'completed')
    assert.equal(done.order.items.find((item) => item.lineId === 't1').completionNote, 'Run finished')
    assert.equal(done.order.items.find((item) => item.lineId === 't1').receptionStatus, 'not_sent')
    assert.equal(done.order.items.find((item) => item.lineId === 't2').status, 'pending')
  })

  it('rejects only the selected pending test', () => {
    const rejected = rejectLaboratoryItem(order(), actor, { lineId: 't2', clientActionId: 'reject-1', reason: 'Not needed' })
    assert.equal(rejected.order.items.find((item) => item.lineId === 't2').status, 'rejected')
    assert.equal(rejected.order.items.find((item) => item.lineId === 't1').status, 'pending')
    const again = rejectLaboratoryItem(rejected.order, actor, { lineId: 't2', clientActionId: 'reject-2', reason: 'Still not needed' })
    assert.match(again.error, /pending/)
  })
})
