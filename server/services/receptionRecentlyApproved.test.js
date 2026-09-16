import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReceptionRecentlyApproved,
  mapRecentlyApprovedRecord,
} from './receptionRecentlyApproved.js'

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
    limit() {
      return this
    },
    lean: async () => rows,
  }
}

describe('buildReceptionRecentlyApproved', () => {
  it('lists only approved records, newest review first', async () => {
    const ServiceRecord = {
      find: (filter) => {
        assert.equal(filter.status, 'approved')
        return queryResult([
          {
            _id: 'newer',
            patientId: 'A',
            recordName: 'CBC',
            recordType: 'daily',
            status: 'approved',
            services: [{ serviceName: 'CBC', total: 400 }],
            submittedBy: 'Nurse',
            approvedBy: 'Sara Bekele',
            reviewedAt: new Date('2026-03-02T10:00:00Z'),
          },
        ])
      },
    }
    const Patient = {
      find: () => queryResult([{ patientId: 'A', name: 'Ann' }]),
    }
    const data = await buildReceptionRecentlyApproved(
      { role: roleWith(['admissions.edit']) },
      {},
      { Patient, ServiceRecord }
    )
    assert.equal(data.summary.records, 1)
    assert.equal(data.rows[0].patientName, 'Ann')
    assert.equal(data.rows[0].approvedBy, 'Sara Bekele')
    assert.equal(data.rows[0].amount, 400)
    assert.equal(data.rows[0].type, 'daily_services')
  })

  it('treats approved returns as a negative amount', async () => {
    const row = mapRecentlyApprovedRecord(
      {
        _id: 'ret',
        patientId: 'A',
        recordType: 'return',
        status: 'approved',
        returnItems: [{ serviceName: 'Amoxicillin', total: 80 }],
        approvedBy: 'Sara Bekele',
        reviewedAt: new Date('2026-03-02T10:00:00Z'),
      },
      'Ann'
    )
    assert.equal(row.type, 'pharmacy_return')
    assert.equal(row.amount, -80)
    assert.equal(row.serviceSummary, 'Amoxicillin')
  })

  it('forbids callers without admissions.edit', async () => {
    await assert.rejects(
      () => buildReceptionRecentlyApproved({ role: roleWith(['patients.view']) }, {}),
      (err) => err.status === 403
    )
  })
})
