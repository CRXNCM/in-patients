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
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import { WardSubmission } from '../models/WardSubmission.js'
import pharmacyRoutes from './pharmacy.routes.js'
import recordRoutes from './records.routes.js'
import { calcPatientBalance } from '../services/autoCharges.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'med-ret-'
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

describe('pharmacy medicine returns', { skip: !hasDb }, () => {
  let app
  let pharmacist
  let reception
  let nurse
  let outsider
  let orderId
  const patientId = `${PREFIX}PAT`
  const created = { roles: [], users: [] }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId })
    await PharmacyOrder.deleteMany({ patientId })
    await ServiceRecord.deleteMany({ patientId })
    await Deposit.deleteMany({ patientId })

    const pharmacistRole = await Role.create({
      name: `${PREFIX}pharm`,
      slug: `${PREFIX}pharm`,
      accessRole: 'Pharmacist',
      permissions: ['patients.view'],
      active: true,
      system: false,
    })
    const receptionRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      permissions: ['patients.view', 'admissions.edit'],
      active: true,
      system: false,
    })
    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      permissions: ['patients.view', 'patients.edit'],
      active: true,
      system: false,
    })
    const outsiderRole = await Role.create({
      name: `${PREFIX}mgr`,
      slug: `${PREFIX}mgr`,
      accessRole: 'Manager',
      permissions: ['reports.view'],
      active: true,
      system: false,
    })
    created.roles.push(pharmacistRole._id, receptionRole._id, nurseRole._id, outsiderRole._id)

    pharmacist = await User.create({
      email: `${PREFIX}pharm@example.invalid`,
      username: `${PREFIX}pharm`,
      password: await bcrypt.hash('password', 8),
      name: 'Return Pharmacist',
      role: 'Pharmacist',
      roleId: pharmacistRole._id,
      status: 'active',
    })
    reception = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Return Desk',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    nurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: await bcrypt.hash('password', 8),
      name: 'Return Nurse',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    outsider = await User.create({
      email: `${PREFIX}mgr@example.invalid`,
      username: `${PREFIX}mgr`,
      password: await bcrypt.hash('password', 8),
      name: 'Return Manager',
      role: 'Manager',
      roleId: outsiderRole._id,
      status: 'active',
    })
    created.users.push(pharmacist._id, reception._id, nurse._id, outsider._id)

    await Patient.create({
      patientId,
      name: 'Return Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 5000,
    })
    await Deposit.create({
      patientId,
      amount: 5000,
      method: 'Cash',
      referenceNumber: `${PREFIX}dep`,
      date: todayStr(),
      receivedBy: 'Return Desk',
      isInitial: true,
    })
    const order = await PharmacyOrder.create({
      submissionId: `${PREFIX}sub`,
      patientId,
      patientName: 'Return Patient',
      admissionId: 'adm-return',
      admissionNumber: patientId,
      requestedByName: 'Ward Nurse',
      requestedAt: new Date().toISOString(),
      items: [{
        lineId: 'med-1',
        catalogItemId: 'cat-1',
        name: 'Amoxicillin',
        unit: 'tablet',
        requestedQuantity: 10,
        suppliedQuantity: 8,
        unitPrice: 12.5,
        billedQuantity: 8,
        receptionStatus: 'approved',
        billingRecordId: 'charge-original',
        status: 'closed_partial',
      }],
    })
    orderId = String(order._id)

    app = express()
    app.use(express.json())
    app.use('/api/pharmacy', pharmacyRoutes)
    app.use('/api/records', recordRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId })
    await PharmacyOrder.deleteMany({ patientId })
    await Deposit.deleteMany({ patientId })
    await Patient.deleteMany({ patientId })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('keeps initiation off the bill and blocks extra or unauthorized returns', async () => {
    const submissionsBefore = await WardSubmission.countDocuments({ submissionId: `${PREFIX}sub` })
    const ordersBefore = await PharmacyOrder.countDocuments({ patientId })
    const hidden = await request(app, '/api/pharmacy/returns', { token: sign(nurse) })
    assert.equal(hidden.status, 403)
    const outsiderHidden = await request(app, '/api/pharmacy/returns', { token: sign(outsider) })
    assert.equal(outsiderHidden.status, 403)

    const tooMuch = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'present-too', lineId: 'med-1', admissionId: 'adm-return', quantity: 9, reasonCode: 'unused' },
    })
    assert.equal(tooMuch.status, 400)

    const nursePost = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(nurse),
      method: 'POST',
      body: { clientActionId: 'present-nurse', lineId: 'med-1', admissionId: 'adm-return', quantity: 1, reasonCode: 'unused' },
    })
    assert.equal(nursePost.status, 403)

    const created = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'present-1', lineId: 'med-1', admissionId: 'adm-return', quantity: 2, reasonCode: 'unused', unitPrice: 999 },
    })
    assert.equal(created.status, 200, created.body.error)
    assert.equal(created.body.items[0].suppliedQuantity, 8)
    assert.equal(created.body.returns.length, 1)
    assert.equal(created.body.returns[0].physicalStatus, 'pending_verification')
    assert.equal(await ServiceRecord.countDocuments({ patientId, workflowKind: 'pharmacy-return' }), 0)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, 0)
    assert.equal(await PharmacyOrder.countDocuments({ patientId }), ordersBefore)
    assert.equal(await WardSubmission.countDocuments({ submissionId: `${PREFIX}sub` }), submissionsBefore)

    const replay = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'present-1', lineId: 'med-1', admissionId: 'adm-return', quantity: 2, reasonCode: 'unused' },
    })
    assert.equal(replay.status, 200)
    assert.equal(replay.body.returns.length, 1)

    const receptionList = await request(app, '/api/pharmacy/returns', { token: sign(reception) })
    assert.equal(receptionList.status, 200)
    assert.equal(receptionList.body.some((row) => row.physicalStatus === 'pending_verification'), false)

    const earlyApprove = await request(app, '/api/records/000000000000000000000000/approve', {
      token: sign(pharmacist),
      method: 'POST',
      body: { note: 'Pharmacist cannot post a credit' },
    })
    assert.equal(earlyApprove.status, 403)
    const receptionVerify = await request(app, `/api/pharmacy/orders/${orderId}/returns/present-1/verify`, {
      token: sign(reception),
      method: 'POST',
      body: { clientActionId: 'verify-denied', acceptedQuantity: 2 },
    })
    assert.equal(receptionVerify.status, 403)
  })

  it('sends only the accepted quantity to reception and ignores a retried verification', async () => {
    const verified = await request(app, `/api/pharmacy/orders/${orderId}/returns/present-1/verify`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'verify-1', acceptedQuantity: 1, discrepancyReason: 'One tablet was damaged', unitPrice: 1 },
    })
    assert.equal(verified.status, 200, verified.body.error)
    const entry = verified.body.returns.find((row) => row.id === 'present-1')
    assert.equal(entry.physicalStatus, 'partially_accepted')
    assert.equal(entry.acceptedQuantity, 1)
    assert.equal(entry.presentedQuantity, 2)
    assert.equal(entry.billingStatus, 'pending_reception')
    assert.equal(verified.body.items[0].suppliedQuantity, 8)
    assert.equal(verified.body.items[0].unitPrice, 12.5)

    const records = await ServiceRecord.find({ patientId, workflowKind: 'pharmacy-return' })
    assert.equal(records.length, 1)
    assert.equal(records[0].status, 'pending')
    assert.equal(records[0].returnItems[0].quantity, 1)
    assert.equal(records[0].returnItems[0].unitPrice, 12.5)
    assert.equal(records[0].returnItems[0].total, 12.5)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, 0)

    const again = await request(app, `/api/pharmacy/orders/${orderId}/returns/present-1/verify`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'verify-1', acceptedQuantity: 2, discrepancyReason: 'Changed my mind' },
    })
    assert.equal(again.status, 200, again.body.error)
    assert.equal(await ServiceRecord.countDocuments({ patientId, workflowKind: 'pharmacy-return' }), 1)
    assert.equal(again.body.returns.find((row) => row.id === 'present-1').acceptedQuantity, 1)

    const queue = await request(app, '/api/pharmacy/returns', { token: sign(reception) })
    const row = queue.body.find((item) => item.id === 'present-1')
    assert.equal(row.billingStatus, 'pending_reception')
    assert.equal(row.proposedAdjustment, -12.5)
    assert.equal(row.chargeReference, 'charge-original')

    const beforeDeposits = await Deposit.countDocuments({ patientId })
    const approved = await request(app, `/api/records/${records[0]._id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Credit the accepted tablet' },
    })
    assert.equal(approved.status, 200, approved.body.error)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, -12.5)
    assert.equal((await Patient.findOne({ patientId })).depositTotal, 5000)
    assert.equal(await Deposit.countDocuments({ patientId }), beforeDeposits)
    const fresh = await PharmacyOrder.findById(orderId)
    assert.equal(fresh.items[0].suppliedQuantity, 8)
    assert.equal(fresh.returns[0].billingStatus, 'approved')
    assert.equal(fresh.returns[0].physicalStatus, 'completed')

    const secondApprove = await request(app, `/api/records/${records[0]._id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Credit the accepted tablet' },
    })
    assert.equal(secondApprove.status, 400)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, -12.5)
  })

  it('does not create an adjustment when pharmacy accepts nothing', async () => {
    const before = await ServiceRecord.countDocuments({ patientId, workflowKind: 'pharmacy-return' })
    const presented = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'present-zero', lineId: 'med-1', admissionId: 'adm-return', quantity: 1, reasonCode: 'unused' },
    })
    assert.equal(presented.status, 200, presented.body.error)
    const rejected = await request(app, `/api/pharmacy/orders/${orderId}/returns/present-zero/verify`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'verify-zero', acceptedQuantity: 0, discrepancyReason: 'The medicine was not the issued pack' },
    })
    assert.equal(rejected.status, 200, rejected.body.error)
    const entry = rejected.body.returns.find((row) => row.id === 'present-zero')
    assert.equal(entry.physicalStatus, 'rejected')
    assert.equal(entry.billingStatus, 'no_adjustment')
    assert.equal(await ServiceRecord.countDocuments({ patientId, workflowKind: 'pharmacy-return' }), before)
  })

  it('keeps a verified return after discharge without posting a new adjustment', async () => {
    await Patient.updateOne({ patientId }, { status: 'discharged' })
    const presented = await request(app, `/api/pharmacy/orders/${orderId}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'present-discharged', lineId: 'med-1', admissionId: 'adm-return', quantity: 1, reasonCode: 'patient_discharged' },
    })
    assert.equal(presented.status, 200, presented.body.error)
    const verified = await request(app, `/api/pharmacy/orders/${orderId}/returns/present-discharged/verify`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'verify-discharged', acceptedQuantity: 1 },
    })
    assert.equal(verified.status, 200, verified.body.error)
    const entry = verified.body.returns.find((row) => row.id === 'present-discharged')
    assert.equal(entry.billingStatus, 'not_eligible')
    assert.equal(entry.billingRecordId || '', '')
    const history = await request(app, '/api/pharmacy/returns', { token: sign(pharmacist) })
    assert.equal(history.status, 200)
    assert.equal(history.body.some((row) => row.id === 'present-discharged'), true)
    const receptionHistory = await request(app, '/api/pharmacy/returns', { token: sign(reception) })
    assert.equal(receptionHistory.body.some((row) => row.id === 'present-discharged'), true)
  })
})
