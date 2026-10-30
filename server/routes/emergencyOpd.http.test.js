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
import { applyEmergencyPrice } from '../utils/admissions.js'
import patientRoutes from './patients.routes.js'
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

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
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
      roomType: 'General Ward',
      dailyRate: 1500,
      status: 'available',
    })
    created.beds.push(bed._id)

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ $or: [{ _id: { $in: created.patients } }, { patientId: { $regex: `^${PREFIX}` } }] })
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

  it('applies 1.25 emergency pricing once on catalog services and keeps it after conversion', async () => {
    const admit = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        name: `${PREFIX} Pricing`,
        gender: 'Female',
        age: 33,
        admissionType: 'emergency-opd',
      },
    })
    assert.equal(admit.status, 201, admit.body.error)
    const patientId = admit.body.patient.id
    created.patients.push(admit.body.patient.admissionId)

    const expected = applyEmergencyPrice(labItem.price, { emergencyPricing: true })
    const record = await request(app, `/api/patients/${patientId}/records`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        services: [{
          catalogItemId: String(labItem._id),
          category: 'Laboratory',
          quantity: 1,
          unitPrice: labItem.price,
        }],
      },
    })
    assert.equal(record.status, 201, record.body.error)
    assert.equal(record.body.services[0].baseUnitPrice, expected.baseUnitPrice)
    assert.equal(record.body.services[0].priceMultiplier, 1.25)
    assert.equal(record.body.services[0].unitPrice, expected.unitPrice)

    const missing = await request(app, `/api/patients/${patientId}/convert-to-inpatient`, {
      token: sign(reception),
      method: 'POST',
      body: { bedId: bed.label, doctorIds: [String(doctor._id)] },
    })
    assert.equal(missing.status, 400)

    const converted = await request(app, `/api/patients/${patientId}/convert-to-inpatient`, {
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
    assert.ok(converted.body.patient.conversionEvents?.length)

    const saved = await ServiceRecord.findOne({ patientId, 'services.catalogItemId': String(labItem._id) })
    assert.equal(saved.services[0].unitPrice, expected.unitPrice)
    assert.equal(saved.services[0].priceMultiplier, 1.25)
  })

  it('blocks conversion by an Emergency Nurse', async () => {
    const admit = await request(app, '/api/patients', {
      token: sign(emergencyNurse),
      method: 'POST',
      body: { name: `${PREFIX} Block`, gender: 'Male', age: 22, admissionType: 'emergency-opd' },
    })
    assert.equal(admit.status, 201, admit.body.error)
    created.patients.push(admit.body.patient.admissionId)
    const res = await request(app, `/api/patients/${admit.body.patient.id}/convert-to-inpatient`, {
      token: sign(emergencyNurse),
      method: 'POST',
      body: {
        bedId: `${PREFIX}GW-99`,
        doctorIds: [String(doctor._id)],
        depositAmount: 15000,
        depositMethod: 'Cash',
      },
    })
    assert.equal(res.status, 403)
  })
})
