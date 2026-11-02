import test from 'node:test'
import assert from 'node:assert/strict'
import { groupLaboratoryPatients } from './laboratoryOrders.js'

test('groups laboratory orders by patient and keeps the latest stay details', () => {
  const rows = groupLaboratoryPatients([
    {
      patientId: 'PAT-001',
      patientName: 'Ada',
      admissionType: 'emergency-opd',
      ward: 'ER',
      requestedAt: '2026-10-01T08:00:00.000Z',
      items: [{ name: 'CBC', status: 'approved' }],
    },
    {
      patientId: 'PAT-001',
      patientName: 'Ada Lemma',
      admissionType: 'normal',
      ward: 'Medical',
      room: '201',
      bed: 'B1',
      requestedAt: '2026-11-01T08:00:00.000Z',
      items: [{ name: 'RBS', status: 'pending' }, { name: 'CBC', status: 'pending' }],
    },
    {
      patientId: 'PAT-002',
      patientName: 'Yonas',
      requestedAt: '2026-10-20T08:00:00.000Z',
      items: [{ name: 'LFT', status: 'approved' }],
    },
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0].patientId, 'PAT-001')
  assert.equal(rows[0].name, 'Ada Lemma')
  assert.equal(rows[0].ward, 'Medical')
  assert.equal(rows[0].requestCount, 2)
  assert.equal(rows[0].testCount, 3)
  assert.equal(rows[0].pendingTests, 2)
  assert.equal(rows[1].patientId, 'PAT-002')
  assert.equal(rows[1].pendingTests, 0)
})
