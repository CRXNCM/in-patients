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
import receptionRoutes from '../routes/reception.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'rcpdash-test-'
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

describe('GET /api/reception/dashboard HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdRecordIds = []
  const createdDepositIds = []

  async function makeUser({ permissions, slug, accessRole = 'Reception', accessLabel = 'Reception', roleDoc }) {
    const role =
      roleDoc ||
      (await Role.create({
        name: `${PREFIX}${slug}`,
        slug: `${PREFIX}${slug}`,
        accessRole,
        description: 'Temporary reception dashboard test role',
        permissions,
        active: true,
        system: false,
      }))
    if (!roleDoc) createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Reception Dash ${slug}`,
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
    app = express()
    app.use(express.json())
    app.use('/api/reception', receptionRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ _id: { $in: createdRecordIds } })
    await Deposit.deleteMany({ _id: { $in: createdDepositIds } })
    await Patient.deleteMany({ _id: { $in: createdPatientIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('rejects missing tokens and forbids users without patients.view', async () => {
    const none = await request(app, '/api/reception/dashboard')
    assert.equal(none.status, 401)

    const user = await makeUser({ permissions: ['reports.view'], slug: 'no-patients', accessRole: 'Manager', accessLabel: 'Manager' })
    const res = await request(app, '/api/reception/dashboard', sign(user))
    assert.equal(res.status, 403)
  })

  it('returns real census, deposits, and pending records', async () => {
    const today = todayStr()
    const user = await makeUser({
      permissions: ['patients.view', 'admissions.edit', 'payments.view', 'credit.view'],
      slug: 'desk',
    })

    const host = await Patient.create({
      patientId: `${PREFIX}HOST`,
      name: 'Host Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: '2026-01-02',
      status: 'discharged',
      dischargeCompletedAt: new Date('2026-01-20T00:00:00.000Z'),
      depositTotal: 2000,
    })
    createdPatientIds.push(host._id)

    // Guarantees at least one pending-discharge stay so the census split below is meaningful.
    const leaving = await Patient.create({
      patientId: `${PREFIX}LEAVING`,
      name: 'Leaving Stay',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: '2026-01-05',
      status: 'pending-discharge',
      depositTotal: 1000,
    })
    createdPatientIds.push(leaving._id)

    const deposit = await Deposit.create({
      patientId: host.patientId,
      amount: 180,
      method: 'Cash',
      date: today,
      receivedBy: 'Test',
    })
    createdDepositIds.push(deposit._id)

    const rec = await ServiceRecord.create({
      patientId: host.patientId,
      recordName: 'Nurse day',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Nurse A',
      recordedAt: new Date(),
      services: [{ serviceName: 'Injection', quantity: 1, unitPrice: 40, total: 40 }],
    })
    createdRecordIds.push(rec._id)

    const res = await request(app, '/api/reception/dashboard', sign(user))
    assert.equal(res.status, 200)

    const [expectedAdmitted, expectedPending, expectedPendingRecords] = await Promise.all([
      Patient.countDocuments({ status: 'admitted' }),
      Patient.countDocuments({ status: 'pending-discharge' }),
      ServiceRecord.countDocuments({ status: 'pending' }),
    ])
    assert.equal(res.body.census.admitted, expectedAdmitted)
    assert.equal(res.body.census.pendingDischarge, expectedPending)
    assert.notEqual(res.body.census.admitted, expectedAdmitted + expectedPending)
    assert.equal(res.body.workQueue.pendingApprovals, expectedPendingRecords)
    assert.ok(res.body.pendingRecords.some((row) => row.id === rec._id.toString()))
    assert.ok(res.body.pendingRecords.length <= 4)

    const [depToday] = await Deposit.aggregate([
      { $match: { date: today } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    assert.equal(res.body.finance.todayDeposits, depToday?.total || 0)
    assert.ok(res.body.finance.todayDeposits >= 180)
    assert.equal(res.body.canReview, true)
    assert.equal(JSON.stringify(res.body).includes('125000'), false)
    assert.equal(JSON.stringify(res.body).includes('12%'), false)
  })

  it('returns the dashboard for Super Admin', async () => {
    const existing = await Role.findOne({ slug: 'super-admin', active: { $ne: false } })
    assert.ok(existing, 'seeded Super Admin role is required')
    const user = await makeUser({
      permissions: [],
      slug: 'super',
      accessRole: 'Admin',
      accessLabel: 'Admin',
      roleDoc: existing,
    })
    const res = await request(app, '/api/reception/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.workQueue)
  })
})
