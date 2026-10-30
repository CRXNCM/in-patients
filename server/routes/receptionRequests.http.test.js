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
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import recordRoutes from './records.routes.js'

const PREFIX = 'rcpt-req-'
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
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
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

describe('reception request grouping HTTP', { skip: !hasDb }, () => {
  let app
  let reception
  let patient
  let other
  let dressing
  const createdRoleIds = []
  const createdUserIds = []

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    app = express()
    app.use(express.json())
    app.use('/api/records', recordRoutes)

    const role = await Role.create({
      name: `${PREFIX}reception`,
      slug: `${PREFIX}reception`,
      accessRole: 'Reception',
      description: 'Temporary reception grouping test',
      permissions: ['patients.view', 'admissions.edit'],
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    reception = await User.create({
      email: `${PREFIX}reception@example.invalid`,
      username: `${PREFIX}reception`,
      password: await bcrypt.hash('password', 8),
      name: 'Sara Bekele',
      role: 'Reception',
      roleId: role._id,
      status: 'active',
    })
    createdUserIds.push(reception._id)
    patient = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Patient A',
      gender: 'Female',
      phone: '0911000091',
      address: 'Addis Ababa',
      admissionDate: '2026-10-25',
      status: 'admitted',
    })
    other = await Patient.create({
      patientId: `${PREFIX}P2`,
      name: 'Patient B',
      gender: 'Male',
      phone: '0911000092',
      address: 'Adama',
      admissionDate: '2026-10-25',
      status: 'admitted',
    })
    await PharmacyOrder.create({
      submissionId: `${PREFIX}SR1`,
      patientId: patient.patientId,
      patientName: patient.name,
      admissionId: String(patient._id),
      requestedByName: 'Nurse A',
      requestedAt: '2026-10-25T06:15:00.000Z',
      status: 'partially_fulfilled',
      items: [
        { lineId: 'med-a', name: 'Medicine A', requestedQuantity: 1, suppliedQuantity: 1, unitPrice: 10, status: 'fulfilled', receptionStatus: 'pending' },
        { lineId: 'med-b', name: 'Medicine B', requestedQuantity: 1, suppliedQuantity: 0, unitPrice: 12, status: 'pending', receptionStatus: 'not_sent' },
      ],
    })
    const order = await PharmacyOrder.findOne({ submissionId: `${PREFIX}SR1` })
    await ServiceRecord.create({
      patientId: patient.patientId,
      recordName: patient.name,
      date: '2026-10-25',
      status: 'pending',
      submissionId: `${PREFIX}SR1`,
      departmentCleared: true,
      departmentGate: 'pharmacy',
      workflowKind: 'pharmacy',
      workflowOrderId: String(order._id),
      workflowLineId: 'med-a',
      billingKey: `${PREFIX}pharmacy:${order._id}:med-a`,
      services: [{ id: 'med-a', category: 'Pharmacy', serviceName: 'Medicine A', quantity: 1, unitPrice: 10, total: 10 }],
      submittedBy: 'Nurse A',
      recordedAt: new Date('2026-10-25T07:00:00.000Z'),
    })
    dressing = await ServiceRecord.create({
      patientId: patient.patientId,
      recordName: patient.name,
      date: '2026-10-25',
      status: 'pending',
      submissionId: `${PREFIX}SR1`,
      services: [
        { id: 'dressing', category: 'Nursing', serviceName: 'Dressing', quantity: 1, unitPrice: 15, total: 15 },
        { id: 'oxygen', category: 'Nursing', serviceName: 'Oxygen', quantity: 1, unitPrice: 40, total: 40 },
      ],
      submittedBy: 'Nurse A',
      recordedAt: new Date('2026-10-25T06:15:00.000Z'),
    })
    await ServiceRecord.create({
      patientId: other.patientId,
      recordName: other.name,
      date: '2026-10-25',
      status: 'pending',
      submissionId: `${PREFIX}SR2`,
      services: [{ id: 'other-line', category: 'Nursing', serviceName: 'Medicine Z', quantity: 1, unitPrice: 8, total: 8 }],
      submittedBy: 'Nurse B',
      recordedAt: new Date(),
    })
  })

  after(async () => {
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('groups one nurse request and charges a single item without a second request or a second charge', async () => {
    const open = await request(app, '/api/records/reception-requests')
    assert.equal(open.status, 401)

    const list = await request(app, `/api/records/reception-requests?patientId=${patient.patientId}`, { token: sign(reception) })
    assert.equal(list.status, 200)
    const group = list.body.requests.find((row) => row.id === `${PREFIX}SR1`)
    assert.ok(group)
    assert.equal(list.body.requests.some((row) => row.patientId === other.patientId), false)
    assert.equal(group.items.some((item) => item.description === 'Medicine Z'), false)
    assert.equal(group.items.filter((item) => item.description === 'Medicine A').length, 1)
    assert.equal(group.items.find((item) => item.description === 'Medicine B').eligibility, 'awaiting_department')
    const medicine = group.items.find((item) => item.description === 'Medicine A')
    const before = await ServiceRecord.countDocuments({ billingKey: `${PREFIX}pharmacy:${medicine.billingRecordId ? '' : ''}` })
    const first = await request(app, `/api/records/${medicine.billingRecordId}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Charge Medicine A' },
    })
    assert.equal(first.status, 200)
    assert.equal(first.body.reviewedBy, 'Sara Bekele')
    assert.equal(first.body.auditTrail.at(-1).action, 'approved')
    assert.equal(first.body.auditTrail.at(-1).by, 'Sara Bekele')
    const again = await request(app, `/api/records/${medicine.billingRecordId}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Charge Medicine A again' },
    })
    assert.equal(again.status, 400)
    const charges = await ServiceRecord.countDocuments({ workflowLineId: 'med-a', patientId: patient.patientId })
    assert.equal(charges, 1)
    const sibling = await ServiceRecord.findById(dressing._id)
    assert.equal(sibling.status, 'pending')
    assert.equal(sibling.services.length, 2)
    assert.equal(before >= 0, true)

    const line = await request(app, `/api/records/${dressing._id}/items/dressing/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Charge dressing only' },
    })
    assert.equal(line.status, 200)
    assert.equal(line.body.services.length, 1)
    assert.equal(line.body.services[0].serviceName, 'Dressing')
    assert.equal(line.body.status, 'approved')
    const repeat = await request(app, `/api/records/${dressing._id}/items/dressing/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Charge dressing again' },
    })
    assert.equal(repeat.status, 200)
    assert.equal(repeat.body.id, line.body.id)
    const dressingCharges = await ServiceRecord.countDocuments({ billingKey: `reception:${dressing._id}:dressing` })
    assert.equal(dressingCharges, 1)
    const parent = await ServiceRecord.findById(dressing._id)
    assert.equal(parent.services.length, 1)
    assert.equal(parent.services[0].serviceName, 'Oxygen')
    assert.equal(parent.status, 'pending')

    const after = await request(app, `/api/records/reception-requests?patientId=${patient.patientId}`, { token: sign(reception) })
    const same = after.body.requests.filter((row) => row.id === `${PREFIX}SR1`)
    assert.equal(same.length, 1)
    assert.equal(same[0].items.find((item) => item.description === 'Medicine A').receptionCode, 'approved')
    assert.equal(same[0].items.find((item) => item.description === 'Oxygen').receptionCode, 'pending')
    assert.equal(same[0].status, 'partly_charged')
  })
})
