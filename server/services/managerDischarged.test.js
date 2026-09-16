import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildManagerDischargedReport, completedAtRange } from './managerDischarged.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

describe('completedAtRange', () => {
  it('uses local [start, end) bounds for the clamped period', () => {
    const range = completedAtRange({
      startDate: '2026-09-16',
      queryEnd: '2026-09-16',
      endDate: '2026-09-16',
    })
    assert.equal(range.start.getHours(), 0)
    assert.ok(range.end > range.start)
  })
})

describe('buildManagerDischargedReport', () => {
  it('forbids callers without payments.view', async () => {
    await assert.rejects(
      () => buildManagerDischargedReport({ role: roleWith(['reports.view']) }, { view: 'day', date: '2026-09-16' }),
      (err) => err.status === 403
    )
  })

  it('summarizes discharge snapshots and ignores live/pending records', async () => {
    const Patient = {
      aggregate: async (pipeline) => {
        const match = pipeline[0].$match
        assert.equal(match.status, 'discharged')
        assert.ok(match.dischargeCompletedAt.$gte)
        assert.ok(match.dischargeCompletedAt.$lt)
        return [
          {
            summary: [
              { patients: 2, grandTotal: 8000, deposits: 5000, remaining: -3000 },
            ],
            rows: [
              {
                patientId: 'PAT-1',
                name: 'Ann',
                admissionDate: '2026-09-01',
                dischargeCompletedAt: new Date('2026-09-16T10:00:00'),
                room: 'General Ward',
                bed: 'GW-01',
                dischargeFinalCharges: 5000,
                dischargeFinalDeposits: 2000,
                dischargeFinalBalance: -3000,
                status: 'discharged',
              },
              {
                patientId: 'PAT-2',
                name: 'Bekele',
                admissionDate: '2026-09-02',
                dischargeCompletedAt: new Date('2026-09-16T12:00:00'),
                dischargeFinalCharges: 3000,
                dischargeFinalDeposits: 3000,
                dischargeFinalBalance: 0,
                status: 'discharged',
              },
            ],
          },
        ]
      },
    }
    const data = await buildManagerDischargedReport(
      { role: roleWith(['payments.view']) },
      { view: 'day', date: '2026-09-16' },
      { Patient, today: '2026-09-16' }
    )
    assert.equal(data.summary.grandTotal, 8000)
    assert.equal(data.summary.deposits, 5000)
    assert.equal(data.summary.remaining, -3000)
    assert.equal(data.rows[0].grandTotal, 5000)
    assert.equal(data.rows[0].remaining, -3000)
    assert.equal(data.rows.every((row) => row.status === 'discharged'), true)
  })

  it('rejects an invalid period view', async () => {
    await assert.rejects(
      () =>
        buildManagerDischargedReport(
          { role: roleWith(['payments.view']) },
          { view: 'year', date: '2026-09-16' },
          { Patient: { aggregate: async () => [] }, today: '2026-09-16' }
        ),
      (err) => err.status === 400
    )
  })

  it('searches by patient name or ID', async () => {
    const Patient = {
      aggregate: async (pipeline) => {
        const match = pipeline[0].$match
        assert.ok(match.$or)
        assert.equal(match.$or.length, 2)
        return [{ summary: [], rows: [] }]
      },
    }
    const data = await buildManagerDischargedReport(
      { role: roleWith(['payments.view']) },
      { view: 'day', date: '2026-09-16', q: 'PAT-1' },
      { Patient, today: '2026-09-16' }
    )
    assert.equal(data.summary.patients, 0)
  })
})
