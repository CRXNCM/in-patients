import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { todayStr, mondayWeekRange, localMonthRange, clampToToday } from './dates.js'
import { resolveAdmissionDate, isValidDateString } from './validation.js'

const serverDir = path.join(import.meta.dirname, '..')

function localToday() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

describe('business day stamping', () => {
  it('defaults admission dates to the local calendar day', () => {
    assert.equal(resolveAdmissionDate(''), localToday())
    assert.equal(resolveAdmissionDate(undefined), todayStr())
  })

  it('accepts today as a valid date string in any timezone offset', () => {
    assert.equal(isValidDateString(localToday()), true)
    assert.equal(isValidDateString('2026-02-30'), false)
    assert.equal(isValidDateString('not-a-date'), false)
  })

  it('stamps records and deposits with the same local day the dashboards read', () => {
    // Dashboards match Deposit.date / ServiceRecord.date against todayStr().
    // A UTC-sliced write drifts by a day near midnight and silently zeroes them.
    const files = [
      'routes/patients.routes.js',
      'services/discharge.js',
      'utils/validation.js',
    ]
    for (const file of files) {
      const source = fs.readFileSync(path.join(serverDir, file), 'utf8')
      assert.equal(
        /toISOString\(\)\.slice\(0,\s*10\)/.test(source),
        false,
        `${file} must stamp business days with todayStr(), not a UTC slice`
      )
    }
  })
})

describe('local reporting windows', () => {
  it('builds a Monday–Sunday week', () => {
    const week = mondayWeekRange('2026-09-16')
    assert.equal(week.startDate, '2026-09-14')
    assert.equal(week.endDate, '2026-09-20')
    const month = localMonthRange('2026-09-16')
    assert.equal(month.startDate, '2026-09-01')
    assert.equal(month.endDate, '2026-09-30')
    assert.equal(clampToToday('2026-09-20', '2026-09-16'), '2026-09-16')
  })
})
