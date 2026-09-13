import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildManagerDashboard,
  lastSevenLocalDates,
  localWeekdayShort,
  monthPrefix,
  outstandingForStay,
  isBalanceAttention,
  mapRecentAdmission,
  mapWatchlistPatient,
  TOP_LIMIT,
} from './managerDashboard.js'
import { shiftDate } from '../utils/dates.js'

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

function settingsModel(settings = { name: 'Test Hospital', lowBalanceThreshold: 3000 }) {
  return {
    findOne: () => ({
      lean: async () => settings,
    }),
  }
}

function pipelineKind(pipeline) {
  const raw = JSON.stringify(pipeline)
  if (raw.includes('"$in"') && raw.includes('patientId')) return 'chargesByPatient'
  if (raw.includes('Pharmacy')) return 'topMedicines'
  if (raw.includes('$unwind') && raw.includes('services.serviceName')) return 'topServices'
  if (raw.includes('$unwind') && raw.includes('category')) return 'categories'
  if (pipeline.some((stage) => stage.$group?._id === '$date')) return 'dailyCharges'
  const match = pipeline[0]?.$match || {}
  if (match.date === '2026-09-12') return 'chargesToday'
  if (match.date?.$regex === '^2026-09') return 'chargesMonth'
  return 'chargesOther'
}

function depositKind(pipeline) {
  const match = pipeline[0]?.$match || {}
  if (match.date === '2026-09-12') return 'today'
  if (match.date?.$regex === '^2026-09') return 'month'
  if (match.date?.$in) return 'daily'
  return 'other'
}

function makeDeps({
  admitted = 0,
  pendingDischarge = 0,
  admittedToday = 0,
  dischargedToday = 0,
  creditAdmissions = 0,
  inpatients = [],
  depositsToday = 0,
  depositsMonth = 0,
  chargesToday = 0,
  chargesMonth = 0,
  dailyCharges = [],
  dailyDeposits = [],
  categories = [],
  topServices = [],
  topMedicines = [],
  chargesByPatient = [],
  beds = [],
  settings,
  onRecordFind,
  onRecordAggregate,
} = {}) {
  let recordFindCalls = 0
  let recordAggregateCalls = 0
  let depositFindCalls = 0

  return {
    today: '2026-09-12',
    Patient: {
      countDocuments: async (filter) => {
        if (filter.status === 'admitted' && !filter.admissionDate) return admitted
        if (filter.status === 'pending-discharge') return pendingDischarge
        if (filter.admissionDate === '2026-09-12') return admittedToday
        if (filter.status === 'discharged') return dischargedToday
        if (filter.isCreditPatient) return creditAdmissions
        return 0
      },
      find: () => queryResult(inpatients),
    },
    Bed: {
      aggregate: async () => beds,
    },
    Deposit: {
      find: () => {
        depositFindCalls += 1
        return { sort() { return this }, lean: async () => [] }
      },
      aggregate: async (pipeline) => {
        const kind = depositKind(pipeline)
        if (kind === 'today') return depositsToday ? [{ total: depositsToday }] : []
        if (kind === 'month') return depositsMonth ? [{ total: depositsMonth }] : []
        if (kind === 'daily') {
          return dailyDeposits.map((row) => ({ _id: row.date, total: row.amount }))
        }
        return []
      },
    },
    ServiceRecord: {
      find: (...args) => {
        recordFindCalls += 1
        if (onRecordFind) onRecordFind(...args)
        return queryResult([])
      },
      aggregate: async (pipeline) => {
        recordAggregateCalls += 1
        if (onRecordAggregate) onRecordAggregate(pipeline)
        const kind = pipelineKind(pipeline)
        if (kind === 'chargesToday') return chargesToday ? [{ total: chargesToday }] : []
        if (kind === 'chargesMonth') return chargesMonth ? [{ total: chargesMonth }] : []
        if (kind === 'dailyCharges') {
          return dailyCharges.map((row) => ({ _id: row.date, total: row.amount }))
        }
        if (kind === 'categories') return categories
        if (kind === 'topServices') return topServices
        if (kind === 'topMedicines') return topMedicines
        if (kind === 'chargesByPatient') return chargesByPatient
        return []
      },
    },
    HospitalSettings: settingsModel(settings),
    _stats: () => ({ recordFindCalls, recordAggregateCalls, depositFindCalls }),
  }
}

const managerPerms = [
  'patients.view',
  'admissions.view',
  'payments.view',
  'credit.view',
  'reports.view',
]

describe('manager dashboard helpers', () => {
  it('builds seven local calendar dates ending on the injected today', () => {
    const dates = lastSevenLocalDates('2026-09-12')
    assert.deepEqual(dates, [
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ])
    assert.equal(dates[0], shiftDate('2026-09-12', -6))
    assert.equal(localWeekdayShort('2026-09-12'), 'Sat')
    assert.equal(monthPrefix('2026-09-12'), '2026-09')
  })

  it('computes outstanding as max(0, charges − deposits)', () => {
    assert.equal(outstandingForStay(5000, 2000), 0)
    assert.equal(outstandingForStay(1000, 4000), 3000)
  })

  it('uses the existing 2 × threshold attention rule', () => {
    assert.equal(isBalanceAttention(5999, 3000), true)
    assert.equal(isBalanceAttention(6000, 3000), false)
  })

  it('omits balances and phone from admission and watchlist rows', () => {
    const src = {
      patientId: 'PAT-1',
      name: 'Ada',
      admissionDate: '2026-09-12',
      room: 'General Ward',
      bed: 'GW-01',
      status: 'admitted',
      phone: '0911',
      depositTotal: 9000,
      totalCharges: 1000,
    }
    const recent = mapRecentAdmission(src)
    const watch = mapWatchlistPatient(src)
    assert.equal(recent.id, 'PAT-1')
    assert.equal(recent.patientName, 'Ada')
    assert.equal(recent.depositTotal, undefined)
    assert.equal(recent.phone, undefined)
    assert.equal(watch.depositTotal, undefined)
    assert.equal(watch.phone, undefined)
  })
})

describe('buildManagerDashboard', () => {
  it('returns the normalized dashboard structure', async () => {
    const deps = makeDeps({
      admitted: 4,
      pendingDischarge: 2,
      admittedToday: 1,
      dischargedToday: 1,
      depositsToday: 100,
      depositsMonth: 400,
      chargesToday: 50,
      chargesMonth: 200,
    })
    const data = await buildManagerDashboard({ role: roleWith(managerPerms) }, deps)
    assert.equal(typeof data.generatedAt, 'string')
    assert.ok(data.census)
    assert.ok(data.occupancy)
    assert.ok(data.finance)
    assert.ok(Array.isArray(data.chargesByCategory))
    assert.ok(Array.isArray(data.dailyChargesTrend))
    assert.ok(Array.isArray(data.topServices))
    assert.ok(Array.isArray(data.topMedicines))
    assert.ok(data.watchlist)
    assert.ok(Array.isArray(data.recentAdmissions))
    assert.equal(data.hospitalName, 'Test Hospital')
    assert.equal(data.stats, undefined)
    assert.equal(data.revenueByDepartment, undefined)
  })

  it('counts admitted separately from pending-discharge', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({ admitted: 7, pendingDischarge: 3 })
    )
    assert.equal(data.census.admitted, 7)
    assert.equal(data.census.pendingDischarge, 3)
    assert.notEqual(data.census.admitted, 10)
  })

  it('uses the injected local today for admissions and money totals', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        admittedToday: 2,
        depositsToday: 1500,
        depositsMonth: 8000,
        chargesToday: 900,
        chargesMonth: 4500,
        creditAdmissions: 17,
      })
    )
    assert.equal(data.census.admittedToday, 2)
    assert.equal(data.finance.deposits.today, 1500)
    assert.equal(data.finance.deposits.month, 8000)
    assert.equal(data.finance.approvedCharges.today, 900)
    assert.equal(data.finance.approvedCharges.month, 4500)
    assert.equal(data.finance.creditAdmissions, 17)
    assert.equal(data.finance.todayRevenue, undefined)
  })

  it('fills all seven local days on the approved-charges trend', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        dailyCharges: [{ date: '2026-09-12', amount: 250 }],
      })
    )
    assert.equal(data.dailyChargesTrend.length, 7)
    assert.equal(data.dailyChargesTrend[0].date, '2026-09-06')
    assert.equal(data.dailyChargesTrend[6].date, '2026-09-12')
    assert.equal(data.dailyChargesTrend[0].amount, 0)
    assert.equal(data.dailyChargesTrend[6].amount, 250)
    assert.equal(data.dailyChargesTrend[6].day, 'Sat')
    assert.equal(
      data.dailyChargesTrend.some((row) => row.revenue !== undefined),
      false
    )
  })

  it('groups approved charges by service category', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        categories: [
          { name: 'Pharmacy', amount: 12000 },
          { name: 'Laboratory', amount: 8000 },
        ],
      })
    )
    assert.deepEqual(data.chargesByCategory, [
      { name: 'Pharmacy', amount: 12000 },
      { name: 'Laboratory', amount: 8000 },
    ])
  })

  it('limits top services and medicines', async () => {
    const topServices = Array.from({ length: TOP_LIMIT }, (_, i) => ({
      name: `Svc ${i}`,
      count: i + 1,
      amount: 100 - i,
    }))
    const topMedicines = Array.from({ length: TOP_LIMIT }, (_, i) => ({
      name: `Med ${i}`,
      count: i + 1,
      amount: 50 - i,
    }))
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({ topServices, topMedicines })
    )
    assert.equal(data.topServices.length, TOP_LIMIT)
    assert.equal(data.topMedicines.length, TOP_LIMIT)
    assert.equal(data.topServices[0].amount, 100)
    assert.equal(data.topServices[0].revenue, undefined)
  })

  it('aggregates outstanding without per-patient record finds', async () => {
    const deps = makeDeps({
      inpatients: [
        { patientId: 'A', name: 'Ann', status: 'admitted', depositTotal: 1000, admissionDate: '2026-09-11' },
        { patientId: 'B', name: 'Ben', status: 'pending-discharge', depositTotal: 5000, admissionDate: '2026-09-10' },
      ],
      chargesByPatient: [
        { _id: 'A', totalCharges: 4000 },
        { _id: 'B', totalCharges: 1000 },
      ],
    })
    const data = await buildManagerDashboard({ role: roleWith(managerPerms) }, deps)
    assert.equal(data.finance.outstandingBalance, 3000)
    assert.equal(deps._stats().recordFindCalls, 0)
    assert.ok(deps._stats().recordAggregateCalls > 0)
    assert.equal(deps._stats().depositFindCalls, 0)
  })

  it('maps occupancy from existing bed statuses', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        beds: [
          { _id: 'occupied', count: 3 },
          { _id: 'available', count: 5 },
          { _id: 'maintenance', count: 1 },
          { _id: 'out_of_service', count: 1 },
        ],
      })
    )
    assert.equal(data.occupancy.occupied, 3)
    assert.equal(data.occupancy.available, 5)
    assert.equal(data.occupancy.maintenance, 1)
    assert.equal(data.occupancy.outOfService, 1)
    assert.equal(data.occupancy.total, 10)
    assert.equal(data.occupancy.percentage, 30)
  })

  it('flags balance attention with the configured threshold × 2', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        settings: { name: 'Test Hospital', lowBalanceThreshold: 2000 },
        inpatients: [
          { patientId: 'LOW', name: 'Low', status: 'admitted', depositTotal: 100, admissionDate: '2026-09-11' },
          { patientId: 'OK', name: 'Ok', status: 'admitted', depositTotal: 9000, admissionDate: '2026-09-10' },
        ],
        chargesByPatient: [
          { _id: 'LOW', totalCharges: 500 },
          { _id: 'OK', totalCharges: 100 },
        ],
      })
    )
    assert.equal(data.watchlist.lowBalanceCount, 1)
    assert.equal(data.watchlist.lowBalancePatients[0].id, 'LOW')
    assert.equal(data.watchlist.lowBalancePatients[0].remaining, -400)
    assert.equal(data.watchlist.lowBalancePatients[0].depositTotal, undefined)
  })

  it('omits finance and watchlist when those permissions are absent', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(['reports.view', 'patients.view']) },
      makeDeps({
        admitted: 1,
        depositsToday: 999,
        chargesToday: 888,
        inpatients: [{ patientId: 'A', name: 'Ann', status: 'admitted', depositTotal: 1, admissionDate: '2026-09-11' }],
        chargesByPatient: [{ _id: 'A', totalCharges: 50 }],
      })
    )
    assert.ok(data.census)
    assert.equal(data.finance, undefined)
    assert.equal(data.chargesByCategory, undefined)
    assert.equal(data.watchlist, undefined)
    assert.equal(data.recentAdmissions[0].patientName, 'Ann')
    assert.equal(data.recentAdmissions[0].deposit, undefined)
  })

  it('returns finance without outstanding when credit.view is missing', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(['reports.view', 'payments.view']) },
      makeDeps({ depositsToday: 10, chargesToday: 20 })
    )
    assert.equal(data.finance.deposits.today, 10)
    assert.equal(data.finance.approvedCharges.today, 20)
    assert.equal(data.finance.outstandingBalance, undefined)
    assert.equal(data.finance.creditAdmissions, undefined)
    assert.equal(data.watchlist, undefined)
    assert.equal(data.census, undefined)
  })

  it('returns every money and census section for Super Admin', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith([], 'super-admin') },
      makeDeps({ admitted: 1, depositsToday: 5, chargesToday: 6 })
    )
    assert.ok(data.census)
    assert.ok(data.finance)
    assert.equal(data.finance.deposits.today, 5)
    assert.ok(data.watchlist)
    assert.ok(data.occupancy)
  })

  it('does not return sensitive fields', async () => {
    const data = await buildManagerDashboard(
      { role: roleWith(managerPerms) },
      makeDeps({
        inpatients: [
          {
            patientId: 'A',
            name: 'Ann',
            status: 'admitted',
            depositTotal: 100,
            admissionDate: '2026-09-11',
            phone: '0911',
            password: 'secret',
          },
        ],
      })
    )
    const raw = JSON.stringify(data)
    assert.equal(raw.includes('0911'), false)
    assert.equal(raw.includes('secret'), false)
    assert.equal(raw.includes('password'), false)
    assert.equal(raw.includes('visitPrice'), false)
  })
})
