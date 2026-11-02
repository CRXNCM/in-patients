import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildManagerPharmacyReport, summarizePharmacyUsage } from './managerPharmacy.js'

function roleWith(permissions) {
  return { slug: 'manager', active: true, permissions }
}

describe('manager pharmacy usage', () => {
  it('ranks medicines that went out and patients who received the most', () => {
    const usage = summarizePharmacyUsage([
      {
        patientId: 'PAT-1',
        patientName: 'Ada',
        admissionId: 'stay-1',
        requestedAt: '2026-11-01T08:00:00.000Z',
        items: [
          {
            lineId: 'a',
            name: 'Ceftriaxone 1g',
            unit: 'vial',
            unitPrice: 280,
            suppliedQuantity: 6,
            history: [
              { action: 'handed_over', quantity: 4, at: '2026-11-02T10:00:00.000Z' },
              { action: 'partial_handover', quantity: 2, at: '2026-11-03T10:00:00.000Z' },
            ],
          },
          {
            lineId: 'b',
            name: 'Paracetamol 500mg',
            unit: 'tab',
            unitPrice: 15,
            suppliedQuantity: 10,
            history: [{ action: 'handed_over', quantity: 10, at: '2026-11-02T11:00:00.000Z' }],
          },
        ],
        returns: [{ lineId: 'b', acceptedQuantity: 2, verifiedAt: '2026-11-04T09:00:00.000Z' }],
      },
      {
        patientId: 'PAT-2',
        patientName: 'Bona',
        admissionId: 'stay-2',
        requestedAt: '2026-11-02T08:00:00.000Z',
        items: [
          {
            lineId: 'c',
            name: 'Ceftriaxone 1g',
            unit: 'vial',
            unitPrice: 280,
            suppliedQuantity: 3,
            history: [{ action: 'handed_over', quantity: 3, at: '2026-11-02T12:00:00.000Z' }],
          },
        ],
        returns: [],
      },
    ], '2026-11-01', '2026-11-30')

    assert.equal(usage.topMedicines[0].name, 'Paracetamol 500mg')
    assert.equal(usage.topMedicines[0].issuedQuantity, 10)
    assert.equal(usage.topMedicines[0].returnedQuantity, 2)
    assert.equal(usage.topMedicines[0].netQuantity, 8)
    assert.equal(usage.topMedicines[1].name, 'Ceftriaxone 1g')
    assert.equal(usage.topMedicines[1].issuedQuantity, 9)
    assert.equal(usage.topMedicines[1].patientCount, 2)
    assert.equal(usage.topPatients[0].patientId, 'PAT-1')
    assert.equal(usage.topPatients[0].issuedQuantity, 16)
    assert.equal(usage.topPatients[0].medicineCount, 2)
    assert.equal(usage.summary.issuedQuantity, 19)
    assert.equal(usage.summary.returnedQuantity, 2)
    assert.equal(usage.summary.patients, 2)
  })

  it('ignores handovers outside the selected dates', () => {
    const usage = summarizePharmacyUsage([
      {
        patientId: 'PAT-1',
        patientName: 'Ada',
        items: [{
          lineId: 'a',
          name: 'Insulin',
          suppliedQuantity: 5,
          history: [
            { action: 'handed_over', quantity: 5, at: '2026-10-01T10:00:00.000Z' },
          ],
        }],
        returns: [],
      },
    ], '2026-11-01', '2026-11-30')
    assert.equal(usage.summary.issuedQuantity, 0)
    assert.equal(usage.topMedicines.length, 0)
  })

  it('requires reports.view and uses handover dates in the selected month', async () => {
    await assert.rejects(
      () => buildManagerPharmacyReport({ role: roleWith([]) }, { view: 'month', date: '2026-11-02' }, { today: '2026-11-02' }),
      (err) => err.status === 403
    )
    const report = await buildManagerPharmacyReport(
      { role: roleWith(['reports.view']) },
      { view: 'month', date: '2026-11-02' },
      {
        today: '2026-11-02',
        PharmacyOrder: {
          find: () => ({
            lean: async () => [{
              patientId: 'PAT-9',
              patientName: 'Nine',
              requestedAt: '2026-11-01T08:00:00.000Z',
              items: [{
                lineId: 'm1',
                name: 'Metformin 500mg',
                unit: 'tab',
                unitPrice: 15,
                suppliedQuantity: 8,
                history: [{ action: 'handed_over', quantity: 8, at: '2026-11-01T09:00:00.000Z' }],
              }],
              returns: [],
            }],
          }),
        },
      }
    )
    assert.equal(report.topMedicines[0].name, 'Metformin 500mg')
    assert.equal(report.topPatients[0].patientId, 'PAT-9')
    assert.equal(report.summary.issuedQuantity, 8)
  })
})
