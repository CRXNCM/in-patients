import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignmentCoversDate,
  mergeDoctorVisitLines,
  buildDoctorVisitLine,
  chargeDatesForPatient,
  todayStr,
} from './autoCharges.js'
import { shiftDate } from '../utils/dates.js'

describe('charge date window', () => {
  it('does not create dates before admission or after today', () => {
    const today = todayStr()
    const admissionDate = shiftDate(today, -2)
    const dates = chargeDatesForPatient({ admissionDate }, shiftDate(today, 5), { range: true })
    assert.equal(dates[0], admissionDate)
    assert.equal(dates.at(-1), today)
    assert.ok(!dates.includes(shiftDate(admissionDate, -1)))
    assert.ok(!dates.includes(shiftDate(today, 1)))
  })

  it('defaults to a single in-range day so opening a patient does not backfill history', () => {
    const today = todayStr()
    const dates = chargeDatesForPatient({ admissionDate: shiftDate(today, -60) }, today)
    assert.deepEqual(dates, [today])
  })

  it('returns no dates when the requested day is before admission', () => {
    const today = todayStr()
    assert.deepEqual(chargeDatesForPatient({ admissionDate: today }, shiftDate(today, -2)), [])
  })
})

describe('doctor assignment coverage', () => {
  it('starts on the effective date and excludes the end date', () => {
    const assignment = { effectiveFrom: '2026-09-14', effectiveTo: '2026-09-16' }
    assert.equal(assignmentCoversDate(assignment, '2026-09-13'), false)
    assert.equal(assignmentCoversDate(assignment, '2026-09-14'), true)
    assert.equal(assignmentCoversDate(assignment, '2026-09-15'), true)
    assert.equal(assignmentCoversDate(assignment, '2026-09-16'), false)
  })

  it('keeps open assignments active', () => {
    const assignment = { effectiveFrom: '2026-09-12', effectiveTo: null }
    assert.equal(assignmentCoversDate(assignment, '2026-09-20'), true)
  })
})

describe('doctor visit snapshots', () => {
  it('does not overwrite an existing price snapshot', () => {
    const existing = [
      { doctorId: 'd1', unitPrice: 500, total: 500, serviceName: 'Dr. Hana — Daily Visit' },
    ]
    const desired = [
      { doctorId: 'd1', unitPrice: 700, total: 700, serviceName: 'Dr. Hana — Daily Visit' },
      { doctorId: 'd2', unitPrice: 800, total: 800, serviceName: 'Dr. Mohammed — Daily Visit' },
    ]
    const merged = mergeDoctorVisitLines(existing, desired)
    assert.equal(merged.length, 2)
    assert.equal(merged.find((l) => l.doctorId === 'd1').unitPrice, 500)
    assert.equal(merged.find((l) => l.doctorId === 'd2').unitPrice, 800)
  })

  it('builds a line from the assignment snapshot, not a live price', () => {
    const line = buildDoctorVisitLine({
      doctorId: 'abc',
      doctorNameSnapshot: 'Dr. Hana',
      specialtySnapshot: 'Internal Medicine',
      visitPriceSnapshot: 500,
    })
    assert.equal(line.unitPrice, 500)
    assert.equal(line.total, 500)
    assert.equal(line.doctorId, 'abc')
    assert.match(line.notes, /Internal Medicine/)
  })

  it('uses the settings daily doctor visit fee when the snapshot is missing', () => {
    const line = buildDoctorVisitLine(
      {
        doctorId: 'abc',
        doctorNameSnapshot: 'Dr. Hana',
        specialtySnapshot: 'Internal Medicine',
        visitPriceSnapshot: 0,
      },
      2000
    )
    assert.equal(line.unitPrice, 2000)
    assert.equal(line.total, 2000)
    assert.match(line.notes, /settings fallback 2000/)
  })
})
