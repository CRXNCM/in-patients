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
import { CreditCompany } from '../models/CreditCompany.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import creditCompanyRoutes from './creditCompanies.routes.js'
import patientRoutes from './patients.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'cred-co-'
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

describe('credit companies and credit admission', { skip: !hasDb }, () => {
  let app
  let admin
  let reception
  let nurse
  let companyId
  const bedLabel = `${PREFIX}GW-01`
  const created = { roles: [], users: [], beds: [] }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await CreditCompany.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ label: bedLabel })

    const adminRole = await Role.create({
      name: `${PREFIX}admin`,
      slug: `${PREFIX}admin`,
      accessRole: 'Admin',
      permissions: ['credit.manage_companies', 'credit.view'],
      active: true,
      system: false,
    })
    const receptionRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      permissions: ['patients.create', 'admissions.create', 'credit.create_admission', 'credit.view'],
      active: true,
      system: false,
    })
    const nurseRole = await Role.create({
      name: `${PREFIX}nurse`,
      slug: `${PREFIX}nurse`,
      accessRole: 'Nurse',
      permissions: ['patients.view'],
      active: true,
      system: false,
    })
    created.roles.push(adminRole._id, receptionRole._id, nurseRole._id)

    admin = await User.create({
      email: `${PREFIX}admin@example.invalid`,
      username: `${PREFIX}admin`,
      password: await bcrypt.hash('password', 8),
      name: 'Company Admin',
      role: 'Admin',
      roleId: adminRole._id,
      status: 'active',
    })
    reception = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Company Desk',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    nurse = await User.create({
      email: `${PREFIX}nurse@example.invalid`,
      username: `${PREFIX}nurse`,
      password: await bcrypt.hash('password', 8),
      name: 'Company Nurse',
      role: 'Nurse',
      roleId: nurseRole._id,
      status: 'active',
    })
    created.users.push(admin._id, reception._id, nurse._id)

    const bed = await Bed.create({
      label: bedLabel,
      roomType: 'General Ward',
      dailyRate: 400,
      status: 'available',
    })
    created.beds.push(bed._id)

    app = express()
    app.use(express.json())
    app.use('/api/credit-companies', creditCompanyRoutes)
    app.use('/api/patients', patientRoutes)
  })

  after(async () => {
    const testStays = await Patient.find({
      $or: [{ patientId: { $regex: `^${PREFIX}` } }, { name: { $regex: `^${PREFIX}` } }],
    }).select('patientId')
    const patientIds = testStays.map((row) => row.patientId)
    if (patientIds.length) {
      await Deposit.deleteMany({ patientId: { $in: patientIds } })
      await RoomAssignment.deleteMany({ patientId: { $in: patientIds } })
      await ServiceRecord.deleteMany({ patientId: { $in: patientIds } })
      await Bed.updateMany({ patientId: { $in: patientIds } }, { $set: { status: 'available', patientId: null } })
    }
    await Patient.deleteMany({
      $or: [{ patientId: { $regex: `^${PREFIX}` } }, { name: { $regex: `^${PREFIX}` } }],
    })
    await CreditCompany.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ $or: [{ _id: { $in: created.beds } }, { label: { $regex: `^${PREFIX}` } }] })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('lets admin create, reject a duplicate name, and deactivate a company', async () => {
    const createdCompany = await request(app, '/api/credit-companies', {
      token: sign(admin),
      method: 'POST',
      body: { name: `${PREFIX} Ethio Insurance `, code: 'EI-1', contactPerson: 'Sara' },
    })
    assert.equal(createdCompany.status, 201, createdCompany.body.error)
    assert.equal(createdCompany.body.name, `${PREFIX} Ethio Insurance`)
    companyId = createdCompany.body.id

    const duplicate = await request(app, '/api/credit-companies', {
      token: sign(admin),
      method: 'POST',
      body: { name: `${PREFIX} ethio insurance` },
    })
    assert.equal(duplicate.status, 400)

    const nurseCreate = await request(app, '/api/credit-companies', {
      token: sign(nurse),
      method: 'POST',
      body: { name: `${PREFIX} Other` },
    })
    assert.equal(nurseCreate.status, 403)

    const list = await request(app, '/api/credit-companies?active=true', { token: sign(reception) })
    assert.equal(list.status, 200)
    assert.equal(list.body.companies.some((row) => row.id === companyId), true)
  })

  it('requires an active company on credit admission and keeps address optional', async () => {
    const missing = await request(app, '/api/patients', {
      token: sign(reception),
      method: 'POST',
      body: {
        name: `${PREFIX} Credit Missing`,
        age: 30,
        gender: 'Female',
        bedId: bedLabel,
        depositAmount: 0,
        admissionPaymentMode: 'credit',
      },
    })
    assert.equal(missing.status, 400)
    assert.match(missing.body.error || '', /company/i)

    const admitted = await request(app, '/api/patients', {
      token: sign(reception),
      method: 'POST',
      body: {
        name: `${PREFIX} Credit Stay`,
        age: 41,
        gender: 'Male',
        bedId: bedLabel,
        depositAmount: 0,
        admissionPaymentMode: 'credit',
        creditCompanyId: companyId,
      },
    })
    assert.equal(admitted.status, 201, admitted.body.error)
    assert.equal(admitted.body.patient.creditCompanyId, companyId)
    assert.equal(admitted.body.patient.creditCompanyName, `${PREFIX} Ethio Insurance`)
    assert.equal(admitted.body.patient.address, '')
    assert.equal(admitted.body.patient.isCreditPatient, true)

    const stored = await Patient.findOne({ patientId: admitted.body.patient.id })
    assert.equal(stored.creditCompanyId, companyId)
    assert.equal(stored.address, '')
  })

  it('hides an inactive company from new credit admissions and keeps the historical link', async () => {
    const deactivated = await request(app, `/api/credit-companies/${companyId}`, {
      token: sign(admin),
      method: 'PATCH',
      body: { active: false },
    })
    assert.equal(deactivated.status, 200)
    assert.equal(deactivated.body.active, false)

    const list = await request(app, '/api/credit-companies?active=true', { token: sign(reception) })
    assert.equal(list.body.companies.some((row) => row.id === companyId), false)

    const stay = await Patient.findOne({ creditCompanyId: companyId })
    assert.ok(stay)
    assert.equal(stay.creditCompanyName, `${PREFIX} Ethio Insurance`)

    await Bed.create({
      label: `${PREFIX}GW-02`,
      name: `${PREFIX}GW-02`,
      nameKey: `${PREFIX}gw-02`,
      roomType: 'General Ward',
      dailyRate: 400,
      status: 'available',
    })
    const blocked = await request(app, '/api/patients', {
      token: sign(reception),
      method: 'POST',
      body: {
        name: `${PREFIX} Later Credit`,
        age: 20,
        gender: 'Female',
        bedId: `${PREFIX}GW-02`,
        depositAmount: 0,
        admissionPaymentMode: 'credit',
        creditCompanyId: companyId,
      },
    })
    assert.equal(blocked.status, 400)
    assert.match(blocked.body.error || '', /not active/i)
  })
})
