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
import managerRoutes from '../routes/manager.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'mgrdis-test-'
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

describe('GET /api/manager/discharged-patients HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  let manager
  let reportsOnly
  let today

  async function makeUser({ permissions, slug }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole: 'Manager',
      description: 'Temporary manager discharged-patients test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Manager Dis ${slug}`,
      role: 'Manager',
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
    app.use('/api/manager', managerRoutes)

    manager = await makeUser({ permissions: ['reports.view', 'payments.view'], slug: 'full' })
    reportsOnly = await makeUser({ permissions: ['reports.view'], slug: 'reports' })
    today = todayStr()

    await Patient.create({
      patientId: `${PREFIX}OUT`,
      name: 'Discharged Stay',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'discharged',
      room: 'General Ward',
      bed: 'GW-04',
      dischargeCompletedAt: new Date(),
      dischargeFinalCharges: 4500,
      dischargeFinalDeposits: 1000,
      dischargeFinalBalance: -3500,
    })
    await Patient.create({
      patientId: `${PREFIX}PEND`,
      name: 'Still Pending',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'pending-discharge',
      dischargeFinalCharges: 9999,
      dischargeFinalDeposits: 0,
      dischargeFinalBalance: -9999,
    })
    await Patient.create({
      patientId: `${PREFIX}IN`,
      name: 'Still Admitted',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
    })
    await ServiceRecord.create({
      patientId: `${PREFIX}OUT`,
      recordName: 'Pending after snapshot',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 8000, total: 8000 }],
    })
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('requires payments.view and reports only completed discharge snapshots', async () => {
    const forbidden = await request(app, `/api/manager/discharged-patients?view=day&date=${today}`, sign(reportsOnly))
    assert.equal(forbidden.status, 403)

    const res = await request(app, `/api/manager/discharged-patients?view=day&date=${today}`, sign(manager))
    assert.equal(res.status, 200)
    const ours = res.body.rows.filter((row) => row.patientId?.startsWith(PREFIX))
    assert.equal(ours.length, 1)
    assert.equal(ours[0].patientId, `${PREFIX}OUT`)
    assert.equal(ours[0].grandTotal, 4500)
    assert.equal(ours[0].deposits, 1000)
    assert.equal(ours[0].remaining, -3500)
    assert.ok(ours[0].dischargedAt)
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}PEND`), false)
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}IN`), false)
    assert.equal(res.body.summary.grandTotal >= 4500, true)
  })
})
