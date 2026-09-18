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

const PREFIX = 'catalog-integrity-'
const PRICE_ITEM = `${PREFIX}price`
const INACTIVE_ITEM = `${PREFIX}inactive`
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

async function findLabItem(name) {
  const lab = await ServiceCategory.findOne({ slug: 'laboratory' })
  return lab?.services.find((s) => s.name === name) || null
}

async function upsertLabItem(name, fields) {
  const lab = await ServiceCategory.findOne({ slug: 'laboratory' })
  let item = lab.services.find((s) => s.name === name)
  if (!item) {
    lab.services.push({ name, price: 0, unit: '', active: true, ...fields })
  } else {
    Object.assign(item, fields)
  }
  await lab.save()
  return findLabItem(name)
}

async function removeTestCatalogItems() {
  await ServiceCategory.updateOne(
    { slug: 'laboratory' },
    { $pull: { services: { name: { $in: [PRICE_ITEM, INACTIVE_ITEM] } } } }
  )
}

describe('catalog price integrity HTTP', { skip: !hasDb }, () => {
  let app
  let nurse
  let reception
  let labItem
  let pharmItem
  const created = { roles: [], users: [] }
  const patientId = `${PREFIX}P1`
  const billPatientId = `${PREFIX}BILL`
  const autoPatientId = `${PREFIX}AUTO`

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await removeTestCatalogItems()

    const lab = await ServiceCategory.findOne({ slug: 'laboratory' })
    const pharmacy = await ServiceCategory.findOne({ slug: 'pharmacy' })
    labItem = (lab?.services || []).find((s) => s.active !== false)
    pharmItem = (pharmacy?.services || []).find((s) => s.active !== false)
    if (!labItem || !pharmItem) {
      throw new Error('Seed catalog needs an active laboratory item and an active pharmacy item')
    }

    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      description: 'Temporary nurse catalog-integrity role',
      permissions: ['patients.view', 'patients.edit', 'doctors.assign'],
      active: true,
      system: false,
    })
    const receptionRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      description: 'Temporary reception catalog-integrity role',
      permissions: ['patients.view', 'patients.edit', 'admissions.edit'],
      active: true,
      system: false,
    })
    created.roles.push(nurseRole._id, receptionRole._id)

    nurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: await bcrypt.hash('password', 8),
      name: 'Catalog Integrity Nurse',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    reception = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Catalog Integrity Desk',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    created.users.push(nurse._id, reception._id)

    await Patient.create({
      patientId,
      name: 'Catalog Integrity Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 20000,
    })
    await Patient.create({
      patientId: billPatientId,
      name: 'Catalog Integrity Billing',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 20000,
    })
    await Patient.create({
      patientId: autoPatientId,
      name: 'Catalog Integrity Auto',
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
    await removeTestCatalogItems()
    await mongoose.disconnect()
  })

  it('stores catalog name, price, unit, and catalogItemId for a valid item', async () => {
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(res.status, 201)
    const line = res.body.services[0]
    assert.equal(line.catalogItemId, String(labItem._id))
    assert.equal(line.serviceName, labItem.name)
    assert.equal(line.unitPrice, Number(labItem.price))
    assert.equal(line.unit, labItem.unit || '')
    assert.equal(line.category, 'Laboratory')
  })

  it('ignores client name, price, and unit in favor of the catalog snapshot', async () => {
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Laboratory',
          serviceName: 'Fake CBC',
          unitPrice: 1,
          unit: 'fake',
          quantity: 2,
          total: 2,
        }],
      },
    })
    assert.equal(res.status, 201)
    const line = res.body.services[0]
    assert.equal(line.serviceName, labItem.name)
    assert.equal(line.unitPrice, Number(labItem.price))
    assert.equal(line.unit, labItem.unit || '')
    assert.equal(line.quantity, 2)
    assert.equal(line.total, 2 * Number(labItem.price))
  })

  it('rejects a new catalog record without catalogItemId', async () => {
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          category: 'Laboratory',
          serviceName: labItem.name,
          unitPrice: Number(labItem.price),
          quantity: 1,
        }],
      },
    })
    assert.equal(res.status, 400)
    assert.match(res.body.error || '', /catalog item is required/i)
  })

  it('rejects a nonexistent catalog item', async () => {
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: new mongoose.Types.ObjectId().toString(),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(res.status, 400)
    assert.match(res.body.error || '', /not found/i)
  })

  it('rejects an inactive catalog item', async () => {
    const item = await upsertLabItem(INACTIVE_ITEM, { price: 99, unit: 'test', active: false })
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(item._id),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(res.status, 400)
    assert.match(res.body.error || '', /inactive/i)
  })

  it('rejects a catalog item from a different category', async () => {
    const res = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Pharmacy',
          quantity: 1,
        }],
      },
    })
    assert.equal(res.status, 400)
    assert.match(res.body.error || '', /does not belong to this category/i)
  })

  it('keeps historical snapshots when the catalog price later changes', async () => {
    const firstItem = await upsertLabItem(PRICE_ITEM, { price: 300, unit: 'test', active: true })
    const first = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(firstItem._id),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(first.status, 201)
    assert.equal(first.body.services[0].unitPrice, 300)
    const firstId = first.body.id

    const updated = await upsertLabItem(PRICE_ITEM, { price: 350 })
    const stored = await ServiceRecord.findById(firstId)
    assert.equal(stored.services[0].unitPrice, 300)
    assert.equal(stored.services[0].serviceName, PRICE_ITEM)

    const second = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(updated._id),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(second.status, 201)
    assert.equal(second.body.services[0].unitPrice, 350)
    assert.equal(second.body.services[0].catalogItemId, String(updated._id))

    const stillFirst = await ServiceRecord.findById(firstId)
    assert.equal(stillFirst.services[0].unitPrice, 300)
  })

  it('bills only approved snapshots and ignores pending and rejected records', async () => {
    const start = await calcPatientBalance(billPatientId)
    assert.equal(start.totalCharges, 0)

    const pending = await request(app, `/api/patients/${billPatientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{ catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 }],
      },
    })
    assert.equal(pending.status, 201)
    assert.equal((await calcPatientBalance(billPatientId)).totalCharges, 0)

    const rejected = await request(app, `/api/patients/${billPatientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{ catalogItemId: String(pharmItem._id), category: 'Pharmacy', quantity: 1 }],
      },
    })
    assert.equal(rejected.status, 201)
    const rejectRes = await request(app, `/api/records/${rejected.body.id}/reject`, {
      token: sign(reception),
      method: 'POST',
      body: { reason: 'Not given' },
    })
    assert.equal(rejectRes.status, 200)
    assert.equal((await calcPatientBalance(billPatientId)).totalCharges, 0)

    const historical = await ServiceRecord.create({
      patientId: billPatientId,
      recordName: 'Legacy CBC',
      date: todayStr(),
      status: 'approved',
      recordType: 'daily',
      source: 'reception',
      services: [{
        category: 'Laboratory',
        serviceName: 'Legacy CBC',
        quantity: 1,
        unitPrice: 111,
        total: 111,
      }],
      submittedBy: 'Legacy',
      approvedBy: 'Legacy',
    })
    assert.equal(historical.services[0].catalogItemId, undefined)
    assert.equal((await calcPatientBalance(billPatientId)).totalCharges, 111)

    const approveRes = await request(app, `/api/records/${pending.body.id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Verified' },
    })
    assert.equal(approveRes.status, 200)
    assert.equal((await calcPatientBalance(billPatientId)).totalCharges, 111 + Number(labItem.price))
  })

  it('still creates automatic room and doctor charges without catalogItemId', async () => {
    const room = await ServiceRecord.create({
      patientId: autoPatientId,
      recordName: 'Room',
      date: todayStr(),
      status: 'approved',
      recordType: 'daily',
      source: 'system',
      autoType: 'room',
      autoGenerated: true,
      services: [{
        category: 'Room Services',
        serviceName: 'General Ward - Daily Rate',
        quantity: 1,
        unitPrice: 1500,
        total: 1500,
      }],
      submittedBy: 'System',
    })
    const visit = await ServiceRecord.create({
      patientId: autoPatientId,
      recordName: 'Doctor',
      date: todayStr(),
      status: 'approved',
      recordType: 'daily',
      source: 'system',
      autoType: 'doctor',
      autoGenerated: true,
      services: [{
        category: 'Doctor Visits',
        serviceName: 'Dr. Test — Daily Visit',
        quantity: 1,
        unitPrice: 500,
        total: 500,
        doctorId: 'doc-test',
        specialty: 'Internal Medicine',
      }],
      submittedBy: 'System',
    })

    const billed = await calcPatientBalance(autoPatientId)
    assert.equal(billed.totalCharges, 2000)

    const catalog = await request(app, `/api/patients/${autoPatientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        services: [{ catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 }],
      },
    })
    assert.equal(catalog.status, 201)

    const roomPatch = await request(app, `/api/records/${room._id}`, {
      token: sign(nurse),
      method: 'PATCH',
      body: { services: [{ catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 }] },
    })
    assert.equal(roomPatch.status, 400)

    const visitPatch = await request(app, `/api/records/${visit._id}`, {
      token: sign(nurse),
      method: 'PATCH',
      body: { services: [{ catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 }] },
    })
    assert.equal(visitPatch.status, 400)

    const stillBilled = await calcPatientBalance(autoPatientId)
    assert.equal(stillBilled.totalCharges, 2000)
  })
})
