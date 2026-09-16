import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPatientProfile, splitApprovedTotals } from './patientProfile.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

describe('splitApprovedTotals', () => {
  it('keeps pending and rejected records off approved totals', () => {
    const totals = splitApprovedTotals([
      { status: 'approved', recordType: 'daily', services: [{ total: 400 }] },
      { status: 'pending', recordType: 'daily', services: [{ total: 900 }] },
      { status: 'rejected', recordType: 'daily', services: [{ total: 50 }] },
      { status: 'approved', recordType: 'return', returnItems: [{ total: 80 }] },
      { status: 'pending', recordType: 'return', returnItems: [{ total: 200 }] },
    ])
    assert.equal(totals.approvedCharges, 400)
    assert.equal(totals.approvedReturns, 80)
  })
})

describe('buildPatientProfile', () => {
  it('forbids callers without patients.view', async () => {
    await assert.rejects(
      () => buildPatientProfile({ role: roleWith(['payments.view']) }, 'PAT-1'),
      (err) => err.status === 403
    )
  })

  it('omits financial fields without payments.view and keeps remaining aligned when money is allowed', async () => {
    const patient = {
      patientId: 'PAT-1',
      name: 'Ann',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: '2026-03-01',
      status: 'admitted',
      depositTotal: 5000,
      room: 'General Ward',
      bed: 'GW-01',
      isCreditPatient: true,
      admissionPaymentMode: 'credit',
    }
    const records = [
      {
        _id: { toString: () => 'r1' },
        patientId: 'PAT-1',
        recordName: 'CBC',
        date: '2026-03-02',
        status: 'approved',
        recordType: 'daily',
        services: [{ serviceName: 'CBC', quantity: 1, unitPrice: 400, total: 400 }],
        returnItems: [],
        submittedBy: 'Nurse',
      },
      {
        _id: { toString: () => 'r2' },
        patientId: 'PAT-1',
        recordName: 'Pending',
        date: '2026-03-02',
        status: 'pending',
        recordType: 'daily',
        services: [{ serviceName: 'Skip', quantity: 1, unitPrice: 900, total: 900 }],
        returnItems: [],
        submittedBy: 'Nurse',
      },
    ]
    const deps = {
      Patient: { findOne: () => patient },
      ServiceRecord: { find: () => ({ sort: () => records }) },
      Deposit: { find: () => ({ sort: () => [{ _id: { toString: () => 'd1' }, date: '2026-03-01', amount: 5000, method: 'Cash', receivedBy: 'Sara' }] }) },
      RoomAssignment: { find: () => ({ sort: () => [] }) },
      MaternityBaby: { findOne: async () => null },
      listAssignments: async () => [{ id: 'doc-1', doctorName: 'Dr Lee', specialty: 'Surgeon', visitPrice: 800, status: 'active' }],
      calcPatientBalance: async () => ({ totalCharges: 400, depositTotal: 5000, balance: 4600 }),
    }

    const nurse = await buildPatientProfile({ role: roleWith(['patients.view']) }, 'PAT-1', deps)
    assert.equal(nurse.finance, null)
    assert.equal(nurse.deposits, undefined)
    assert.equal(nurse.records[0].amount, undefined)
    assert.equal(nurse.records[0].services[0].unitPrice, undefined)
    assert.equal(nurse.doctors[0].visitPrice, undefined)
    assert.equal(nurse.credit, null)
    assert.equal(nurse.patient.isCreditPatient, undefined)

    const desk = await buildPatientProfile(
      { role: roleWith(['patients.view', 'payments.view', 'credit.view']) },
      'PAT-1',
      deps
    )
    assert.equal(desk.finance.remaining, 4600)
    assert.equal(desk.finance.approvedCharges, 400)
    assert.equal(desk.finance.deposits, 5000)
    assert.equal(desk.records[0].amount, 400)
    assert.equal(desk.deposits.length, 1)
    assert.equal(desk.credit.isCreditPatient, true)
    assert.equal(desk.doctors[0].visitPrice, 800)
  })
})
