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
import { CreditCompany } from '../models/CreditCompany.js'
import { Deposit } from '../models/Deposit.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import patientRoutes from './patients.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'cred-pay-'
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

describe('credit reception payments', { skip: !hasDb }, () => {
  let app
  let desk
  let company
  let patient
  const created = { roles: [], users: [], patients: [], companies: [] }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await CreditCompany.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })

    const role = await Role.create({
      name: `${PREFIX}credit-desk`,
      slug: `${PREFIX}credit-desk`,
      accessRole: 'Reception',
      permissions: ['patients.view', 'payments.create', 'credit.view', 'credit.record_payment', 'credit.settle'],
      active: true,
      system: false,
    })
    created.roles.push(role._id)
    desk = await User.create({
      email: `${PREFIX}desk@example.invalid`,
      username: `${PREFIX}desk`,
      password: await bcrypt.hash('password', 8),
      name: 'Credit Desk',
      role: 'Reception',
      roleId: role._id,
      status: 'active',
    })
    created.users.push(desk._id)

    company = await CreditCompany.create({
      name: `${PREFIX} Nile Cover`,
      nameKey: `${PREFIX}nile cover`,
      active: true,
    })
    created.companies.push(company._id)

    patient = await Patient.create({
      patientId: `${PREFIX}PAT-1`,
      name: `${PREFIX} Credit Ada`,
      gender: 'Female',
      age: 34,
      admissionDate: todayStr(),
      status: 'admitted',
      admissionPaymentMode: 'credit',
      isCreditPatient: true,
      creditCompanyId: String(company._id),
      creditCompanyName: company.name,
      depositTotal: 0,
      requiredInitialDeposit: 0,
    })
    created.patients.push(patient.patientId)
    await ServiceRecord.create({
      patientId: patient.patientId,
      recordName: patient.name,
      date: todayStr(),
      status: 'approved',
      services: [{ id: 'lab-1', category: 'Laboratory', serviceName: 'CBC', quantity: 1, unitPrice: 5000, total: 5000 }],
      submittedBy: 'Nurse',
      recordedAt: new Date(),
    })

    app = express()
    app.use(express.json())
    app.use('/api/patients', patientRoutes)
  })

  after(async () => {
    await Deposit.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await CreditCompany.deleteMany({ _id: { $in: created.companies } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('records a partial company payment with an invoice, then settles on the remaining amount', async () => {
    const partial = await request(app, `/api/patients/${patient.patientId}/credit-payments`, {
      token: sign(desk),
      method: 'POST',
      body: {
        payerType: 'company',
        creditCompanyId: String(company._id),
        amount: 2000,
        method: 'Cash',
      },
    })
    assert.equal(partial.status, 201, partial.body.error)
    assert.equal(partial.body.settled, false)
    assert.equal(partial.body.outstanding, 3000)
    assert.ok(partial.body.invoice?.invoiceNumber)
    assert.equal(partial.body.patient.isCreditPatient, true)
    assert.equal(partial.body.patient.depositStatus, 'partially-paid')

    const rest = await request(app, `/api/patients/${patient.patientId}/credit-payments`, {
      token: sign(desk),
      method: 'POST',
      body: {
        payerType: 'self',
        amount: 3000,
        method: 'Cash',
      },
    })
    assert.equal(rest.status, 201, rest.body.error)
    assert.equal(rest.body.settled, true)
    assert.equal(rest.body.outstanding, 0)
    assert.equal(rest.body.patient.isCreditPatient, false)
    assert.equal(rest.body.patient.admissionPaymentMode, 'paid')
    assert.equal(rest.body.patient.formerCreditPatient, true)
    assert.equal(rest.body.patient.depositStatus, 'paid')
    assert.equal(rest.body.patient.formerCreditCompanyName, company.name)

    const stored = await Patient.findOne({ patientId: patient.patientId })
    assert.equal(stored.formerCreditPatient, true)
    assert.equal(stored.admissionPaymentMode, 'paid')
    assert.equal(stored.creditEvents.length, 2)
  })
})
