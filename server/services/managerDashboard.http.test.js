import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import { Bed } from '../models/Bed.js'
import managerRoutes from '../routes/manager.routes.js'
import { todayStr, shiftDate } from '../utils/dates.js'
import { outstandingForStay } from './managerDashboard.js'

const PREFIX = 'mgrdash-test-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, token) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: 'application/json' }
    if (token !== undefined) headers.Authorization = token ? `Bearer ${token}` : ''
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

function assertNoSensitive(body) {
  const raw = JSON.stringify(body)
  assert.equal(raw.includes('password'), false)
  assert.equal(raw.includes('0911999888'), false)
  assert.equal(raw.includes('visitPriceSnapshot'), false)
}

describe('GET /api/manager/dashboard HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdRecordIds = []
  const createdDepositIds = []
  const createdBedIds = []

  async function makeUser({ permissions, slug, accessRole = 'Manager', accessLabel = 'Manager', roleDoc, name }) {
    const role =
      roleDoc ||
      (await Role.create({
        name: `${PREFIX}${slug}`,
        slug: `${PREFIX}${slug}`,
        accessRole,
        description: 'Temporary manager dashboard test role',
        permissions,
        active: true,
        system: false,
      }))
    if (!roleDoc) createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: name || `Manager Dash ${slug}`,
      role: accessLabel,
      roleId: role._id,
      status: 'active',
    })
    createdUserIds.push(user._id)
    return user
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ label: { $regex: `^${PREFIX}` } })
    app = express()
    app.use(express.json())
    app.use('/api/manager', managerRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ _id: { $in: createdRecordIds } })
    await Deposit.deleteMany({ _id: { $in: createdDepositIds } })
    await Bed.deleteMany({ _id: { $in: createdBedIds } })
    await Patient.deleteMany({ _id: { $in: createdPatientIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ label: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('rejects missing and invalid tokens', async () => {
    const none = await request(app, '/api/manager/dashboard')
    assert.equal(none.status, 401)
    assert.equal(none.body.error, 'Unauthorized')

    const bad = await request(app, '/api/manager/dashboard', 'not-a-jwt')
    assert.equal(bad.status, 401)
    assert.equal(bad.body.error, 'Invalid or expired token')
  })

  it('forbids a user without reports.view', async () => {
    const user = await makeUser({ permissions: ['patients.view', 'payments.view'], slug: 'no-reports' })
    const res = await request(app, '/api/manager/dashboard', sign(user))
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'Forbidden')
  })

  it('returns manager finance and census for the seeded permission set', async () => {
    const today = todayStr()
    const month = today.slice(0, 7)
    const manager = await makeUser({
      permissions: [
        'patients.view',
        'admissions.view',
        'payments.view',
        'credit.view',
        'reports.view',
      ],
      slug: 'manager',
    })

    const admitted = await Patient.create({
      patientId: `${PREFIX}ADM`,
      name: 'Admitted Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      phone: '0911999888',
      admissionDate: today,
      status: 'admitted',
      room: 'General Ward',
      bed: 'GW-01',
      depositTotal: 2000,
    })
    const pending = await Patient.create({
      patientId: `${PREFIX}PD`,
      name: 'Pending Stay',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: shiftDate(today, -2),
      status: 'pending-discharge',
      room: 'Private',
      bed: 'PR-02',
      depositTotal: 8000,
    })
    const discharged = await Patient.create({
      patientId: `${PREFIX}DIS`,
      name: 'Discharged Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: shiftDate(today, -10),
      status: 'discharged',
      dischargeCompletedAt: new Date(),
      depositTotal: 1000,
    })
    createdPatientIds.push(admitted._id, pending._id, discharged._id)

    const deposit = await Deposit.create({
      patientId: admitted.patientId,
      amount: 275,
      method: 'Cash',
      date: today,
      receivedBy: 'Test',
    })
    createdDepositIds.push(deposit._id)

    const lab = await ServiceRecord.create({
      patientId: admitted.patientId,
      recordName: 'Lab panel',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'nurse',
      services: [
        { category: `${PREFIX}Laboratory`, serviceName: `${PREFIX}CBC`, quantity: 1, unitPrice: 1200000, total: 1200000 },
        { category: 'Pharmacy', serviceName: `${PREFIX}Amox`, quantity: 2, unitPrice: 400000, total: 800000 },
      ],
    })
    const pendingRec = await ServiceRecord.create({
      patientId: admitted.patientId,
      recordName: 'Not approved',
      date: today,
      status: 'pending',
      recordType: 'daily',
      services: [{ category: `${PREFIX}Laboratory`, serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 999, total: 999 }],
    })
    createdRecordIds.push(lab._id, pendingRec._id)

    const occ = await Bed.create({
      label: `${PREFIX}OCC`,
      name: `${PREFIX}OCC`,
      nameKey: `${PREFIX}occ`,
      roomType: 'General Ward',
      dailyRate: 100,
      status: 'occupied',
    })
    const avail = await Bed.create({
      label: `${PREFIX}AVL`,
      name: `${PREFIX}AVL`,
      nameKey: `${PREFIX}avl`,
      roomType: 'General Ward',
      dailyRate: 100,
      status: 'available',
    })
    createdBedIds.push(occ._id, avail._id)

    const res = await request(app, '/api/manager/dashboard', sign(manager))
    assert.equal(res.status, 200)
    assertNoSensitive(res.body)

    const [expectedAdmitted, expectedPending, expectedAdmittedToday] = await Promise.all([
      Patient.countDocuments({ status: 'admitted' }),
      Patient.countDocuments({ status: 'pending-discharge' }),
      Patient.countDocuments({ admissionDate: today }),
    ])
    assert.equal(res.body.census.admitted, expectedAdmitted)
    assert.equal(res.body.census.pendingDischarge, expectedPending)
    assert.equal(res.body.census.admittedToday, expectedAdmittedToday)
    assert.notEqual(res.body.census.admitted, expectedAdmitted + expectedPending)

    const [depToday] = await Deposit.aggregate([
      { $match: { date: today } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const [depMonth] = await Deposit.aggregate([
      { $match: { date: { $regex: `^${month}` } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    assert.equal(res.body.finance.deposits.today, depToday?.total || 0)
    assert.equal(res.body.finance.deposits.month, depMonth?.total || 0)
    assert.ok(res.body.finance.deposits.today >= 275)

    const labBucket = res.body.chargesByCategory.find((row) => row.name === `${PREFIX}Laboratory`)
    assert.ok(labBucket)
    assert.equal(labBucket.amount, 1200000)

    assert.ok(res.body.dailyChargesTrend.length === 7)
    assert.equal(res.body.dailyChargesTrend[6].date, today)
    assert.ok(res.body.topServices.length <= 5)
    assert.ok(res.body.topMedicines.length <= 5)
    assert.ok(res.body.topServices.some((row) => row.name === `${PREFIX}CBC`))
    assert.ok(res.body.topMedicines.some((row) => row.name === `${PREFIX}Amox`))
    assert.equal(res.body.topServices.some((row) => row.name === `${PREFIX}Skip`), false)

    const bedGroups = await Bed.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    const occupied = bedGroups.find((row) => row._id === 'occupied')?.count || 0
    const total = bedGroups.reduce((s, row) => s + (row.count || 0), 0)
    assert.equal(res.body.occupancy.occupied, occupied)
    assert.equal(res.body.occupancy.total, total)

    const inpatients = await Patient.find({ status: { $in: ['admitted', 'pending-discharge'] } })
      .select('patientId depositTotal')
      .lean()
    const ids = inpatients.map((p) => p.patientId)
    const chargeRows = await ServiceRecord.aggregate([
      { $match: { status: 'approved', patientId: { $in: ids } } },
      {
        $addFields: {
          recordTotal: {
            $cond: [
              { $eq: ['$recordType', 'return'] },
              { $multiply: [-1, { $ifNull: [{ $sum: '$returnItems.total' }, 0] }] },
              { $ifNull: [{ $sum: '$services.total' }, 0] },
            ],
          },
        },
      },
      { $group: { _id: '$patientId', totalCharges: { $sum: '$recordTotal' } } },
    ])
    const chargeMap = Object.fromEntries(chargeRows.map((row) => [row._id, row.totalCharges]))
    const expectedOutstanding = inpatients.reduce(
      (sum, p) => sum + outstandingForStay(p.depositTotal, chargeMap[p.patientId] || 0),
      0
    )
    assert.equal(res.body.finance.outstandingBalance, expectedOutstanding)
    assert.ok(typeof res.body.watchlist.lowBalanceCount === 'number')
    assert.ok(res.body.recentAdmissions.every((row) => row.deposit === undefined))
    assert.equal(res.body.stats, undefined)

    const report = await request(app, '/api/manager/reports/daily', sign(manager))
    assert.equal(report.status, 200)
    assert.ok(report.body.title)
    assert.ok(Array.isArray(report.body.rows))
  })

  it('omits finance sections for reports.view without payments.view', async () => {
    const user = await makeUser({ permissions: ['reports.view', 'patients.view'], slug: 'reports-only' })
    const res = await request(app, '/api/manager/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.equal(res.body.finance, undefined)
    assert.equal(res.body.chargesByCategory, undefined)
    assert.equal(res.body.watchlist, undefined)
  })

  it('returns every section for Super Admin via slug bypass', async () => {
    const existing = await Role.findOne({ slug: 'super-admin', active: { $ne: false } })
    assert.ok(existing, 'seeded Super Admin role is required')
    const user = await makeUser({
      permissions: [],
      slug: 'super',
      accessRole: 'Admin',
      accessLabel: 'Admin',
      roleDoc: existing,
    })
    const res = await request(app, '/api/manager/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.finance)
    assert.ok(res.body.occupancy)
    assert.ok(res.body.watchlist)
  })
})
