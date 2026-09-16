import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildReceptionCriticalBalances } from './receptionCriticalBalances.js'
import { balanceStatus } from './receptionDashboard.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

function queryResult(rows) {
  return {
    select() {
      return this
    },
    sort() {
      return this
    },
    lean: async () => rows,
  }
}

describe('buildReceptionCriticalBalances', () => {
  it('uses remaining < threshold (Patient Billing critical), not the 2× low band', async () => {
    const Patient = {
      find: () =>
        queryResult([
          { patientId: 'CRIT', name: 'Critical', status: 'admitted', depositTotal: 2000 },
          { patientId: 'LOW', name: 'Low', status: 'admitted', depositTotal: 4000 },
          { patientId: 'OK', name: 'Ok', status: 'admitted', depositTotal: 20000 },
          { patientId: 'OWES', name: 'Owes', status: 'pending-discharge', depositTotal: 1000 },
        ]),
    }
    const ServiceRecord = {
      aggregate: async () => [
        { _id: 'CRIT', total: 0 },
        { _id: 'LOW', total: 0 },
        { _id: 'OK', total: 100 },
        { _id: 'OWES', total: 5000 },
      ],
    }
    const HospitalSettings = {
      findOne: () => ({ lean: async () => ({ lowBalanceThreshold: 3000 }) }),
    }
    const data = await buildReceptionCriticalBalances(
      { role: roleWith(['patients.view', 'payments.view']) },
      {},
      { Patient, ServiceRecord, HospitalSettings }
    )
    assert.equal(balanceStatus(2000, 3000), 'critical')
    assert.equal(balanceStatus(4000, 3000), 'low')
    assert.deepEqual(
      data.rows.map((row) => row.patientId),
      ['OWES', 'CRIT']
    )
    assert.equal(data.rows[0].remaining, -4000)
    assert.equal(data.summary.patients, 2)
    assert.equal(data.threshold, 3000)
  })

  it('does not treat pending charges as part of remaining', async () => {
    const Patient = {
      find: () => queryResult([{ patientId: 'A', name: 'Ann', status: 'admitted', depositTotal: 20000 }]),
    }
    const ServiceRecord = {
      aggregate: async (pipeline) => {
        assert.equal(pipeline[0].$match.status, 'approved')
        return [{ _id: 'A', total: 100 }]
      },
    }
    const HospitalSettings = {
      findOne: () => ({ lean: async () => ({ lowBalanceThreshold: 3000 }) }),
    }
    const data = await buildReceptionCriticalBalances(
      { role: roleWith(['payments.view']) },
      {},
      { Patient, ServiceRecord, HospitalSettings }
    )
    assert.equal(data.summary.patients, 0)
  })

  it('forbids callers without payments.view', async () => {
    await assert.rejects(
      () => buildReceptionCriticalBalances({ role: roleWith(['patients.view']) }, {}),
      (err) => err.status === 403
    )
  })
})
