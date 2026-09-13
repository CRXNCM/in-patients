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
import patientRoutes from './patients.routes.js'
import receptionRoutes from './reception.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'depdate-test-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, { token, method = 'GET', body } = {}) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await res.json().catch(() => ({}))
    return { status: res.status, body: payload }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('deposit business-day stamping HTTP', { skip: !hasDb }, () => {
  let app
  let user
  const created = { roles: [], users: [], patients: [], deposits: [] }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    const role = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      description: 'Temporary deposit date test role',
      permissions: ['patients.view', 'payments.create', 'payments.view'],
      active: true,
      system: false,
    })
    created.roles.push(role._id)

    user = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Deposit Date Desk',
      role: 'Reception',
      roleId: role._id,
      status: 'active',
    })
    created.users.push(user._id)

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
    app.use('/api/reception', receptionRoutes)
  })

  after(async () => {
    await Deposit.deleteMany({ _id: { $in: created.deposits } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ _id: { $in: created.patients } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('stamps a dateless deposit with the local day and counts it in today deposits', async () => {
    const today = todayStr()
    const patient = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Deposit Date Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 0,
      doctorVisitDisabled: true,
    })
    created.patients.push(patient._id)

    const token = sign(user)
    const before = await request(app, '/api/reception/dashboard', { token })
    assert.equal(before.status, 200)
    const baseline = before.body.finance.todayDeposits

    const posted = await request(app, `/api/patients/${patient.patientId}/deposits`, {
      token,
      method: 'POST',
      body: { amount: 250, method: 'Cash' },
    })
    assert.equal(posted.status, 201)

    const stored = await Deposit.findOne({ patientId: patient.patientId }).lean()
    created.deposits.push(stored._id)
    assert.equal(stored.date, today, 'deposit must be stamped with the local calendar day')

    const after = await request(app, '/api/reception/dashboard', { token })
    assert.equal(after.status, 200)
    assert.equal(after.body.finance.todayDeposits, baseline + 250)
  })
})
