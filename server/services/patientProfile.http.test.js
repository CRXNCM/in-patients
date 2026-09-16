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
import patientRoutes from '../routes/patients.routes.js'
import { todayStr } from '../utils/dates.js'
import { calcPatientBalance } from './autoCharges.js'

const PREFIX = 'pprof-test-'
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

describe('GET /api/patients/:id/profile HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  let viewer
  let nurse
  let desk

  async function makeUser({ permissions, slug, accessRole = 'Nurse', accessLabel = 'Nurse' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary patient-profile test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Profile ${slug}`,
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
    app.use('/api/patients', patientRoutes)

    viewer = await makeUser({ permissions: [], slug: 'none', accessRole: 'Manager', accessLabel: 'Manager' })
    nurse = await makeUser({ permissions: ['patients.view'], slug: 'nurse' })
    desk = await makeUser({
      permissions: ['patients.view', 'payments.view', 'credit.view'],
      slug: 'desk',
      accessRole: 'Reception',
      accessLabel: 'Reception',
    })

    const today = todayStr()
    await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Profile Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 8000,
      room: 'General Ward',
      bed: 'GW-09',
    })
    await Deposit.create({
      patientId: `${PREFIX}P1`,
      amount: 8000,
      method: 'Cash',
      date: today,
      receivedBy: 'Sara Bekele',
      isInitial: true,
    })
    await ServiceRecord.create({
      patientId: `${PREFIX}P1`,
      recordName: 'Approved lab',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Helen Nurse',
      approvedBy: 'Sara Bekele',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}CBC`, quantity: 1, unitPrice: 300, total: 300 }],
    })
    await ServiceRecord.create({
      patientId: `${PREFIX}P1`,
      recordName: 'Pending lab',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Helen Nurse',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 900, total: 900 }],
    })
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('requires patients.view, hides money from nurses, and matches billing remaining for payments.view', async () => {
    const forbidden = await request(app, `/api/patients/${PREFIX}P1/profile`, sign(viewer))
    assert.equal(forbidden.status, 403)

    const missing = await request(app, `/api/patients/${PREFIX}MISSING/profile`, sign(nurse))
    assert.equal(missing.status, 404)

    const nurseView = await request(app, `/api/patients/${PREFIX}P1/profile`, sign(nurse))
    assert.equal(nurseView.status, 200)
    assert.equal(nurseView.body.patient.name, 'Profile Stay')
    assert.equal(nurseView.body.finance, null)
    assert.equal(nurseView.body.deposits, undefined)
    assert.equal(nurseView.body.records.some((row) => row.amount != null), false)

    const deskView = await request(app, `/api/patients/${PREFIX}P1/profile`, sign(desk))
    assert.equal(deskView.status, 200)
    const billed = await calcPatientBalance(`${PREFIX}P1`)
    assert.equal(deskView.body.finance.remaining, billed.balance)
    assert.equal(deskView.body.finance.approvedCharges, 300)
    assert.equal(deskView.body.deposits.length, 1)
    assert.ok(deskView.body.records.some((row) => row.status === 'pending'))
  })
})
