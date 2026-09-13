import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceStatus,
  buildReceptionDashboard,
  mapPendingRecord,
  PENDING_PANEL_LIMIT,
} from './receptionDashboard.js'

function roleWith(permissions, slug = 'custom') {
  return { slug, active: true, permissions }
}

function queryResult(rows) {
  return {
    sort() {
      return this
    },
    limit() {
      return this
    },
    select() {
      return this
    },
    lean: async () => rows,
  }
}

function makeDeps({
  admitted = 0,
  pendingDischarge = 0,
  pendingApprovals = 0,
  pending = [],
  inpatients = [],
  names = [],
  todayDeposits = 0,
  approvedByPatient = [],
  pendingByPatient = [],
  threshold = 3000,
  onRecordFind,
} = {}) {
  let recordFindCalls = 0
  return {
    today: '2026-09-12',
    Patient: {
      countDocuments: async (filter) => {
        if (filter.status === 'admitted') return admitted
        if (filter.status === 'pending-discharge') return pendingDischarge
        return 0
      },
      find: (filter) => {
        if (filter.status?.$in) return queryResult(inpatients)
        if (filter.patientId?.$in) return queryResult(names)
        return queryResult([])
      },
    },
    ServiceRecord: {
      countDocuments: async () => pendingApprovals,
      find: () => {
        recordFindCalls += 1
        if (onRecordFind) onRecordFind()
        return queryResult(pending)
      },
      aggregate: async (pipeline) => {
        const status = pipeline[0]?.$match?.status
        if (status === 'approved') return approvedByPatient
        if (status === 'pending') return pendingByPatient
        return []
      },
    },
    Deposit: {
      aggregate: async () => (todayDeposits ? [{ total: todayDeposits }] : []),
    },
    HospitalSettings: {
      findOne: () => ({
        lean: async () => ({ lowBalanceThreshold: threshold }),
      }),
    },
    _stats: () => ({ recordFindCalls }),
  }
}

const receptionPerms = [
  'patients.view',
  'admissions.edit',
  'payments.view',
  'credit.view',
]

describe('balanceStatus', () => {
  it('matches the existing 2 × threshold bands', () => {
    assert.equal(balanceStatus(6000, 3000), 'sufficient')
    assert.equal(balanceStatus(3000, 3000), 'low')
    assert.equal(balanceStatus(2999, 3000), 'critical')
  })
})

describe('mapPendingRecord', () => {
  it('maps a return as a pharmacy return with a negative amount', () => {
    const row = mapPendingRecord(
      {
        _id: { toString: () => 'r1' },
        patientId: 'P1',
        recordName: 'Return',
        recordType: 'return',
        status: 'pending',
        submittedBy: 'Nurse A',
        returnItems: [{ total: 40 }],
      },
      'Ada'
    )
    assert.equal(row.type, 'pharmacy_return')
    assert.equal(row.amount, -40)
    assert.equal(row.recordedBy, 'Nurse A')
    assert.equal(row.patientName, 'Ada')
  })
})

describe('buildReceptionDashboard', () => {
  it('keeps admitted and pending-discharge separate', async () => {
    const data = await buildReceptionDashboard(
      { role: roleWith(receptionPerms) },
      makeDeps({ admitted: 8, pendingDischarge: 3, pendingApprovals: 2 })
    )
    assert.equal(data.census.admitted, 8)
    assert.equal(data.census.pendingDischarge, 3)
    assert.equal(data.workQueue.pendingDischarges, 3)
    assert.equal(data.workQueue.pendingApprovals, 2)
    assert.notEqual(data.census.admitted, 11)
  })

  it('uses real today deposits and no blended revenue', async () => {
    const data = await buildReceptionDashboard(
      { role: roleWith(receptionPerms) },
      makeDeps({ todayDeposits: 275 })
    )
    assert.equal(data.finance.todayDeposits, 275)
    assert.equal(data.finance.todayRevenue, undefined)
  })

  it('limits the pending panel and counts all pending records', async () => {
    const pending = Array.from({ length: PENDING_PANEL_LIMIT }, (_, i) => ({
      _id: { toString: () => `p${i}` },
      patientId: 'P1',
      recordName: `Rec ${i}`,
      recordType: 'daily',
      status: 'pending',
      services: [{ total: 10 }],
    }))
    const data = await buildReceptionDashboard(
      { role: roleWith(receptionPerms) },
      makeDeps({ pendingApprovals: 12, pending, names: [{ patientId: 'P1', name: 'Ada' }] })
    )
    assert.equal(data.workQueue.pendingApprovals, 12)
    assert.equal(data.pendingRecords.length, PENDING_PANEL_LIMIT)
  })

  it('flags low balance with the existing 2 × threshold rule', async () => {
    const data = await buildReceptionDashboard(
      { role: roleWith(receptionPerms) },
      makeDeps({
        threshold: 3000,
        inpatients: [
          { patientId: 'LOW', name: 'Low', status: 'admitted', depositTotal: 1000 },
          { patientId: 'OK', name: 'Ok', status: 'admitted', depositTotal: 9000 },
        ],
        approvedByPatient: [
          { _id: 'LOW', total: 200 },
          { _id: 'OK', total: 100 },
        ],
      })
    )
    assert.equal(data.watchlist.lowBalanceCount, 1)
    assert.equal(data.currentInpatients.find((row) => row.id === 'LOW').balanceStatus, 'critical')
    assert.equal(data.currentInpatients.find((row) => row.id === 'OK').balanceStatus, 'sufficient')
  })

  it('omits money when payments and credit are missing', async () => {
    const data = await buildReceptionDashboard(
      { role: roleWith(['patients.view']) },
      makeDeps({
        todayDeposits: 999,
        inpatients: [{ patientId: 'A', name: 'Ann', status: 'admitted', depositTotal: 50 }],
        approvedByPatient: [{ _id: 'A', total: 10 }],
      })
    )
    assert.equal(data.finance, undefined)
    assert.equal(data.watchlist, undefined)
    assert.equal(data.currentInpatients[0].deposit, undefined)
    assert.equal(data.canReview, false)
  })

  it('does not query each inpatient balance with ServiceRecord.find', async () => {
    const deps = makeDeps({
      inpatients: [
        { patientId: 'A', name: 'A', status: 'admitted', depositTotal: 1 },
        { patientId: 'B', name: 'B', status: 'pending-discharge', depositTotal: 1 },
      ],
    })
    await buildReceptionDashboard({ role: roleWith(receptionPerms) }, deps)
    assert.equal(deps._stats().recordFindCalls, 1)
  })

  it('returns the queue for Super Admin', async () => {
    const data = await buildReceptionDashboard({ role: roleWith([], 'super-admin') }, makeDeps({ admitted: 1 }))
    assert.ok(data.census)
    assert.ok(data.finance)
    assert.equal(data.canReview, true)
  })
})
