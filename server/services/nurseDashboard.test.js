import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNurseDashboard,
  mapRecentSubmission,
  mapNeedsAttention,
  mapNurseDoctorAssignment,
  submitterName,
  CURRENT_INPATIENTS_LIMIT,
} from './nurseDashboard.js'

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
  myPendingRecords = 0,
  recent = [],
  needsAttention = [],
  inpatients = [],
  nameDocs = [],
  assignments = [],
} = {}) {
  const counts = []
  return {
    Patient: {
      countDocuments: async (filter) => {
        counts.push(filter)
        if (filter.status === 'admitted') return admitted
        if (filter.status === 'pending-discharge') return pendingDischarge
        return 0
      },
      find: (filter) => {
        if (filter.status === 'pending-discharge') return queryResult(needsAttention)
        if (filter.status?.$in) return queryResult(inpatients)
        if (filter.patientId?.$in) return queryResult(nameDocs)
        return queryResult([])
      },
    },
    ServiceRecord: {
      countDocuments: async (filter) => {
        counts.push(filter)
        return myPendingRecords
      },
      find: (filter) => queryResult(recent.filter((row) => !filter.submittedBy || row.submittedBy === filter.submittedBy)),
    },
    DoctorAssignment: {
      find: () => queryResult(assignments),
    },
    _counts: counts,
  }
}

function assertNoFinancialKeys(value) {
  const raw = JSON.stringify(value)
  for (const key of [
    'deposit',
    'deposits',
    'depositTotal',
    'outstandingDeposit',
    'totalCharges',
    'balance',
    'visitPrice',
    'visitPriceSnapshot',
    'isCreditPatient',
    'finance',
    'credit',
    'todayDeposits',
    'requiredInitialDeposit',
    'admissionPaymentMode',
  ]) {
    assert.equal(raw.includes(`"${key}"`), false, `unexpected financial key ${key}`)
  }
}

describe('submitterName', () => {
  it('uses the authenticated display name and ignores empty values', () => {
    assert.equal(submitterName({ name: 'Nurse Almaz Tsegaye' }), 'Nurse Almaz Tsegaye')
    assert.equal(submitterName({ name: '' }), null)
    assert.equal(submitterName({}), null)
  })
})

describe('map helpers strip money and keep operational fields', () => {
  it('maps a recent submission without service line prices', () => {
    const row = mapRecentSubmission(
      {
        _id: { toString: () => 'rec-1' },
        patientId: 'PAT-1',
        recordName: 'Day 1',
        recordType: 'daily',
        status: 'pending',
        recordedAt: new Date('2026-09-12T09:00:00.000Z'),
        source: 'nurse',
        services: [{ unitPrice: 50, total: 50 }],
      },
      'Abebe'
    )
    assert.deepEqual(row, {
      id: 'rec-1',
      patientId: 'PAT-1',
      patientName: 'Abebe',
      recordName: 'Day 1',
      type: 'daily_services',
      status: 'pending',
      recordedAt: '2026-09-12T09:00:00.000Z',
      source: 'nurse',
    })
    assertNoFinancialKeys(row)
  })

  it('maps doctor assignments without visit prices', () => {
    const row = mapNurseDoctorAssignment({
      _id: { toString: () => 'asg-1' },
      doctorId: 'doc-1',
      doctorNameSnapshot: 'Dr. Tesfaye',
      specialtySnapshot: 'Surgeon',
      visitPriceSnapshot: 800,
      subjectType: 'mother',
      babyId: null,
      status: 'active',
      effectiveFrom: '2026-09-12',
    })
    assert.equal(row.doctorName, 'Dr. Tesfaye')
    assert.equal(row.visitPrice, undefined)
    assertNoFinancialKeys(row)
  })
})

describe('buildNurseDashboard', () => {
  it('returns zeros and empty arrays when the hospital has no nurse work', async () => {
    const payload = await buildNurseDashboard({ name: 'Nurse One' }, makeDeps())
    assert.deepEqual(payload.census, { admitted: 0, pendingDischarge: 0 })
    assert.deepEqual(payload.workQueue, { myPendingRecords: 0, pendingDischarge: 0 })
    assert.deepEqual(payload.recentSubmissions, [])
    assert.deepEqual(payload.needsAttention, [])
    assert.deepEqual(payload.currentInpatients, [])
    assert.ok(payload.generatedAt)
    assert.equal(payload.finance, undefined)
    assert.equal(payload.credit, undefined)
    assert.equal(payload.deposits, undefined)
  })

  it('counts admitted separately from pending-discharge', async () => {
    const payload = await buildNurseDashboard(
      { name: 'Nurse One' },
      makeDeps({ admitted: 4, pendingDischarge: 2 })
    )
    assert.equal(payload.census.admitted, 4)
    assert.equal(payload.census.pendingDischarge, 2)
    assert.equal(payload.workQueue.pendingDischarge, 2)
    assert.notEqual(payload.census.admitted, payload.census.admitted + payload.census.pendingDischarge)
  })

  it('scopes myPendingRecords and recent submissions to the authenticated name', async () => {
    const deps = makeDeps({
      myPendingRecords: 2,
      recent: [
        {
          _id: { toString: () => 'mine' },
          patientId: 'PAT-1',
          recordName: 'Mine',
          recordType: 'return',
          status: 'approved',
          recordedAt: new Date('2026-09-12T10:00:00.000Z'),
          source: 'nurse',
          submittedBy: 'Nurse One',
        },
        {
          _id: { toString: () => 'other' },
          patientId: 'PAT-2',
          recordName: 'Other',
          recordType: 'daily',
          status: 'pending',
          recordedAt: new Date('2026-09-12T11:00:00.000Z'),
          source: 'nurse',
          submittedBy: 'Someone Else',
        },
      ],
      nameDocs: [{ patientId: 'PAT-1', name: 'Hana' }],
    })
    const payload = await buildNurseDashboard({ name: 'Nurse One' }, deps)
    assert.equal(payload.workQueue.myPendingRecords, 2)
    assert.equal(payload.recentSubmissions.length, 1)
    assert.equal(payload.recentSubmissions[0].id, 'mine')
    assert.equal(payload.recentSubmissions[0].patientName, 'Hana')
    assert.equal(payload.recentSubmissions[0].type, 'pharmacy_return')
    const pendingQuery = deps._counts.find((q) => q.submittedBy)
    assert.deepEqual(pendingQuery, { submittedBy: 'Nurse One', status: 'pending' })
  })

  it('does not query records when the user has no display name', async () => {
    let recordFindCalled = false
    const deps = makeDeps()
    deps.ServiceRecord.find = () => {
      recordFindCalled = true
      return queryResult([])
    }
    const payload = await buildNurseDashboard({ name: '' }, deps)
    assert.equal(payload.workQueue.myPendingRecords, 0)
    assert.deepEqual(payload.recentSubmissions, [])
    assert.equal(recordFindCalled, false)
  })

  it('lists only pending-discharge patients in needsAttention', async () => {
    const payload = await buildNurseDashboard(
      { name: 'Nurse One' },
      makeDeps({
        needsAttention: [
          {
            patientId: 'PAT-PD',
            name: 'Pending Patient',
            room: 'Ward A',
            bed: 'A-1',
            status: 'pending-discharge',
            admissionDate: '2026-09-10',
          },
        ],
      })
    )
    assert.equal(payload.needsAttention.length, 1)
    assert.equal(payload.needsAttention[0].status, 'pending-discharge')
    assert.deepEqual(payload.needsAttention[0], mapNeedsAttention(payload.needsAttention[0]))
    assert.ok(payload.needsAttention.every((row) => row.status === 'pending-discharge'))
  })

  it('limits current inpatients and attaches assignments without financial fields', async () => {
    const inpatients = Array.from({ length: 3 }, (_, i) => ({
      patientId: `PAT-${i + 1}`,
      name: `Patient ${i + 1}`,
      room: 'GW',
      bed: `G-${i + 1}`,
      status: i === 0 ? 'pending-discharge' : 'admitted',
      admissionDate: '2026-09-11',
      admissionType: 'maternity',
      depositTotal: 500,
      isCreditPatient: true,
    }))
    const payload = await buildNurseDashboard(
      { name: 'Nurse One' },
      makeDeps({
        inpatients,
        assignments: [
          {
            _id: { toString: () => 'asg-1' },
            patientId: 'PAT-1',
            doctorId: 'd1',
            doctorNameSnapshot: 'Dr. One',
            specialtySnapshot: 'Gynecologist',
            visitPriceSnapshot: 900,
            subjectType: 'mother',
            babyId: null,
            status: 'active',
            effectiveFrom: '2026-09-11',
          },
        ],
      })
    )
    assert.ok(payload.currentInpatients.length <= CURRENT_INPATIENTS_LIMIT)
    assert.equal(payload.currentInpatients[0].assignedDoctors[0].doctorName, 'Dr. One')
    assert.equal(payload.currentInpatients[0].assignedDoctors[0].visitPrice, undefined)
    assert.equal(payload.currentInpatients[0].depositTotal, undefined)
    assert.equal(payload.currentInpatients[0].isCreditPatient, undefined)
    assertNoFinancialKeys(payload)
    payload.currentInpatients.forEach((row) => {
      assert.ok(['admitted', 'pending-discharge'].includes(row.status))
      assert.deepEqual(Object.keys(row).sort(), [
        'admissionDate',
        'admissionType',
        'assignedDoctors',
        'bed',
        'name',
        'patientId',
        'room',
        'status',
      ])
    })
  })

  it('does not return admin or manager dashboard keys', async () => {
    const payload = await buildNurseDashboard({ name: 'Nurse One' }, makeDeps())
    assert.equal(payload.beds, undefined)
    assert.equal(payload.setup, undefined)
    assert.equal(payload.catalog, undefined)
    assert.equal(payload.recentAdmissions, undefined)
    assert.equal(payload.stats, undefined)
    assert.equal(payload.revenueByDepartment, undefined)
  })
})
