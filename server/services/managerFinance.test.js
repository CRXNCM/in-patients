import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildManagerChargesReport,
  buildManagerOutstandingReport,
  buildManagerCreditReport,
  categoryRecordMatch,
} from './managerFinance.js'

function roleWith(permissions, slug = 'custom') {
  return { slug, active: true, permissions }
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

describe('manager finance category match', () => {
  it('maps room, doctor, returns, and service categories', () => {
    assert.deepEqual(categoryRecordMatch('Room'), { autoType: 'room' })
    assert.deepEqual(categoryRecordMatch('Visiting Doctor'), { autoType: 'doctor' })
    assert.deepEqual(categoryRecordMatch('Pharmacy return'), { recordType: 'return' })
    assert.equal(categoryRecordMatch('Laboratory')['services.category'], 'Laboratory')
    assert.deepEqual(categoryRecordMatch(''), {})
  })
})

describe('buildManagerChargesReport', () => {
  it('forbids callers without payments.view', async () => {
    await assert.rejects(
      () => buildManagerChargesReport({ role: roleWith(['reports.view']) }, { view: 'day', date: '2026-09-16' }),
      (err) => err.status === 403
    )
  })

  it('sums only approved records and ignores pending pipelines', async () => {
    const matches = []
    const ServiceRecord = {
      aggregate: async (pipeline) => {
        matches.push(pipeline[0]?.$match || {})
        if (pipeline.some((stage) => stage.$group?._id === null)) {
          return [{ total: 800, records: 2 }]
        }
        return []
      },
    }
    const data = await buildManagerChargesReport(
      { role: roleWith(['payments.view']) },
      { view: 'day', date: '2026-09-16' },
      { ServiceRecord, today: '2026-09-16' }
    )
    assert.ok(matches.every((match) => match.status === 'approved'))
    assert.equal(data.summary.total, 800)
    assert.equal(data.summary.records, 2)
    assert.equal(data.summary.average, 400)
  })
})

describe('buildManagerOutstandingReport', () => {
  it('keeps only stays that currently owe money, highest first', async () => {
    const Patient = {
      find: () =>
        queryResult([
          { patientId: 'OWES', name: 'Owes', status: 'admitted', depositTotal: 1000, admissionDate: '2026-09-01' },
          { patientId: 'CREDIT', name: 'Credit', status: 'admitted', depositTotal: 9000, admissionDate: '2026-09-02' },
          { patientId: 'EVEN', name: 'Even', status: 'admitted', depositTotal: 500, admissionDate: '2026-09-03' },
        ]),
    }
    const ServiceRecord = {
      aggregate: async () => [
        { _id: 'OWES', totalCharges: 4000 },
        { _id: 'CREDIT', totalCharges: 1000 },
        { _id: 'EVEN', totalCharges: 500 },
      ],
    }
    const HospitalSettings = {
      findOne: () => ({ lean: async () => ({ lowBalanceThreshold: 3000 }) }),
    }
    const data = await buildManagerOutstandingReport(
      { role: roleWith(['payments.view', 'credit.view']) },
      {},
      { Patient, ServiceRecord, HospitalSettings }
    )
    assert.equal(data.summary.patients, 1)
    assert.equal(data.rows[0].patientId, 'OWES')
    assert.equal(data.rows[0].outstanding, 3000)
    assert.equal(data.summary.total, 3000)
  })
})

describe('buildManagerCreditReport', () => {
  it('uses isCreditPatient rather than a billing deficit', async () => {
    const captured = []
    const Patient = {
      find: (filter) => {
        captured.push(filter)
        return queryResult([
          {
            patientId: 'CR',
            name: 'Credit Stay',
            status: 'admitted',
            depositTotal: 4000,
            admissionPaymentMode: 'credit',
            requiredInitialDeposit: 15000,
            isCreditPatient: true,
            admissionDate: '2026-09-01',
          },
        ])
      },
    }
    const ServiceRecord = {
      aggregate: async () => [{ _id: 'CR', totalCharges: 2000 }],
    }
    const data = await buildManagerCreditReport(
      { role: roleWith(['credit.view']) },
      {},
      { Patient, ServiceRecord }
    )
    assert.equal(captured[0].isCreditPatient, true)
    assert.equal(data.summary.patients, 1)
    assert.equal(data.summary.creditOutstanding, 11000)
    assert.equal(data.rows[0].depositTotal, 4000)
    assert.equal(data.rows[0].totalCharges, 2000)
  })

  it('forbids callers without credit.view', async () => {
    await assert.rejects(
      () => buildManagerCreditReport({ role: roleWith(['payments.view', 'reports.view']) }, {}),
      (err) => err.status === 403
    )
  })
})
