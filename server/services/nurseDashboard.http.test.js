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
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import nurseRoutes from '../routes/nurse.routes.js'

const PREFIX = 'nursedash-test-'
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

function assertNoFinancialPayload(body) {
  const raw = JSON.stringify(body)
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
  ]) {
    assert.equal(raw.includes(`"${key}"`), false, `unexpected financial key ${key}`)
  }
}

describe('GET /api/nurse/dashboard HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdRecordIds = []
  const createdAssignmentIds = []

  async function makeUser({ permissions, slug, accessRole = 'Nurse', accessLabel = 'Nurse', roleDoc, name }) {
    const role =
      roleDoc ||
      (await Role.create({
        name: `${PREFIX}${slug}`,
        slug: `${PREFIX}${slug}`,
        accessRole,
        description: 'Temporary nurse dashboard test role',
        permissions,
        active: true,
        system: false,
      }))
    if (!roleDoc) createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: name || `Nurse Dash ${slug}`,
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
    await ServiceRecord.deleteMany({
      $or: [{ patientId: { $regex: `^${PREFIX}` } }, { submittedBy: { $regex: `^${PREFIX}` } }],
    })
    await DoctorAssignment.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    app = express()
    app.use(express.json())
    app.use('/api/nurse', nurseRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ _id: { $in: createdRecordIds } })
    await DoctorAssignment.deleteMany({ _id: { $in: createdAssignmentIds } })
    await Patient.deleteMany({ _id: { $in: createdPatientIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await DoctorAssignment.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('rejects missing and invalid tokens', async () => {
    const none = await request(app, '/api/nurse/dashboard')
    assert.equal(none.status, 401)
    assert.equal(none.body.error, 'Unauthorized')

    const bad = await request(app, '/api/nurse/dashboard', 'not-a-jwt')
    assert.equal(bad.status, 401)
    assert.equal(bad.body.error, 'Invalid or expired token')
  })

  it('forbids an authenticated user without patients.view', async () => {
    const user = await makeUser({ permissions: ['reports.view'], slug: 'no-patients', accessRole: 'Manager', accessLabel: 'Manager' })
    const res = await request(app, '/api/nurse/dashboard', sign(user))
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'Forbidden')
  })

  it('returns operational nurse data for patients.view and scopes work to the caller', async () => {
    const nurse = await makeUser({ permissions: ['patients.view'], slug: 'nurse', name: `${PREFIX}Nurse A` })
    const other = await makeUser({ permissions: ['patients.view'], slug: 'other-nurse', name: `${PREFIX}Nurse B` })

    const admitted = await Patient.create({
      patientId: `${PREFIX}ADM`,
      name: 'Admitted Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: '2026-09-11',
      admissionType: 'normal',
      status: 'admitted',
      room: 'General Ward',
      bed: 'GW-01',
      depositTotal: 1500,
      isCreditPatient: true,
      requiredInitialDeposit: 2000,
    })
    const pending = await Patient.create({
      patientId: `${PREFIX}PD`,
      name: 'Pending Stay',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: '2026-09-10',
      status: 'pending-discharge',
      dischargeRequestedAt: new Date(),
      room: 'Private',
      bed: 'PR-02',
    })
    const discharged = await Patient.create({
      patientId: `${PREFIX}DIS`,
      name: 'Discharged Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: '2026-09-01',
      status: 'discharged',
      dischargeCompletedAt: new Date(),
    })
    createdPatientIds.push(admitted._id, pending._id, discharged._id)

    const minePending = await ServiceRecord.create({
      patientId: admitted.patientId,
      recordName: 'Nurse A pending',
      date: '2026-09-12',
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: nurse.name,
      recordedAt: new Date('2026-09-12T08:00:00.000Z'),
      services: [{ serviceName: 'Injection', quantity: 1, unitPrice: 40, total: 40 }],
    })
    const mineOlder = await ServiceRecord.create({
      patientId: pending.patientId,
      recordName: 'Nurse A older',
      date: '2026-09-11',
      status: 'approved',
      recordType: 'return',
      source: 'nurse',
      submittedBy: nurse.name,
      recordedAt: new Date('2026-09-11T08:00:00.000Z'),
    })
    const otherPending = await ServiceRecord.create({
      patientId: admitted.patientId,
      recordName: 'Nurse B pending',
      date: '2026-09-12',
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: other.name,
      recordedAt: new Date('2026-09-12T09:00:00.000Z'),
    })
    createdRecordIds.push(minePending._id, mineOlder._id, otherPending._id)

    const assignment = await DoctorAssignment.create({
      patientId: admitted.patientId,
      doctorId: new mongoose.Types.ObjectId().toString(),
      doctorNameSnapshot: 'Dr. Test',
      specialtySnapshot: 'Surgeon',
      visitPriceSnapshot: 750,
      effectiveFrom: '2026-09-11',
      status: 'active',
    })
    createdAssignmentIds.push(assignment._id)

    const res = await request(app, '/api/nurse/dashboard', sign(nurse))
    assert.equal(res.status, 200)

    const [expectedAdmitted, expectedPending, expectedMinePending] = await Promise.all([
      Patient.countDocuments({ status: 'admitted' }),
      Patient.countDocuments({ status: 'pending-discharge' }),
      ServiceRecord.countDocuments({ submittedBy: nurse.name, status: 'pending' }),
    ])
    assert.equal(res.body.census.admitted, expectedAdmitted)
    assert.equal(res.body.census.pendingDischarge, expectedPending)
    assert.notEqual(res.body.census.admitted, expectedAdmitted + expectedPending)
    assert.equal(res.body.workQueue.myPendingRecords, expectedMinePending)
    assert.equal(res.body.workQueue.pendingDischarge, expectedPending)

    const mineRow = res.body.recentSubmissions.find((row) => row.id === minePending._id.toString())
    assert.ok(mineRow)
    assert.equal(mineRow.patientName, 'Admitted Stay')
    assert.ok(res.body.recentSubmissions.every((row) => row.recordName !== 'Nurse B pending'))
    assert.ok(res.body.recentSubmissions.some((row) => row.id === minePending._id.toString()))
    assert.equal(
      res.body.recentSubmissions.some((row) => row.id === otherPending._id.toString()),
      false
    )
    assert.ok(res.body.recentSubmissions.length <= 6)

    assert.ok(res.body.needsAttention.every((row) => row.status === 'pending-discharge'))
    assert.ok(res.body.needsAttention.some((row) => row.patientId === pending.patientId))
    assert.equal(
      res.body.needsAttention.some((row) => row.patientId === admitted.patientId),
      false
    )

    assert.ok(res.body.currentInpatients.length <= 8)
    assert.ok(res.body.currentInpatients.every((row) => ['admitted', 'pending-discharge'].includes(row.status)))
    assert.equal(
      res.body.currentInpatients.some((row) => row.patientId === discharged.patientId),
      false
    )
    const admittedRow = res.body.currentInpatients.find((row) => row.patientId === admitted.patientId)
    if (admittedRow) {
      assert.equal(admittedRow.assignedDoctors[0].doctorName, 'Dr. Test')
      assert.equal(admittedRow.assignedDoctors[0].visitPrice, undefined)
    }

    assertNoFinancialPayload(res.body)
    assert.equal(res.body.beds, undefined)
    assert.equal(res.body.setup, undefined)
    assert.equal(res.body.catalog, undefined)
    assert.equal(res.body.finance, undefined)
    assert.equal(res.body.stats, undefined)
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
      name: `${PREFIX}Super`,
    })
    const res = await request(app, '/api/nurse/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.workQueue)
    assert.ok(Array.isArray(res.body.recentSubmissions))
    assert.ok(Array.isArray(res.body.needsAttention))
    assert.ok(Array.isArray(res.body.currentInpatients))
  })
})
