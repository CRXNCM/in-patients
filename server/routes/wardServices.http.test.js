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
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { WardSubmission } from '../models/WardSubmission.js'
import patientRoutes from './patients.routes.js'
import wardServicesRoutes from './wardServices.routes.js'
import pharmacyRoutes from './pharmacy.routes.js'
import laboratoryRoutes from './laboratory.routes.js'
import recordRoutes from './records.routes.js'
import { todayStr } from '../utils/dates.js'
import { calcPatientBalance } from '../services/autoCharges.js'
import { applyAdmissionPrice } from '../utils/admissions.js'

function billedPrice(base) {
  return applyAdmissionPrice(base, { inpatientPricing: true }).unitPrice
}

const PREFIX = 'ward-route-'
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

describe('ward service routing HTTP', { skip: !hasDb }, () => {
  let app
  let nurse
  let pharmacist
  let reception
  let laboratoryUser
  let pharmA
  let pharmB
  let labItem
  let otherItem
  const patientId = `${PREFIX}P1`

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await LaboratoryOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await WardSubmission.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceCategory.deleteOne({ slug: `${PREFIX}other` })

    const pharmacy = await ServiceCategory.findOne({ slug: 'pharmacy' })
    const laboratory = await ServiceCategory.findOne({ slug: 'laboratory' })
    const medicines = (pharmacy?.services || []).filter((item) => item.active !== false)
    const tests = (laboratory?.services || []).filter((item) => item.active !== false)
    if (medicines.length < 2 || !tests.length) {
      throw new Error('Seed catalog needs two pharmacy items and one laboratory item')
    }
    pharmA = medicines[0]
    pharmB = medicines[1]
    labItem = tests[0]
    const other = await ServiceCategory.create({
      slug: `${PREFIX}other`,
      name: 'Ward Route Other',
      billingType: 'selection',
      services: [{ name: 'Dressing change', price: 50, unit: 'each', active: true }],
    })
    otherItem = other.services[0]

    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      permissions: ['patients.view', 'patients.edit'],
      active: true,
    })
    const pharmacistRole = await Role.create({
      name: `${PREFIX}pharmacist`,
      slug: `${PREFIX}pharmacist`,
      accessRole: 'Pharmacist',
      permissions: ['patients.view', 'admissions.view'],
      active: true,
    })
    nurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: await bcrypt.hash('password', 8),
      name: 'Ward Route Nurse',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    pharmacist = await User.create({
      email: `${PREFIX}pharmacist@example.invalid`,
      username: `${PREFIX}pharmacist`,
      password: await bcrypt.hash('password', 8),
      name: 'Ward Route Pharmacist',
      role: 'Pharmacist',
      roleId: pharmacistRole._id,
      status: 'active',
    })
    const receptionRole = await Role.create({
      name: `${PREFIX}reception`,
      slug: `${PREFIX}reception`,
      accessRole: 'Reception',
      permissions: ['patients.view', 'admissions.edit'],
      active: true,
    })
    const laboratoryRole = await Role.create({
      name: `${PREFIX}laboratory`,
      slug: `${PREFIX}laboratory`,
      accessRole: 'Laboratory',
      permissions: ['patients.view', 'admissions.view'],
      active: true,
    })
    reception = await User.create({
      email: `${PREFIX}reception@example.invalid`,
      username: `${PREFIX}reception`,
      password: await bcrypt.hash('password', 8),
      name: 'Ward Route Reception',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    laboratoryUser = await User.create({
      email: `${PREFIX}laboratory@example.invalid`,
      username: `${PREFIX}laboratory`,
      password: await bcrypt.hash('password', 8),
      name: 'Ward Route Laboratory',
      role: 'Laboratory',
      roleId: laboratoryRole._id,
      status: 'active',
    })
    await Patient.create({
      patientId,
      name: 'Ward Route Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: todayStr(),
      status: 'admitted',
      room: 'General Ward',
      bed: 'GW-01',
      depositTotal: 1000,
    })

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
    app.use('/api', wardServicesRoutes)
    app.use('/api/pharmacy', pharmacyRoutes)
    app.use('/api/laboratory', laboratoryRoutes)
    app.use('/api/records', recordRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await LaboratoryOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await WardSubmission.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await ServiceCategory.deleteOne({ slug: `${PREFIX}other` })
    await mongoose.disconnect()
  })

  it('routes one nurse record to pharmacy, laboratory, and reception without duplicating on retry', async () => {
    const body = {
      submissionId: 'ward-route-submission-1',
      services: [
        { id: 'med-a', catalogItemId: String(pharmA._id), category: 'Pharmacy', quantity: 6, notes: 'At night' },
        { id: 'med-b', catalogItemId: String(pharmB._id), category: 'Pharmacy', quantity: 2, notes: 'IV' },
        { id: 'lab-a', catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 },
        { id: 'other-a', catalogItemId: String(otherItem._id), category: 'Ward Route Other', quantity: 1 },
      ],
    }
    const created = await request(app, `/api/patients/${patientId}/ward-services`, {
      token: sign(nurse),
      method: 'POST',
      body,
    })
    assert.equal(created.status, 201, created.body.error)
    assert.equal(created.body.record.services.length, 1)
    assert.equal(created.body.record.services[0].serviceName, 'Dressing change')
    assert.equal(created.body.record.status, 'pending')
    assert.equal(created.body.pharmacyOrder.items.length, 2)
    assert.equal(created.body.pharmacyOrder.status, 'pending')
    assert.equal(created.body.laboratoryOrder.items.length, 1)
    assert.equal(created.body.laboratoryOrder.items[0].status, 'pending')
    assert.equal(created.body.laboratoryOrder.items[0].receptionStatus, 'not_sent')
    assert.equal(created.body.counts.reception, 1)

    const direct = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(nurse),
      method: 'POST',
      body: { services: [{ catalogItemId: String(pharmA._id), category: 'Pharmacy', quantity: 1 }] },
    })
    assert.equal(direct.status, 201, direct.body.error)
    assert.equal(direct.body.services[0].category, 'Pharmacy')

    const again = await request(app, `/api/patients/${patientId}/ward-services`, {
      token: sign(nurse),
      method: 'POST',
      body,
    })
    assert.equal(again.status, 200)
    assert.equal(again.body.pharmacyOrder.id, created.body.pharmacyOrder.id)
    assert.equal(await PharmacyOrder.countDocuments({ patientId }), 1)

    const nurseHandover = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/handover`, {
      token: sign(nurse),
      method: 'POST',
      body: { clientActionId: 'nurse-try', lineId: 'med-a', outcome: 'fulfilled', quantity: 6 },
    })
    assert.equal(nurseHandover.status, 403)

    const partial = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/handover`, {
      token: sign(pharmacist),
      method: 'POST',
      body: {
        clientActionId: 'hand-1',
        lineId: 'med-a',
        outcome: 'partial',
        quantity: 4,
        reasonCode: 'out_of_stock',
      },
    })
    assert.equal(partial.status, 200, partial.body.error)
    assert.equal(partial.body.status, 'partially_fulfilled')
    assert.equal(partial.body.items[0].suppliedQuantity, 4)

    const replay = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/handover`, {
      token: sign(pharmacist),
      method: 'POST',
      body: {
        clientActionId: 'hand-1',
        lineId: 'med-a',
        outcome: 'partial',
        quantity: 4,
        reasonCode: 'out_of_stock',
      },
    })
    assert.equal(replay.status, 200)
    assert.equal(replay.body.items.find((item) => item.lineId === 'med-a').suppliedQuantity, 4)

    const tooMuch = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'ret-too', lineId: 'med-a', admissionId: partial.body.admissionId, quantity: 5, reason: 'Too many' },
    })
    assert.equal(tooMuch.status, 400)

    const returned = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'ret-1', lineId: 'med-a', admissionId: partial.body.admissionId, quantity: 1, reason: 'Unused tablets' },
    })
    assert.equal(returned.status, 200, returned.body.error)
    assert.equal(returned.body.items.find((item) => item.lineId === 'med-a').suppliedQuantity, 4)
    assert.equal(returned.body.returns.length, 1)

    const returnedAgain = await request(app, `/api/pharmacy/orders/${created.body.pharmacyOrder.id}/returns`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'ret-1', lineId: 'med-a', admissionId: partial.body.admissionId, quantity: 1, reason: 'Unused tablets' },
    })
    assert.equal(returnedAgain.body.returns.length, 1)
  })

  it('bills pharmacy and laboratory items only after departmental release and reception approval', async () => {
    const pharmacy = await PharmacyOrder.findOne({ patientId })
    const laboratory = await LaboratoryOrder.findOne({ patientId, submissionId: 'ward-route-submission-1' })
    const med = pharmacy.items.find((item) => item.lineId === 'med-a')
    const other = pharmacy.items.find((item) => item.lineId === 'med-b')
    assert.equal(med.receptionStatus, 'pending')
    assert.equal(med.billedQuantity, 4)
    assert.equal(other.billingRecordId, '')
    assert.equal((await calcPatientBalance(patientId)).totalCharges, 0)

    const direct = await ServiceRecord.findOne({ patientId, departmentGate: 'pharmacy', departmentCleared: false })
    const directApprove = await request(app, `/api/records/${direct._id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'bypass' },
    })
    assert.equal(directApprove.status, 400)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, 0)

    const dressing = await ServiceRecord.findOne({ patientId, 'services.serviceName': 'Dressing change' })
    const dressingApproved = await request(app, `/api/records/${dressing._id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Dressing checked' },
    })
    assert.equal(dressingApproved.status, 200, dressingApproved.body.error)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, billedPrice(50))

    const medApproved = await request(app, `/api/records/${med.billingRecordId}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Supplied quantity checked' },
    })
    assert.equal(medApproved.status, 200, medApproved.body.error)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, billedPrice(50) + (4 * billedPrice(pharmA.price)))
    const billedOrders = await ServiceRecord.find({ billingKey: `pharmacy:${pharmacy._id}:med-a` })
    assert.equal(billedOrders.length, 1)

    const replay = await request(app, `/api/pharmacy/orders/${pharmacy._id}/handover`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'hand-1', lineId: 'med-a', outcome: 'partial', quantity: 4, reasonCode: 'out_of_stock' },
    })
    assert.equal(replay.status, 200, replay.body.error)
    assert.equal(await ServiceRecord.countDocuments({ billingKey: `pharmacy:${pharmacy._id}:med-a` }), 1)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, billedPrice(50) + (4 * billedPrice(pharmA.price)))

    const over = await request(app, `/api/pharmacy/orders/${pharmacy._id}/handover`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'hand-over', lineId: 'med-a', outcome: 'partial', quantity: 9, reasonCode: 'out_of_stock' },
    })
    assert.equal(over.status, 400)

    const lineId = laboratory.items[0].lineId
    const nurseLab = await request(app, `/api/laboratory/orders/${laboratory._id}/items/${lineId}/approve`, {
      token: sign(nurse),
      method: 'POST',
      body: { clientActionId: 'lab-nurse' },
    })
    assert.equal(nurseLab.status, 403)
    const pharmacistLab = await request(app, `/api/laboratory/orders/${laboratory._id}/items/${lineId}/approve`, {
      token: sign(pharmacist),
      method: 'POST',
      body: { clientActionId: 'lab-pharmacist' },
    })
    assert.equal(pharmacistLab.status, 403)
    const labHandover = await request(app, `/api/pharmacy/orders/${pharmacy._id}/handover`, {
      token: sign(laboratoryUser),
      method: 'POST',
      body: { clientActionId: 'lab-user-handover', lineId: 'med-b', outcome: 'fulfilled', quantity: 2 },
    })
    assert.equal(labHandover.status, 403)

    const beforeLab = (await calcPatientBalance(patientId)).totalCharges
    const labApproved = await request(app, `/api/laboratory/orders/${laboratory._id}/items/${lineId}/approve`, {
      token: sign(laboratoryUser),
      method: 'POST',
      body: { clientActionId: 'lab-approve' },
    })
    assert.equal(labApproved.status, 200, labApproved.body.error)
    const labItemState = labApproved.body.items.find((item) => item.lineId === lineId)
    assert.equal(labItemState.status, 'approved')
    assert.equal(labItemState.receptionStatus, 'pending')
    assert.equal((await calcPatientBalance(patientId)).totalCharges, beforeLab)

    assert.equal((await calcPatientBalance(patientId)).totalCharges, beforeLab)
    const goneProcess = await request(app, `/api/laboratory/orders/${laboratory._id}/items/${lineId}/process`, {
      token: sign(laboratoryUser),
      method: 'POST',
      body: { clientActionId: 'lab-process' },
    })
    assert.equal(goneProcess.status, 404)
    const goneComplete = await request(app, `/api/laboratory/orders/${laboratory._id}/items/${lineId}/complete`, {
      token: sign(laboratoryUser),
      method: 'POST',
      body: { clientActionId: 'lab-complete', note: 'Done' },
    })
    assert.equal(goneComplete.status, 404)

    const labBill = await request(app, `/api/records/${labItemState.billingRecordId}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'Laboratory release checked' },
    })
    assert.equal(labBill.status, 200, labBill.body.error)
    assert.equal((await calcPatientBalance(patientId)).totalCharges, beforeLab + billedPrice(labItem.price))

    const rejectedSubmit = await request(app, `/api/patients/${patientId}/ward-services`, {
      token: sign(nurse),
      method: 'POST',
      body: {
        submissionId: 'ward-route-submission-2',
        services: [{ id: 'lab-reject', catalogItemId: String(labItem._id), category: 'Laboratory', quantity: 1 }],
      },
    })
    assert.equal(rejectedSubmit.status, 201, rejectedSubmit.body.error)
    const rejected = await request(app, `/api/laboratory/orders/${rejectedSubmit.body.laboratoryOrder.id}/items/lab-reject/reject`, {
      token: sign(laboratoryUser),
      method: 'POST',
      body: { clientActionId: 'lab-reject', reason: 'Wrong test requested' },
    })
    assert.equal(rejected.status, 200, rejected.body.error)
    assert.equal(rejected.body.items[0].status, 'rejected')
    assert.equal(rejected.body.items[0].billingRecordId || '', '')
    assert.equal((await calcPatientBalance(patientId)).totalCharges, beforeLab + billedPrice(labItem.price))

    const [firstReturn, secondReturn] = await Promise.all([
      request(app, `/api/pharmacy/orders/${pharmacy._id}/returns`, {
        token: sign(pharmacist),
        method: 'POST',
        body: { clientActionId: 'ret-race-a', lineId: 'med-a', admissionId: pharmacy.admissionId, quantity: 2, reason: 'Brought back' },
      }),
      request(app, `/api/pharmacy/orders/${pharmacy._id}/returns`, {
        token: sign(pharmacist),
        method: 'POST',
        body: { clientActionId: 'ret-race-b', lineId: 'med-a', admissionId: pharmacy.admissionId, quantity: 2, reason: 'Brought back again' },
      }),
    ])
    const statuses = [firstReturn.status, secondReturn.status]
    assert.equal(statuses.filter((status) => status === 200).length, 1, `${statuses.join(',')}: ${firstReturn.body.error || ''} / ${secondReturn.body.error || ''}`)
    const fresh = await PharmacyOrder.findById(pharmacy._id)
    const returnedQty = fresh.returns.reduce((sum, entry) => sum + Number(entry.quantity), 0)
    assert.equal(returnedQty, 3)
    assert.equal(fresh.items.find((item) => item.lineId === 'med-a').suppliedQuantity, 4)
  })
})
