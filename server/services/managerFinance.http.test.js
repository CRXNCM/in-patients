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

const PREFIX = 'mgrfin-test-'
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

describe('GET /api/manager finance pages HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []
  const createdPatientIds = []
  const createdRecordIds = []
  let manager
  let paymentsOnly
  let today

  async function makeUser({ permissions, slug }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole: 'Manager',
      description: 'Temporary manager finance test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Manager Fin ${slug}`,
      role: 'Manager',
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
      permissions: ['reports.view', 'payments.view', 'credit.view'],
      slug: 'full',
    })
    paymentsOnly = await makeUser({
      permissions: ['reports.view', 'payments.view'],
      slug: 'pay',
    })

    const debtor = await Patient.create({
      patientId: `${PREFIX}OWES`,
      name: 'Finance Debtor',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 1000,
      room: 'General Ward',
      bed: 'GW-01',
    })
    const creditStay = await Patient.create({
      patientId: `${PREFIX}CR`,
      name: 'Finance Credit',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 4000,
      requiredInitialDeposit: 15000,
      admissionPaymentMode: 'credit',
      isCreditPatient: true,
      room: 'Private',
      bed: 'PR-01',
    })
    const surplus = await Patient.create({
      patientId: `${PREFIX}OK`,
      name: 'Finance Surplus',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      depositTotal: 20000,
    })
    createdPatientIds.push(debtor._id, creditStay._id, surplus._id)

    const approved = await ServiceRecord.create({
      patientId: debtor.patientId,
      recordName: 'Lab',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Nurse A',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}CBC`, quantity: 1, unitPrice: 5000, total: 5000 }],
    })
    const pending = await ServiceRecord.create({
      patientId: debtor.patientId,
      recordName: 'Pending lab',
      date: today,
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Nurse A',
      services: [{ category: 'Laboratory', serviceName: `${PREFIX}Skip`, quantity: 1, unitPrice: 9999, total: 9999 }],
    })
    const room = await ServiceRecord.create({
      patientId: surplus.patientId,
      recordName: 'Room',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'system',
      autoType: 'room',
      submittedBy: 'System',
      services: [{ category: 'Room', serviceName: 'General Ward - Daily Rate', quantity: 1, unitPrice: 800, total: 800 }],
    })
    createdRecordIds.push(approved._id, pending._id, room._id)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ _id: { $in: createdRecordIds } })
    await Patient.deleteMany({ _id: { $in: createdPatientIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('charges include approved records and exclude pending', async () => {
    const res = await request(app, `/api/manager/charges?view=day&date=${today}`, sign(manager))
    assert.equal(res.status, 200)
    assert.ok(res.body.summary.total >= 5800)
    const ours = res.body.rows.filter((row) => String(row.description || '').includes(PREFIX) || row.patientId?.startsWith(PREFIX))
    assert.equal(ours.some((row) => row.amount === 9999), false)
    assert.ok(res.body.rows.some((row) => row.chargeType === 'Room' || row.chargeType === 'Laboratory'))
  })

  it('outstanding lists only current debtors', async () => {
    const res = await request(app, '/api/manager/outstanding', sign(manager))
    assert.equal(res.status, 200)
    const ours = res.body.rows.filter((row) => row.patientId?.startsWith(PREFIX))
    assert.ok(ours.some((row) => row.patientId === `${PREFIX}OWES` && row.outstanding === 4000))
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}OK`), false)
    assert.equal(ours.every((row) => row.outstanding > 0), true)
  })

  it('credit patients require credit.view and use the credit flag', async () => {
    const forbidden = await request(app, '/api/manager/credit-patients', sign(paymentsOnly))
    assert.equal(forbidden.status, 403)
    const res = await request(app, '/api/manager/credit-patients', sign(manager))
    assert.equal(res.status, 200)
    const ours = res.body.rows.filter((row) => row.patientId?.startsWith(PREFIX))
    assert.ok(ours.some((row) => row.patientId === `${PREFIX}CR` && row.creditOutstanding === 11000))
    assert.equal(ours.some((row) => row.patientId === `${PREFIX}OWES`), false)
  })
})
