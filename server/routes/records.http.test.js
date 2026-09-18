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
import { ServiceCategory } from '../models/ServiceCategory.js'
import patientRoutes from './patients.routes.js'
import recordRoutes from './records.routes.js'
import { todayStr } from '../utils/dates.js'
import { calcPatientBalance } from '../services/autoCharges.js'

const PREFIX = 'record-edit-test-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function catalogLine(item, overrides = {}) {
  const price = Number(item.price)
  return {
    catalogItemId: String(item._id),
    category: 'Laboratory',
    serviceName: item.name,
    quantity: 1,
    unitPrice: price,
    total: price,
    ...overrides,
  }
}

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

describe('pending record PATCH HTTP', { skip: !hasDb }, () => {
  let app
  let nurse
  let outsider
  let reception
  let labA
  let labB
  let pharm
  const created = { roles: [], users: [], patients: [] }
  const patientId = `${PREFIX}P1`
  const billPatientId = `${PREFIX}BILL`

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    const lab = await ServiceCategory.findOne({ slug: 'laboratory' })
    const pharmacy = await ServiceCategory.findOne({ slug: 'pharmacy' })
    const labItems = (lab?.services || []).filter((s) => s.active !== false)
    const pharmItems = (pharmacy?.services || []).filter((s) => s.active !== false)
    if (labItems.length < 2 || !pharmItems.length) {
      throw new Error('Seed catalog needs at least two active laboratory items and one pharmacy item')
    }
    labA = labItems[0]
    labB = labItems[1]
    pharm = pharmItems[0]

    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      description: 'Temporary nurse record-edit role',
      permissions: ['patients.view', 'patients.edit', 'doctors.assign'],
      active: true,
      system: false,
    })
    const managerRole = await Role.create({
      name: `${PREFIX}mgr`,
      slug: `${PREFIX}mgr`,
      accessRole: 'Manager',
      description: 'Temporary manager without patient edit',
      permissions: ['reports.view'],
      active: true,
      system: false,
    })
    const receptionRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      description: 'Temporary reception record-review role',
      permissions: ['patients.view', 'patients.edit', 'admissions.edit'],
      active: true,
      system: false,
    })
    created.roles.push(nurseRole._id, managerRole._id, receptionRole._id)

    nurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: await bcrypt.hash('password', 8),
      name: 'Record Edit Nurse',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    outsider = await User.create({
      email: `${PREFIX}mgr@example.invalid`,
      username: `${PREFIX}mgr`,
      password: await bcrypt.hash('password', 8),
      name: 'Record Edit Manager',
      role: 'Manager',
      roleId: managerRole._id,
      status: 'active',
    })
    reception = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Record Edit Desk',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    created.users.push(nurse._id, outsider._id, reception._id)

    await Patient.create({
      patientId,
      name: 'Record Edit Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 20000,
    })
    await Patient.create({
      patientId: billPatientId,
      name: 'Record Billing Patient',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 20000,
    })

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
    app.use('/api/records', recordRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('rejects unauthenticated and forbidden updates', async () => {
    assert.equal((await request(app, '/api/records/000000000000000000000000', { method: 'PATCH', body: { services: [catalogLine(labA)] } })).status, 401)
    const res = await request(app, '/api/records/000000000000000000000000', {
      token: sign(outsider),
      method: 'PATCH',
      body: { services: [catalogLine(labA)] },
    })
    assert.equal(res.status, 403)
  })

  it('updates the same pending record and keeps it off the bill', async () => {
    const token = sign(nurse)
    const createdRecord = await request(app, `/api/patients/${patientId}/records`, {
      token,
      method: 'POST',
      body: { services: [catalogLine(labA)], source: 'nurse' },
    })
    assert.equal(createdRecord.status, 201)
    const id = createdRecord.body.id
    assert.equal(createdRecord.body.status, 'pending')

    const before = await calcPatientBalance(patientId)
    assert.equal(before.totalCharges, 0)

    const patched = await request(app, `/api/records/${id}`, {
      token,
      method: 'PATCH',
      body: { services: [catalogLine(labA), catalogLine(labB)] },
    })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.id, id)
    assert.equal(patched.body.status, 'pending')
    assert.equal(patched.body.services.length, 2)
    assert.ok(patched.body.auditTrail.some((entry) => entry.action === 'edited'))

    const count = await ServiceRecord.countDocuments({ patientId })
    assert.equal(count, 1)

    const after = await calcPatientBalance(patientId)
    assert.equal(after.totalCharges, 0)
    assert.equal(after.balance, 20000)
  })

  it('refuses to edit approved or automatic records', async () => {
    const token = sign(nurse)
    const createdRecord = await request(app, `/api/patients/${patientId}/records`, {
      token,
      method: 'POST',
      body: { services: [catalogLine(labA)], source: 'nurse' },
    })
    const id = createdRecord.body.id

    await ServiceRecord.updateOne({ _id: id }, { $set: { status: 'approved' } })
    const approved = await request(app, `/api/records/${id}`, {
      token,
      method: 'PATCH',
      body: { services: [catalogLine(labA, { unitPrice: Number(labA.price) + 10 })] },
    })
    assert.equal(approved.status, 400)

    const auto = await ServiceRecord.create({
      patientId,
      recordName: 'Room',
      date: todayStr(),
      status: 'approved',
      recordType: 'daily',
      source: 'system',
      autoType: 'room',
      autoGenerated: true,
      services: [{ category: 'Room Services', serviceName: 'General Ward - Daily Rate', quantity: 1, unitPrice: 1500, total: 1500 }],
      submittedBy: 'System',
    })
    const autoPatch = await request(app, `/api/records/${auto._id}`, {
      token,
      method: 'PATCH',
      body: { services: [catalogLine(labA)] },
    })
    assert.equal(autoPatch.status, 400)
  })

  it('ignores a nurse client sending source reception and stays pending', async () => {
    const before = await calcPatientBalance(patientId)
    const createdRecord = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: { services: [catalogLine(labB)], source: 'reception' },
    })
    assert.equal(createdRecord.status, 201)
    assert.equal(createdRecord.body.status, 'pending')
    assert.equal(createdRecord.body.source, 'nurse')
    const after = await calcPatientBalance(patientId)
    assert.equal(after.totalCharges, before.totalCharges)
  })

  it('lets reception approve and forbids nurse approve', async () => {
    const createdRecord = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: { services: [catalogLine(labA)], source: 'nurse' },
    })
    assert.equal(createdRecord.status, 201)
    const id = createdRecord.body.id
    const before = await calcPatientBalance(patientId)

    const nurseApprove = await request(app, `/api/records/${id}/approve`, {
      token: sign(nurse),
      method: 'POST',
      body: { note: 'should fail' },
    })
    assert.equal(nurseApprove.status, 403)

    const deskApprove = await request(app, `/api/records/${id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Daily record verified' },
    })
    assert.equal(deskApprove.status, 200)
    assert.equal(deskApprove.body.status, 'approved')
    const after = await calcPatientBalance(patientId)
    assert.equal(after.totalCharges, before.totalCharges + Number(labA.price))
  })

  it('keeps a pending catalog line off the bill through PATCH and bills the catalog price on approve', async () => {
    const start = await calcPatientBalance(billPatientId)
    assert.equal(start.totalCharges, 0)
    assert.equal(start.balance, 20000)

    const createdRecord = await request(app, `/api/patients/${billPatientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: { services: [catalogLine(labA, { unitPrice: 500, serviceName: 'Fake CBC' })], source: 'nurse' },
    })
    assert.equal(createdRecord.status, 201)
    assert.equal(createdRecord.body.status, 'pending')
    assert.equal(createdRecord.body.services[0].unitPrice, Number(labA.price))
    const id = createdRecord.body.id
    const afterCreate = await calcPatientBalance(billPatientId)
    assert.equal(afterCreate.totalCharges, 0)
    assert.equal(afterCreate.balance, 20000)

    const patched = await request(app, `/api/records/${id}`, {
      token: sign(nurse),
      method: 'PATCH',
      body: { services: [catalogLine(labA, { unitPrice: 800, serviceName: 'Still fake' })] },
    })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.status, 'pending')
    assert.equal(patched.body.id, id)
    assert.equal(patched.body.services[0].unitPrice, Number(labA.price))
    const afterPatch = await calcPatientBalance(billPatientId)
    assert.equal(afterPatch.totalCharges, 0)
    assert.equal(afterPatch.balance, 20000)
    assert.equal(await ServiceRecord.countDocuments({ patientId: billPatientId }), 1)

    const approved = await request(app, `/api/records/${id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Verified patched CBC' },
    })
    assert.equal(approved.status, 200)
    const afterApprove = await calcPatientBalance(billPatientId)
    assert.equal(afterApprove.totalCharges, Number(labA.price))
    assert.equal(afterApprove.balance, 20000 - Number(labA.price))
  })

  it('does not bill a pending pharmacy return and credits only after approve', async () => {
    const before = await calcPatientBalance(billPatientId)
    const createdReturn = await request(app, `/api/patients/${billPatientId}/returns`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        returnItems: [{
          catalogItemId: String(pharm._id),
          serviceName: 'Fake return name',
          quantity: 1,
          unitPrice: 200,
          total: 200,
          reason: 'Not given',
        }],
        source: 'nurse',
      },
    })
    assert.equal(createdReturn.status, 201)
    assert.equal(createdReturn.body.status, 'pending')
    assert.equal(createdReturn.body.returnItems[0].unitPrice, Number(pharm.price))
    const afterPending = await calcPatientBalance(billPatientId)
    assert.equal(afterPending.totalCharges, before.totalCharges)

    const approved = await request(app, `/api/records/${createdReturn.body.id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Return verified' },
    })
    assert.equal(approved.status, 200)
    const afterApprove = await calcPatientBalance(billPatientId)
    assert.equal(afterApprove.totalCharges, before.totalCharges - Number(pharm.price))
  })

  it('does not change the bill when a pending record is rejected', async () => {
    const createdRecord = await request(app, `/api/patients/${billPatientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: { services: [catalogLine(labB)], source: 'nurse' },
    })
    assert.equal(createdRecord.status, 201)
    const before = await calcPatientBalance(billPatientId)

    const rejected = await request(app, `/api/records/${createdRecord.body.id}/reject`, {
      token: sign(reception),
      method: 'POST',
      body: { reason: 'Wrong patient' },
    })
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.status, 'rejected')
    const after = await calcPatientBalance(billPatientId)
    assert.equal(after.totalCharges, before.totalCharges)
  })
})
