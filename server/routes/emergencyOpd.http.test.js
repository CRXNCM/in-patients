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
import { Bed } from '../models/Bed.js'
import { Doctor } from '../models/Doctor.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { defaultPermissionsForSlug } from '../utils/permissions.js'
import { applyAdmissionPrice } from '../utils/admissions.js'
import patientRoutes from './patients.routes.js'
import conversionRoutes from './conversion.routes.js'
import recordRoutes from './records.routes.js'
import { ConversionRequest } from '../models/ConversionRequest.js'
import { Deposit } from '../models/Deposit.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'emopd-test-'
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

describe('Emergency OPD admission HTTP', { skip: !hasDb }, () => {
  let app
  let emergencyNurse
  let wardNurse
  let reception
  let doctor
  let bed
  let labItem
  const created = { roles: [], users: [], patients: [], beds: [], doctors: [] }

  async function cleanupPatients() {
    const rows = await Patient.find({ name: { $regex: PREFIX } }).select('patientId')
    const ids = rows.map((row) => row.patientId)
    if (ids.length) {
      await ConversionRequest.deleteMany({ patientId: { $in: ids } })
      await Deposit.deleteMany({ patientId: { $in: ids } })
      await ServiceRecord.deleteMany({ patientId: { $in: ids } })
    }
    await Patient.deleteMany({ name: { $regex: PREFIX } })
    await Patient.deleteMany({ $or: [{ _id: { $in: created.patients } }, { patientId: { $regex: `^${PREFIX}` } }] })
    await ConversionRequest.deleteMany({ requestedByName: { $in: ['Emergency Nurse Test', 'Reception Test'] } })
    await Deposit.deleteMany({ receivedBy: { $in: ['Emergency Nurse Test', 'Reception Test'] } })
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await cleanupPatients()
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ label: { $regex: `^${PREFIX}` } })
    await Doctor.deleteMany({ name: { $regex: `^${PREFIX}` } })

    const lab = await ServiceCategory.findOne({ slug: 'laboratory' })
    labItem = (lab?.services || []).find((item) => item.active !== false)
    if (!labItem) throw new Error('Seed catalog needs an active laboratory item')

    const emRole = await Role.create({
      name: `${PREFIX}emergency-nurse`,
      slug: `${PREFIX}emergency-nurse`,
      accessRole: 'Nurse',
      permissions: defaultPermissionsForSlug('emergency-nurse'),
      active: true,
      system: false,
    })
    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      permissions: defaultPermissionsForSlug('nurse'),
      active: true,
      system: false,
    })
    const deskRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      permissions: defaultPermissionsForSlug('reception'),
      active: true,
      system: false,
    })
    created.roles.push(emRole._id, nurseRole._id, deskRole._id)

    const hash = await bcrypt.hash('password', 8)
    emergencyNurse = await User.create({
      email: `${PREFIX}em@example.invalid`,
      username: `${PREFIX}em`,
      password: hash,
      name: 'Emergency Nurse Test',
      role: 'Nurse',
      roleId: emRole._id,
      status: 'active',
    })
    wardNurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: hash,
      name: 'Ward Nurse Test',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    reception = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: hash,
      name: 'Reception Test',
      role: 'Reception',
      roleId: deskRole._id,
      status: 'active',
    })
    created.users.push(emergencyNurse._id, wardNurse._id, reception._id)

    doctor = await Doctor.create({
      name: `${PREFIX}Dr Test`,
      specialty: 'Emergency',
      visitPrice: 800,
      active: true,
    })
    created.doctors.push(doctor._id)

    bed = await Bed.create({
      label: `${PREFIX}GW-01`,
      nameKey: `${PREFIX}gw-01`,
      roomType: 'General Ward',
      dailyRate: 1500,
      status: 'available',
    })
    const bed2 = await Bed.create({
      label: `${PREFIX}GW-02`,
      nameKey: `${PREFIX}gw-02`,
      roomType: 'General Ward',
      dailyRate: 1500,
      status: 'available',
    })
    const bed3 = await Bed.create({
      label: `${PREFIX}GW-03`,
      nameKey: `${PREFIX}gw-03`,
      roomType: 'General Ward',
      dailyRate: 1500,
      status: 'available',
    })
    created.beds.push(bed._id, bed2._id, bed3._id)

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
    app.use('/api/records', recordRoutes)
    app.use('/api', conversionRoutes)
  })

  after(async () => {
    await cleanupPatients()
    await Bed.deleteMany({ _id: { $in: created.beds } })
    await Doctor.deleteMany({ _id: { $in: created.doctors } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('lets an Emergency Nurse admit without bed, doctor, or deposit', async () => {
    const res = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        name: `${PREFIX} Hana`,
        gender: 'Female',
        age: 28,
        admissionDate: todayStr(),
        admissionType: 'emergency-opd',
      },
    })
    assert.equal(res.status, 201, res.body.error)
    assert.equal(res.body.patient.admissionType, 'emergency-opd')
    assert.equal(res.body.patient.bed, null)
    assert.equal(res.body.patient.room, null)
    assert.equal(res.body.patient.deposit, 0)
    created.patients.push(res.body.patient.admissionId)
  })

  it('rejects Emergency OPD admission from a ward nurse', async () => {
    const res = await request(app, '/api/patients', {
      token: sign(wardNurse),
      method: 'POST',
      body: {
        name: `${PREFIX} Denied`,
        gender: 'Male',
        age: 40,
        admissionType: 'emergency-opd',
      },
    })
    assert.equal(res.status, 403)
  })

  it('rejects a regular inpatient admission from an Emergency Nurse', async () => {
    const res = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        name: `${PREFIX} Inpatient`,
        gender: 'Male',
        age: 40,
        admissionType: 'normal',
        bedId: bed.label,
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(res.status, 403)
  })

  async function admitEmergency(name) {
    const admit = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { name: `${PREFIX} ${name}`, gender: 'Female', age: 33, admissionType: 'emergency-opd' },
    })
    assert.equal(admit.status, 201, admit.body.error)
    created.patients.push(admit.body.patient.admissionId)
    return admit.body.patient
  }

  it('keeps Emergency OPD catalog prices and applies 1.25 only after inpatient conversion', async () => {
    const patient = await admitEmergency('Pricing')
    const emergencyPrice = applyAdmissionPrice(labItem.price, { inpatientPricing: false })
    const inpatientPrice = applyAdmissionPrice(labItem.price, { inpatientPricing: true })

    const record = await request(app, `/api/patients/${patient.id}/records`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Laboratory',
          quantity: 1,
          unitPrice: 9999,
        }],
      },
    })
    assert.equal(record.status, 201, record.body.error)
    assert.equal(record.body.services[0].baseUnitPrice, emergencyPrice.baseUnitPrice)
    assert.equal(record.body.services[0].priceMultiplier, 1)
    assert.equal(record.body.services[0].unitPrice, emergencyPrice.unitPrice)

    const missing = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(reception),
      method: 'POST',
      body: { bedId: bed.label, doctorIds: [String(doctor._id)] },
    })
    assert.equal(missing.status, 400)

    const converted = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(reception),
      method: 'POST',
      body: {
        bedId: bed.label,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(converted.status, 200, converted.body.error)
    assert.equal(converted.body.patient.admissionType, 'normal')
    assert.equal(converted.body.patient.convertedFromEmergency, true)

    const saved = await ServiceRecord.findById(record.body.id)
    assert.equal(saved.services[0].unitPrice, emergencyPrice.unitPrice)
    assert.equal(saved.services[0].priceMultiplier, 1)

    const later = await request(app, `/api/patients/${patient.id}/records`, {
      token: sign(wardNurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Laboratory',
          quantity: 1,
        }],
      },
    })
    assert.equal(later.status, 201, later.body.error)
    assert.equal(later.body.services[0].priceMultiplier, 1.25)
    assert.equal(later.body.services[0].unitPrice, inpatientPrice.unitPrice)
  })

  it('lets an Emergency Nurse request inpatient admission without changing type', async () => {
    const patient = await admitEmergency('Request')
    const createdReq = await request(app, `/api/patients/${patient.id}/conversion-requests`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { reason: 'Needs observation overnight', notes: 'Handover at 22:00' },
    })
    assert.equal(createdReq.status, 201, createdReq.body.error)
    assert.equal(createdReq.body.request.status, 'pending')

    const stillEmergency = await Patient.findOne({ patientId: patient.id })
    assert.equal(stillEmergency.admissionType, 'emergency-opd')
    assert.ok(!stillEmergency.bed)

    const duplicate = await request(app, `/api/patients/${patient.id}/conversion-requests`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { reason: 'Second request' },
    })
    assert.equal(duplicate.status, 409)

    const queue = await request(app, '/api/conversion-requests', { token: sign(reception) })
    assert.equal(queue.status, 200, queue.body.error)
    assert.ok(queue.body.requests.some((row) => row.patientId === patient.id))

    const nurseQueue = await request(app, '/api/conversion-requests', { token: sign(emergencyNurse) })
    assert.equal(nurseQueue.status, 403)
  })

  it('lets Reception return, the nurse resubmit, then Reception reject a request', async () => {
    const patient = await admitEmergency('ReturnReject')
    const createdReq = await request(app, `/api/patients/${patient.id}/conversion-requests`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { reason: 'Admit for surgery' },
    })
    const requestId = createdReq.body.request.id

    const returned = await request(app, `/api/conversion-requests/${requestId}/return`, {
      token: sign(reception),
      method: 'POST',
      body: { reason: 'Need estimated stay length' },
    })
    assert.equal(returned.status, 200, returned.body.error)
    assert.equal(returned.body.request.status, 'returned')

    const resubmitted = await request(app, `/api/conversion-requests/${requestId}/resubmit`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { reason: 'Admit for surgery. Estimated 3 days.' },
    })
    assert.equal(resubmitted.status, 200, resubmitted.body.error)
    assert.equal(resubmitted.body.request.status, 'resubmitted')

    const rejected = await request(app, `/api/conversion-requests/${requestId}/reject`, {
      token: sign(reception),
      method: 'POST',
      body: { reason: 'Can continue as Emergency OPD' },
    })
    assert.equal(rejected.status, 200, rejected.body.error)
    assert.equal(rejected.body.request.status, 'rejected')
    const still = await Patient.findOne({ patientId: patient.id })
    assert.equal(still.admissionType, 'emergency-opd')
  })

  it('lets Reception complete a pending request with bed, doctor, and deposit', async () => {
    const patient = await admitEmergency('Complete')
    const createdReq = await request(app, `/api/patients/${patient.id}/conversion-requests`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { reason: 'Needs ward bed' },
    })
    const completed = await request(app, `/api/conversion-requests/${createdReq.body.request.id}/complete`, {
      token: sign(reception),
      method: 'POST',
      body: {
        bedId: `${PREFIX}GW-02`,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(completed.status, 200, completed.body.error)
    assert.equal(completed.body.patient.admissionType, 'normal')
    assert.equal(completed.body.request.status, 'completed')
    const deposits = await Deposit.find({ patientId: patient.id, receivedBy: 'Reception Test', isInitial: true })
    assert.equal(deposits.length, 1)
    assert.equal(deposits[0].amount, 15000)
  })

  it('lets an Emergency Nurse self-convert with full inpatient validation and blocks unrelated reception work', async () => {
    const patient = await admitEmergency('Self')
    const missingBed = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { doctorIds: [String(doctor._id)], depositAmount: 15000, depositMethod: 'Cash' },
    })
    assert.equal(missingBed.status, 400)

    const missingDoctor = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { bedId: `${PREFIX}GW-03`, depositAmount: 15000, depositMethod: 'Cash' },
    })
    assert.equal(missingDoctor.status, 400)

    const missingDeposit = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { bedId: `${PREFIX}GW-03`, doctorIds: [String(doctor._id)] },
    })
    assert.equal(missingDeposit.status, 400)

    const occupied = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        bedId: bed.label,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(occupied.status, 400)

    const depositAttempt = await request(app, `/api/patients/${patient.id}/deposits`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { amount: 15000, method: 'Cash' },
    })
    assert.equal(depositAttempt.status, 403)

    const converted = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        bedId: `${PREFIX}GW-03`,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(converted.status, 200, converted.body.error)
    assert.equal(converted.body.patient.admissionType, 'normal')
    assert.equal(converted.body.patient.convertedFromEmergency, true)

    const again = await request(app, `/api/patients/${patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        bedId: `${PREFIX}GW-03`,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.ok(again.status === 400 || again.status === 409)
  })

  it('keeps Emergency OPD off Reception and auto-approves services except pharmacy and laboratory', async () => {
    const createdStay = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        name: `${PREFIX} Desk Hide`,
        gender: 'Male',
        age: 41,
        admissionDate: todayStr(),
        admissionType: 'emergency-opd',
      },
    })
    assert.equal(createdStay.status, 201, createdStay.body.error)
    const patientId = createdStay.body.patient.id
    created.patients.push(createdStay.body.patient.admissionId)

    const deskList = await request(app, '/api/patients', { token: sign(reception) })
    assert.equal(deskList.status, 200)
    assert.equal((deskList.body || []).some((row) => row.id === patientId), false)

    const wardList = await request(app, '/api/patients', { token: sign(wardNurse) })
    assert.equal((wardList.body || []).some((row) => row.id === patientId), false)

    const emList = await request(app, '/api/patients', { token: sign(emergencyNurse) })
    assert.equal((emList.body || []).some((row) => row.id === patientId), true)

    const deskOne = await request(app, `/api/patients/${patientId}`, { token: sign(reception) })
    assert.equal(deskOne.status, 404)

    const otherCategory = await ServiceCategory.findOne({
      slug: { $nin: ['pharmacy', 'laboratory'] },
      'services.0': { $exists: true },
    })
    const otherItem = (otherCategory?.services || []).find((item) => item.active !== false)
    assert.ok(otherItem, 'catalog needs a non-pharmacy, non-laboratory service')

    const auto = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(otherItem._id || otherItem.id),
          category: otherCategory.name,
          serviceName: otherItem.name,
          quantity: 1,
        }],
      },
    })
    assert.equal(auto.status, 201, auto.body.error)
    assert.equal(auto.body.status, 'approved')

    const lab = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id || labItem.id),
          category: 'Laboratory',
          serviceName: labItem.name,
          quantity: 1,
        }],
      },
    })
    assert.equal(lab.status, 201, lab.body.error)
    assert.equal(lab.body.status, 'pending')

    const deskPending = await request(app, '/api/records/pending', { token: sign(reception) })
    assert.equal(deskPending.status, 200)
    assert.equal((deskPending.body || []).some((row) => row.patientId === patientId), false)

    const deskApprove = await request(app, `/api/records/${lab.body.id}/approve`, {
      token: sign(reception),
      method: 'POST',
      body: { note: 'should not work' },
    })
    assert.equal(deskApprove.status, 403)
  })
})

