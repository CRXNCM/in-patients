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
import { Deposit } from '../models/Deposit.js'
import managerRoutes from '../routes/manager.routes.js'
import { todayStr, mondayWeekRange } from '../utils/dates.js'

const PREFIX = 'mgrdep-test-'
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

describe('GET /api/manager/deposits HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdDepositIds = []
  let manager
  let reportsOnly
  let today

  async function makeUser({ permissions, slug, accessRole = 'Manager', accessLabel = 'Manager' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary manager deposits test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Manager Dep ${slug}`,
      role: accessLabel,
      roleId: role._id,
      status: 'active',
    })
    createdUserIds.push(user._id)
    return user
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    app = express()
    app.use(express.json())
    app.use('/api/manager', managerRoutes)

    today = todayStr()
    manager = await makeUser({
      permissions: ['reports.view', 'payments.view'],
      slug: 'full',
    })
    reportsOnly = await makeUser({
      permissions: ['reports.view'],
      slug: 'reports-only',
    })

    const patient = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Deposit Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
    })
    createdPatientIds.push(patient._id)

    const todayDep = await Deposit.create({
      patientId: patient.patientId,
      amount: 300,
      method: 'Cash',
      date: today,
      receivedBy: 'Sara Bekele',
    })
    const extra = await Deposit.create({
      patientId: patient.patientId,
      amount: 150,
      method: 'Ebirr',
      date: today,
      receivedBy: 'Sara Bekele',
    })
    createdDepositIds.push(todayDep._id, extra._id)
  })

  after(async () => {
    await Deposit.deleteMany({ _id: { $in: createdDepositIds } })
    await Patient.deleteMany({ _id: { $in: createdPatientIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('rejects missing tokens and forbids reports.view without payments.view', async () => {
    const none = await request(app, '/api/manager/deposits')
    assert.equal(none.status, 401)
    const forbidden = await request(app, '/api/manager/deposits', sign(reportsOnly))
    assert.equal(forbidden.status, 403)
  })

  it('returns today’s deposit transactions and summary', async () => {
    const res = await request(app, `/api/manager/deposits?view=day&date=${today}`, sign(manager))
    assert.equal(res.status, 200)
    assert.ok(res.body.summary.transactions >= 2)
    assert.ok(res.body.summary.total >= 450)
    assert.equal(res.body.summary.average, res.body.summary.total / res.body.summary.transactions)
    const ours = res.body.rows.filter((row) => row.patientId === `${PREFIX}P1`)
    assert.equal(ours.length, 2)
    assert.ok(ours.every((row) => row.patientName === 'Deposit Patient'))
    assert.ok(ours.some((row) => row.method === 'Cash' && row.amount === 300))
    assert.equal(res.body.today, today)
  })

  it('returns a daily week aggregation without inventing amounts', async () => {
    const week = mondayWeekRange(today)
    const res = await request(app, `/api/manager/deposits?view=week&date=${today}`, sign(manager))
    assert.equal(res.status, 200)
    assert.equal(res.body.startDate, week.startDate)
    assert.equal(res.body.endDate, week.endDate)
    assert.ok(res.body.rows.length >= 1)
    assert.ok(res.body.rows.length <= 7)
    assert.equal(res.body.rows.at(-1).date, today)
    const todayRow = res.body.rows.find((row) => row.date === today)
    assert.ok(todayRow.total >= 450)
    assert.ok(todayRow.transactions >= 2)
  })

  it('clamps a future date and rejects an unknown view', async () => {
    const future = '2099-01-01'
    const clamped = await request(app, `/api/manager/deposits?view=day&date=${future}`, sign(manager))
    assert.equal(clamped.status, 200)
    assert.equal(clamped.body.date, today)
    const bad = await request(app, '/api/manager/deposits?view=year', sign(manager))
    assert.equal(bad.status, 400)
  })
})
