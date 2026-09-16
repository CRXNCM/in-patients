import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveDepositsPeriod,
  averageDeposit,
  fillDailyRows,
  buildManagerDepositsReport,
} from './managerDeposits.js'

function roleWith(permissions, slug = 'custom') {
  return { slug, active: true, permissions }
}

describe('manager deposits period', () => {
  it('clamps a future day to today', () => {
    const period = resolveDepositsPeriod('day', '2026-09-20', '2026-09-16')
    assert.equal(period.date, '2026-09-16')
    assert.equal(period.startDate, '2026-09-16')
    assert.equal(period.endDate, '2026-09-16')
  })

  it('resolves a Monday–Sunday week from a midweek date', () => {
    const period = resolveDepositsPeriod('week', '2026-09-16', '2026-09-16')
    assert.equal(period.startDate, '2026-09-14')
    assert.equal(period.endDate, '2026-09-20')
  })

  it('resolves the local calendar month', () => {
    const period = resolveDepositsPeriod('month', '2026-09-16', '2026-09-16')
    assert.equal(period.startDate, '2026-09-01')
    assert.equal(period.endDate, '2026-09-30')
  })

  it('rejects an unknown view', () => {
    assert.throws(() => resolveDepositsPeriod('year', '2026-09-16', '2026-09-16'), /day, week, or month/)
  })
})

describe('manager deposits averages', () => {
  it('returns zero when there are no transactions', () => {
    assert.equal(averageDeposit(100, 0), 0)
  })

  it('fills every date in the window', () => {
    const rows = fillDailyRows(['2026-09-15', '2026-09-16'], [{ _id: '2026-09-16', total: 40, transactions: 2 }])
    assert.equal(rows[0].total, 0)
    assert.equal(rows[0].transactions, 0)
    assert.equal(rows[1].total, 40)
    assert.equal(rows[1].average, 20)
  })
})

describe('buildManagerDepositsReport', () => {
  it('forbids callers without payments.view', async () => {
    await assert.rejects(
      () =>
        buildManagerDepositsReport(
          { role: roleWith(['reports.view']) },
          { view: 'day', date: '2026-09-16' }
        ),
      (err) => err.status === 403
    )
  })

  it('returns day transactions from Deposit.date without frontend aggregation', async () => {
    const calls = []
    const Deposit = {
      aggregate: async (pipeline) => {
        calls.push(pipeline)
        if (pipeline[0]?.$match?.date === '2026-09-16') {
          return [
            {
              id: 'd1',
              date: '2026-09-16',
              amount: 150,
              method: 'Cash',
              receivedBy: 'Sara',
              createdAt: '2026-09-16T08:00:00.000Z',
              patientId: 'PAT-1',
              patientName: 'Ada',
            },
          ]
        }
        if (pipeline[0]?.$match?.date?.$gte) {
          return [{ total: 150, transactions: 1 }]
        }
        return []
      },
    }

    const data = await buildManagerDepositsReport(
      { role: roleWith(['reports.view', 'payments.view']) },
      { view: 'day', date: '2026-09-16' },
      { Deposit, today: '2026-09-16' }
    )
    assert.equal(data.summary.total, 150)
    assert.equal(data.summary.transactions, 1)
    assert.equal(data.summary.average, 150)
    assert.equal(data.rows[0].patientName, 'Ada')
    assert.equal(data.rows[0].method, 'Cash')
    assert.ok(calls.some((pipeline) => pipeline.some((stage) => stage.$lookup)))
  })

  it('returns daily totals for a week', async () => {
    const Deposit = {
      aggregate: async (pipeline) => {
        if (pipeline[0]?.$match?.date?.$gte && pipeline.some((stage) => stage.$group?._id === '$date')) {
          return [{ _id: '2026-09-16', total: 42, transactions: 2 }]
        }
        if (pipeline[0]?.$match?.date?.$gte) {
          return [{ total: 42, transactions: 2 }]
        }
        return []
      },
    }

    const data = await buildManagerDepositsReport(
      { role: roleWith(['payments.view']) },
      { view: 'week', date: '2026-09-16' },
      { Deposit, today: '2026-09-16' }
    )
    assert.equal(data.startDate, '2026-09-14')
    assert.equal(data.endDate, '2026-09-20')
    assert.equal(data.rows.length, 3)
    const wed = data.rows.find((row) => row.date === '2026-09-16')
    assert.equal(wed.total, 42)
    assert.equal(wed.average, 21)
    assert.equal(data.summary.average, 21)
    assert.equal(data.rows.at(-1).date, '2026-09-16')
  })
})
