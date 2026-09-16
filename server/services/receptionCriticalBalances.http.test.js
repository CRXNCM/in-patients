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

const PREFIX = 'rpcrit-test-'
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

describe('GET /api/reception/critical-balances HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdRecordIds = []
  let reception
  let viewOnly

  async function makeUser({ permissions, slug }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole: 'Reception',
      description: 'Temporary critical-balances test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Reception Crit ${slug}`,
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
      permissions: ['patients.view', 'payments.view', 'credit.view'],
      slug: 'full',
    })
    viewOnly = await makeUser({
      permissions: ['patients.view'],
      slug: 'view',
    })

    const today = todayStr()
    const critical = await Patient.create({
      patientId: `${PREFIX}CRIT`,
      name: 'Critical Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 0,
      room: 'General Ward',
      bed: 'GW-01',
    })
    const healthy = await Patient.create({
      patientId: `${PREFIX}OK`,
      name: 'Healthy Stay',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 1_000_000,
      room: 'Private',
      bed: 'PR-01',
    })
    const discharged = await Patient.create({
      patientId: `${PREFIX}DIS`,
      name: 'Discharged Stay',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'discharged',
      depositTotal: 0,
    })
    createdPatientIds.push(critical._id, healthy._id, discharged._id)

    const approved = await ServiceRecord.create({
      patientId: critical.patientId,
      recordName: 'Approved charge',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'reception',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Charge`, quantity: 1, unitPrice: 100, total: 100 }],
    })
    const pending = await ServiceRecord.create({
      patientId: healthy.patientId,
      recordName: 'Pending only',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 50000, total: 50000 }],
    })
    createdRecordIds.push(approved._id, pending._id)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('requires payments.view and lists only critical current stays', async () => {
    const forbidden = await request(app, '/api/reception/critical-balances', sign(viewOnly))
    assert.equal(forbidden.status, 403)

    const res = await request(app, '/api/reception/critical-balances', sign(reception))
    assert.equal(res.status, 200)
    const ours = res.body.rows.filter((row) => row.patientId?.startsWith(PREFIX))
    const crit = ours.find((row) => row.patientId === `${PREFIX}CRIT`)
    assert.ok(crit)
    assert.equal(crit.remaining, -100)
    assert.equal(crit.totalCharges, 100)
    assert.equal(crit.depositTotal, 0)
    assert.equal(crit.balanceStatus, 'critical')
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}OK`), false)
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}DIS`), false)
    assert.ok(ours.every((row) => row.balanceStatus === 'critical'))
  })
})
