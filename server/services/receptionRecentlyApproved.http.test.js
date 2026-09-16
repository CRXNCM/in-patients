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
import receptionRoutes from '../routes/reception.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'rprec-test-'
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

describe('GET /api/reception/recently-approved HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  let reception
  let viewOnly

  async function makeUser({ permissions, slug }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole: 'Reception',
      description: 'Temporary recently-approved test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Reception Rec ${slug}`,
      role: 'Reception',
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

    app = express()
    app.use(express.json())
    app.use('/api/reception', receptionRoutes)

    reception = await makeUser({
      permissions: ['admissions.edit', 'patients.view'],
      slug: 'desk',
    })
    viewOnly = await makeUser({
      permissions: ['patients.view'],
      slug: 'view',
    })

    const today = todayStr()
    const stay = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Approved Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
    })
    createdPatientIds.push(stay._id)

    const older = new Date('2026-01-01T08:00:00Z')
    const newer = new Date('2026-01-02T08:00:00Z')

    await ServiceRecord.create({
      patientId: stay.patientId,
      recordName: 'Approved CBC',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Helen Nurse',
      approvedBy: 'Sara Bekele',
      recordedAt: older,
      reviewedAt: newer,
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}CBC`, quantity: 1, unitPrice: 250, total: 250 }],
    })
    await ServiceRecord.create({
      patientId: stay.patientId,
      recordName: 'Still pending',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Helen Nurse',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 900, total: 900 }],
    })
    await ServiceRecord.create({
      patientId: stay.patientId,
      recordName: 'Rejected smear',
      date: today,
      status: 'rejected',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Helen Nurse',
      approvedBy: 'Sara Bekele',
      recordedAt: older,
      reviewedAt: newer,
      rejectionReason: 'Wrong patient',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}No`, quantity: 1, unitPrice: 50, total: 50 }],
    })
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('requires admissions.edit and returns only approved records', async () => {
    const forbidden = await request(app, '/api/reception/recently-approved', sign(viewOnly))
    assert.equal(forbidden.status, 403)

    const res = await request(app, '/api/reception/recently-approved', sign(reception))
    assert.equal(res.status, 200)
    const ours = res.body.rows.filter((row) => row.patientId?.startsWith(PREFIX))
    assert.equal(ours.length, 1)
    assert.equal(ours[0].recordName, 'Approved CBC')
    assert.equal(ours[0].amount, 250)
    assert.equal(ours[0].approvedBy, 'Sara Bekele')
    assert.equal(ours[0].patientName, 'Approved Stay')
    assert.ok(ours[0].reviewedAt)
  })
})
