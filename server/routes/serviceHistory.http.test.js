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
import { WardSubmission } from '../models/WardSubmission.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import serviceHistoryRoutes from './serviceHistory.routes.js'
import { moneyKeys, SERVICE_RECEIPT_DISCLAIMER } from '../services/serviceHistory.js'

const PREFIX = 'svc-hist-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, { token, method = 'GET' } = {}) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers })
    const payload = await res.json().catch(() => ({}))
    return { status: res.status, body: payload }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('service history HTTP', { skip: !hasDb }, () => {
  let app
  let nurse
  let denied
  let patient
  let other
  const createdRoleIds = []
  const createdUserIds = []

  async function makeUser({ permissions, slug }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole: 'Nurse',
      description: 'Temporary service history test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: slug === 'nurse' ? 'Almaz Tsegaye' : `History ${slug}`,
      role: 'Nurse',
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
    await WardSubmission.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    app = express()
    app.use(express.json())
    app.use('/api/service-history', serviceHistoryRoutes)

    nurse = await makeUser({ permissions: ['patients.view'], slug: 'nurse' })
    denied = await makeUser({ permissions: ['clinicalNotes.view'], slug: 'denied' })
    patient = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Edilawit Assefa',
      gender: 'Female',
      phone: '0911000001',
      address: 'Addis Ababa',
      admissionDate: '2026-10-20',
      status: 'discharged',
      dischargeCompletedAt: new Date('2026-10-25T12:00:00.000Z'),
      room: 'ICU',
      bed: 'ICU-01-B01',
    })
    other = await Patient.create({
      patientId: `${PREFIX}P2`,
      name: 'Other Stay',
      gender: 'Male',
      phone: '0911000002',
      address: 'Adama',
      admissionDate: '2026-10-21',
      status: 'admitted',
      room: 'Ward',
      bed: 'W-1',
    })
    await WardSubmission.create({
      submissionId: `${PREFIX}sub`,
      patientId: patient.patientId,
      admissionId: String(patient._id),
      signature: 'sig',
      status: 'saved',
      submittedById: String(nurse._id),
      submittedByName: nurse.name,
      staffAccount: nurse.username,
      submittedAt: new Date('2026-10-25T16:00:00.000Z'),
      originalItems: [
        { category: 'Pharmacy', name: 'Amoxicillin', quantity: 2, unit: 'tab', instructions: 'After food' },
        { category: 'Laboratory', name: 'CBC', quantity: 1, unit: '', instructions: '' },
      ],
    })
    await WardSubmission.create({
      submissionId: `${PREFIX}early`,
      patientId: patient.patientId,
      admissionId: String(patient._id),
      signature: 'sig-early',
      status: 'saved',
      submittedByName: 'Bethlehem Assefa',
      staffAccount: 'bethlehem',
      submittedAt: new Date('2026-10-25T06:15:00.000Z'),
      originalItems: [
        { category: 'Laboratory', name: 'Malaria smear', quantity: 1, unit: '', instructions: 'Before treatment' },
        { category: 'Nursing', name: 'Wound dressing', quantity: 1, unit: '', instructions: '' },
      ],
    })
    await WardSubmission.create({
      submissionId: `${PREFIX}other`,
      patientId: other.patientId,
      admissionId: String(other._id),
      signature: 'sig-other',
      status: 'saved',
      submittedByName: 'Other Nurse',
      staffAccount: 'other',
      submittedAt: new Date('2026-10-25T08:00:00.000Z'),
      originalItems: [
        { category: 'Pharmacy', name: 'OtherDrug', quantity: 4, unit: 'tab', instructions: '' },
      ],
    })
    await PharmacyOrder.create({
      submissionId: `${PREFIX}sub`,
      patientId: patient.patientId,
      patientName: patient.name,
      admissionId: String(patient._id),
      requestedByName: nurse.name,
      requestedAt: '2026-10-25T16:00:00.000Z',
      status: 'pending',
      items: [{ lineId: 'm1', name: 'Amoxicillin', requestedQuantity: 2, unit: 'tab', status: 'pending' }],
    })
  })

  after(async () => {
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await WardSubmission.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('requires authentication and patients.view', async () => {
    const open = await request(app, `/api/service-history/patients?q=${PREFIX}`)
    assert.equal(open.status, 401)
    const forbidden = await request(app, `/api/service-history/patients?q=${PREFIX}`, { token: sign(denied) })
    assert.equal(forbidden.status, 403)
  })

  it('finds a discharged patient and keeps requests on that admission', async () => {
    const found = await request(app, `/api/service-history/patients?q=Edilawit`, { token: sign(nurse) })
    assert.equal(found.status, 200)
    const match = found.body.patients.find((row) => row.patientId === patient.patientId)
    assert.ok(match)
    assert.equal(match.status, 'discharged')
    assert.equal(Object.hasOwn(match, 'address'), false)
    assert.equal(Object.hasOwn(match, 'nationalId'), false)
    assert.equal(moneyKeys(found.body).length, 0)

    const listed = await request(app, '/api/service-history/patients', { token: sign(nurse) })
    assert.equal(listed.status, 200)
    assert.equal(listed.body.count >= 2, true)
    assert.equal(listed.body.patients.length <= listed.body.pageSize, true)

    const short = await request(app, '/api/service-history/patients?q=a', { token: sign(nurse) })
    assert.equal(short.status, 400)

    const firstPage = await request(app, `/api/service-history/patients?q=${PREFIX}&page=1&pageSize=1`, { token: sign(nurse) })
    assert.equal(firstPage.status, 200)
    assert.equal(firstPage.body.count, 2)
    assert.equal(firstPage.body.patients.length, 1)
    assert.equal(firstPage.body.pageCount, 2)
    assert.equal(firstPage.body.patients[0].patientId, other.patientId)

    const secondPage = await request(app, `/api/service-history/patients?q=${PREFIX}&page=2&pageSize=1`, { token: sign(nurse) })
    assert.equal(secondPage.body.patients[0].patientId, patient.patientId)

    const stay = await request(app, `/api/service-history/patients/${patient.patientId}`, { token: sign(nurse) })
    assert.equal(stay.status, 200)
    assert.equal(stay.body.admissions[0].status, 'discharged')
    assert.equal(stay.body.admissions[0].id, String(patient._id))

    const wrong = await request(
      app,
      `/api/service-history/patients/${patient.patientId}/admissions/${other._id}/requests`,
      { token: sign(nurse) }
    )
    assert.equal(wrong.status, 404)

    const list = await request(
      app,
      `/api/service-history/patients/${patient.patientId}/admissions/${patient._id}/requests`,
      { token: sign(nurse) }
    )
    assert.equal(list.status, 200)
    assert.equal(list.body.requests.length, 2)
    assert.equal(list.body.requests[0].submittedBy, 'Almaz Tsegaye')
    assert.equal(list.body.requests[0].count, 2)

    const crossed = await request(
      app,
      `/api/service-history/patients/${patient.patientId}/admissions/${other._id}/receipt`,
      { token: sign(nurse) }
    )
    assert.equal(crossed.status, 404)

    const receipt = await request(
      app,
      `/api/service-history/patients/${patient.patientId}/admissions/${patient._id}/receipt`,
      { token: sign(nurse) }
    )
    assert.equal(receipt.status, 200)
    assert.equal(receipt.body.available, true)
    assert.deepEqual(receipt.body.requests.map((section) => section.requestId), [`${PREFIX}early`, `${PREFIX}sub`])
    assert.equal(receipt.body.requests[0].submittedBy, 'Bethlehem Assefa')
    assert.equal(receipt.body.requests[0].staffAccount, 'bethlehem')
    assert.equal(receipt.body.requests[0].items[0].name, 'Malaria smear')
    assert.equal(receipt.body.requests[0].items[1].name, 'Wound dressing')
    assert.equal(receipt.body.requests[1].submittedBy, 'Almaz Tsegaye')
    assert.equal(receipt.body.requests[1].staffAccount, nurse.username)
    assert.equal(receipt.body.requests[1].items[0].name, 'Amoxicillin')
    assert.equal(receipt.body.requests[1].items[0].quantity, 2)
    assert.equal(receipt.body.requests[1].items[1].name, 'CBC')
    assert.equal(receipt.body.requests.some((section) => section.items.some((item) => item.name === 'OtherDrug')), false)
    assert.equal(receipt.body.disclaimer, SERVICE_RECEIPT_DISCLAIMER)
    assert.equal(receipt.body.label, 'NON-FINANCIAL DOCUMENT')
    assert.equal(typeof receipt.body.generatedAt, 'string')
    assert.deepEqual(moneyKeys(receipt.body), [])

    const otherReceipt = await request(
      app,
      `/api/service-history/patients/${other.patientId}/admissions/${other._id}/receipt`,
      { token: sign(nurse) }
    )
    assert.equal(otherReceipt.body.requests.length, 1)
    assert.equal(otherReceipt.body.requests[0].items[0].name, 'OtherDrug')
  })
})
