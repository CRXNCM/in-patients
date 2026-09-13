import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  occupancyFromStatusCounts,
  mapRecentAdmission,
  buildAdminDashboard,
  ADMIN_DASHBOARD_PERMISSIONS,
} from './adminDashboard.js'
import { localDayRange } from '../utils/dates.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

function countModel(n) {
  return { countDocuments: async () => n }
}

function makeDeps(overrides = {}) {
  const emptyFind = {
    sort() {
      return this
    },
    limit() {
      return this
    },
    select() {
      return this
    },
    lean: async () => [],
  }
  return {
    today: '2026-09-12',
    Patient: {
      countDocuments: async () => 0,
      find: () => emptyFind,
    },
    Bed: {
      countDocuments: async () => 0,
      aggregate: async () => [],
    },
    Department: countModel(0),
    Ward: countModel(0),
    Room: countModel(0),
    Doctor: countModel(0),
    User: countModel(0),
    ServiceCategory: { aggregate: async () => [] },
    Deposit: { aggregate: async () => [] },
    ...overrides,
  }
}

describe('occupancyFromStatusCounts', () => {
  it('uses all beds as the occupancy denominator', () => {
    const beds = occupancyFromStatusCounts({
      available: 5,
      occupied: 3,
      maintenance: 1,
      out_of_service: 1,
    })
    assert.equal(beds.total, 10)
    assert.equal(beds.unavailable, 2)
    assert.equal(beds.occupancyPercentage, 30)
  })

  it('returns 0% when there are no beds', () => {
    assert.equal(occupancyFromStatusCounts({}).occupancyPercentage, 0)
    assert.equal(occupancyFromStatusCounts({}).total, 0)
  })

  it('rounds to the nearest whole number', () => {
    assert.equal(occupancyFromStatusCounts({ occupied: 1, available: 2 }).occupancyPercentage, 33)
  })
})

describe('localDayRange', () => {
  it('covers the local calendar day as a half-open interval', () => {
    const { start, end } = localDayRange('2026-09-12')
    assert.equal(start.getFullYear(), 2026)
    assert.equal(start.getMonth(), 8)
    assert.equal(start.getDate(), 12)
    assert.equal(start.getHours(), 0)
    assert.equal(end.getTime(), new Date(2026, 8, 13, 0, 0, 0, 0).getTime())
  })
})

describe('mapRecentAdmission', () => {
  it('omits phone, balance, and credit unless allowed', () => {
    const row = mapRecentAdmission(
      {
        patientId: 'PAT-1',
        name: 'Ada',
        status: 'admitted',
        admissionDate: '2026-09-12',
        phone: '0911',
        room: 'General Ward',
        bed: 'GW-01',
        isCreditPatient: true,
      },
      { includeCredit: false }
    )
    assert.equal(row.patientId, 'PAT-1')
    assert.equal(row.admissionType, 'normal')
    assert.equal(row.isCreditPatient, undefined)
    assert.equal(row.phone, undefined)
    assert.equal(row.balance, undefined)
  })

  it('includes the stored credit flag when allowed', () => {
    const row = mapRecentAdmission(
      { patientId: 'PAT-2', name: 'B', status: 'admitted', admissionDate: '2026-09-01', isCreditPatient: true },
      { includeCredit: true }
    )
    assert.equal(row.isCreditPatient, true)
  })
})

describe('buildAdminDashboard section omission', () => {
  it('lists the real dashboard gate permissions', () => {
    assert.deepEqual(ADMIN_DASHBOARD_PERMISSIONS, [
      'patients.view',
      'beds.view',
      'rooms.view',
      'departments.view',
      'wards.view',
      'doctors.view',
      'users.view',
      'system.view_settings',
      'payments.view',
      'credit.view',
    ])
  })

  it('returns only census and recent admissions for patients.view', async () => {
    const payload = await buildAdminDashboard(
      { role: roleWith(['patients.view']) },
      makeDeps({
        Patient: {
          countDocuments: async (q) => {
            if (q.status === 'admitted') return 4
            if (q.status === 'pending-discharge') return 1
            if (q.admissionDate === '2026-09-12') return 2
            if (q.status === 'discharged') return 1
            return 99
          },
          find: () => ({
            sort() {
              return this
            },
            limit() {
              return this
            },
            select() {
              return this
            },
            lean: async () => [
              {
                patientId: 'PAT-9',
                name: 'Recent',
                status: 'admitted',
                admissionDate: '2026-09-12',
                admissionType: 'maternity',
                room: 'Delivery Room',
                bed: 'DR-01',
                isCreditPatient: true,
              },
            ],
          }),
        },
      })
    )
    assert.ok(payload.generatedAt)
    assert.deepEqual(payload.census, {
      currentlyAdmitted: 4,
      admittedToday: 2,
      pendingDischarge: 1,
      dischargedToday: 1,
    })
    assert.equal(payload.recentAdmissions.length, 1)
    assert.equal(payload.recentAdmissions[0].isCreditPatient, undefined)
    assert.equal(payload.beds, undefined)
    assert.equal(payload.setup, undefined)
    assert.equal(payload.catalog, undefined)
    assert.equal(payload.finance, undefined)
    assert.equal(payload.credit, undefined)
    assert.equal(payload.stats, undefined)
    assert.equal(payload.todayRevenue, undefined)
  })

  it('adds beds when the caller has beds.view or rooms.view', async () => {
    const bedModel = {
      countDocuments: async () => 10,
      aggregate: async () => [
        { _id: 'occupied', count: 3 },
        { _id: 'available', count: 5 },
        { _id: 'maintenance', count: 1 },
        { _id: 'out_of_service', count: 1 },
      ],
    }
    const bedsOnly = await buildAdminDashboard(
      { role: roleWith(['patients.view', 'beds.view']) },
      makeDeps({ Bed: bedModel })
    )
    assert.equal(bedsOnly.beds.occupancyPercentage, 30)
    assert.equal(bedsOnly.setup.beds, 10)
    assert.equal(bedsOnly.setup.rooms, undefined)

    const roomsOnly = await buildAdminDashboard(
      { role: roleWith(['rooms.view']) },
      makeDeps({ Bed: bedModel, Room: countModel(7) })
    )
    assert.ok(roomsOnly.beds)
    assert.equal(roomsOnly.setup.rooms, 7)
    assert.equal(roomsOnly.setup.beds, 10)
    assert.equal(roomsOnly.census, undefined)
  })

  it('omits finance zeros when payments.view is missing', async () => {
    const payload = await buildAdminDashboard(
      { role: roleWith(['credit.view']) },
      makeDeps({
        Patient: {
          countDocuments: async (q) => (q.isCreditPatient ? 3 : 0),
          find: () => ({
            sort() {
              return this
            },
            limit() {
              return this
            },
            select() {
              return this
            },
            lean: async () => [],
          }),
        },
        Deposit: { aggregate: async () => [{ total: 0 }] },
      })
    )
    assert.equal(payload.finance, undefined)
    assert.deepEqual(payload.credit, { creditAdmissions: 3 })
  })

  it('omits credit when only payments.view is granted', async () => {
    const payload = await buildAdminDashboard(
      { role: roleWith(['payments.view']) },
      makeDeps({
        Deposit: { aggregate: async () => [{ _id: null, total: 1500 }] },
      })
    )
    assert.deepEqual(payload.finance, { todayDeposits: 1500 })
    assert.equal(payload.credit, undefined)
    assert.equal(payload.census, undefined)
  })

  it('treats Super Admin as having every dashboard section', async () => {
    const payload = await buildAdminDashboard(
      { role: { slug: 'super-admin', active: true, permissions: [] } },
      makeDeps({
        Department: countModel(2),
        Ward: countModel(3),
        Room: countModel(4),
        Doctor: countModel(5),
        User: countModel(6),
        ServiceCategory: {
          aggregate: async () => [{ _id: null, serviceCategories: 8, priceLines: 21 }],
        },
        Deposit: { aggregate: async () => [{ _id: null, total: 100 }] },
        Bed: {
          countDocuments: async () => 4,
          aggregate: async () => [{ _id: 'available', count: 4 }],
        },
        Patient: {
          countDocuments: async () => 0,
          find: () => ({
            sort() {
              return this
            },
            limit() {
              return this
            },
            select() {
              return this
            },
            lean: async () => [],
          }),
        },
      })
    )
    assert.ok(payload.census)
    assert.ok(payload.beds)
    assert.deepEqual(payload.setup, {
      departments: 2,
      wards: 3,
      rooms: 4,
      beds: 4,
      doctors: 5,
      users: 6,
    })
    assert.deepEqual(payload.catalog, { serviceCategories: 8, priceLines: 21 })
    assert.deepEqual(payload.finance, { todayDeposits: 100 })
    assert.deepEqual(payload.credit, { creditAdmissions: 0 })
    assert.ok(Array.isArray(payload.recentAdmissions))
  })
})
