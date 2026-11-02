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
import patientRoutes from './patients.routes.js'
import { todayStr } from '../utils/dates.js'
import { computeAgeFromDob } from '../utils/validation.js'

const PREFIX = 'pinfo-'
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

describe('PATCH /api/patients/:id personal information', { skip: !hasDb }, () => {
  let app
  let desk
  let night
  let pharmacist
  const patientId = `${PREFIX}PAT`
  const created = { roles: [], users: [] }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId })
    await PharmacyOrder.deleteMany({ patientId })

    const receptionRole = await Role.create({
      name: `${PREFIX}desk`,
      slug: `${PREFIX}desk`,
      accessRole: 'Reception',
      permissions: ['patients.view', 'patients.edit', 'admissions.create'],
      active: true,
      system: false,
    })
    const nightRole = await Role.create({
      name: `${PREFIX}night`,
      slug: `${PREFIX}night`,
      accessRole: 'Reception',
      permissions: ['patients.view', 'patients.create', 'admissions.create'],
      active: true,
      system: false,
    })
    const pharmRole = await Role.create({
      name: `${PREFIX}pharm`,
      slug: `${PREFIX}pharm`,
      accessRole: 'Pharmacist',
      permissions: ['patients.view'],
      active: true,
      system: false,
    })
    created.roles.push(receptionRole._id, nightRole._id, pharmRole._id)

    desk = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Desk Sara',
      role: 'Reception',
      roleId: receptionRole._id,
      status: 'active',
    })
    night = await User.create({
      email: `${PREFIX}night@example.invalid`,
      username: `${PREFIX}night`,
      password: await bcrypt.hash('password', 8),
      name: 'Night Desk',
      role: 'Reception',
      roleId: nightRole._id,
      status: 'active',
    })
    pharmacist = await User.create({
      email: `${PREFIX}pharm@example.invalid`,
      username: `${PREFIX}pharm`,
      password: await bcrypt.hash('password', 8),
      name: 'Pharmacist',
      role: 'Pharmacist',
      roleId: pharmRole._id,
      status: 'active',
    })
    created.users.push(desk._id, night._id, pharmacist._id)

    await Patient.create({
      patientId,
      name: 'Old Name',
      gender: 'Female',
      age: 30,
      dateOfBirth: '1996-01-01',
      address: 'Old street',
      phone: '0911000000',
      admissionDate: todayStr(),
      status: 'admitted',
      depositTotal: 0,
    })
    await PharmacyOrder.create({
      submissionId: `${PREFIX}sub`,
      patientId,
      patientName: 'Old Name',
      requestedAt: new Date().toISOString(),
      items: [],
    })

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
  })

  after(async () => {
    await PharmacyOrder.deleteMany({ patientId })
    await Patient.deleteMany({ patientId })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('lets reception correct name, birthday, and address', async () => {
    const denied = await request(app, `/api/patients/${patientId}`, {
      token: sign(pharmacist),
      method: 'PATCH',
      body: { name: 'Should Not Save' },
    })
    assert.equal(denied.status, 403)

    const invalid = await request(app, `/api/patients/${patientId}`, {
      token: sign(desk),
      method: 'PATCH',
      body: { name: '' },
    })
    assert.equal(invalid.status, 400)

    const saved = await request(app, `/api/patients/${patientId}`, {
      token: sign(desk),
      method: 'PATCH',
      body: {
        name: 'Hana Bekele',
        gender: 'Female',
        dateOfBirth: '1994-02-11',
        address: 'Kebele 05, Dire Dawa',
        phone: '0911234567',
      },
    })
    assert.equal(saved.status, 200, saved.body.error)
    assert.equal(saved.body.patient.name, 'Hana Bekele')
    assert.equal(saved.body.patient.dateOfBirth, '1994-02-11')
    assert.equal(saved.body.patient.address, 'Kebele 05, Dire Dawa')
    assert.equal(saved.body.patient.age, computeAgeFromDob('1994-02-11'))

    const order = await PharmacyOrder.findOne({ patientId })
    assert.equal(order.patientName, 'Hana Bekele')

    const nightEdit = await request(app, `/api/patients/${patientId}`, {
      token: sign(night),
      method: 'PATCH',
      body: { name: 'Hana Bekele Night', gender: 'Female', address: 'Kebele 06' },
    })
    assert.equal(nightEdit.status, 200, nightEdit.body.error)
    assert.equal(nightEdit.body.patient.name, 'Hana Bekele Night')
    assert.equal(nightEdit.body.patient.address, 'Kebele 06')
  })
})
