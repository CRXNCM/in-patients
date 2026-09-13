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
import { HospitalSettings } from '../models/HospitalSettings.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import settingsRoutes from './settings.routes.js'

const PREFIX = 'settings-test-'
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

describe('/api/settings HTTP', { skip: !hasDb }, () => {
  let app
  let admin
  let viewer
  let outsider
  let snapshot = null
  const created = { roles: [], users: [] }

  async function makeUser({ slug, permissions, accessRole = 'Admin' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary settings test role',
      permissions,
      active: true,
      system: false,
    })
    created.roles.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Settings ${slug}`,
      role: accessRole,
      roleId: role._id,
      status: 'active',
    })
    created.users.push(user._id)
    return user
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })

    // The settings document is a singleton, so snapshot it and put it back afterwards.
    snapshot = await HospitalSettings.findOne({ key: 'default' }).lean()

    admin = await makeUser({ slug: 'admin', permissions: ['system.view_settings', 'system.modify_settings'] })
    viewer = await makeUser({ slug: 'viewer', permissions: ['system.view_settings'] })
    outsider = await makeUser({ slug: 'outsider', permissions: ['reports.view'], accessRole: 'Manager' })

    app = express()
    app.use(express.json())
    app.use('/api/settings', settingsRoutes)
  })

  after(async () => {
    if (snapshot) {
      const { _id, ...rest } = snapshot
      await HospitalSettings.replaceOne({ key: 'default' }, rest, { upsert: true })
    } else {
      await HospitalSettings.deleteOne({ key: 'default' })
    }
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('rejects unauthenticated access', async () => {
    assert.equal((await request(app, '/api/settings')).status, 401)
    assert.equal((await request(app, '/api/settings', { method: 'PUT', body: { name: 'X' } })).status, 401)
  })

  it('forbids reading without a settings or patient permission', async () => {
    const res = await request(app, '/api/settings', { token: sign(outsider) })
    assert.equal(res.status, 403)
  })

  it('forbids writing without system.modify_settings', async () => {
    const res = await request(app, '/api/settings', {
      token: sign(viewer),
      method: 'PUT',
      body: { name: 'Should Not Save' },
    })
    assert.equal(res.status, 403)
    const stored = await HospitalSettings.findOne({ key: 'default' }).lean()
    assert.notEqual(stored?.name, 'Should Not Save')
  })

  it('returns hospital information plus resolved defaults for new fields', async () => {
    const res = await request(app, '/api/settings', { token: sign(admin) })
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.name, 'string')
    assert.match(String(res.body.currency || ''), /^[A-Z]{3}$/)
    assert.ok(Array.isArray(res.body.paymentMethods) && res.body.paymentMethods.length)
    assert.ok(res.body.paymentMethods.every((method) => ['Cash', 'Bank Transfer', 'Ebirr', 'Other'].includes(method)))
    assert.ok(res.body.paymentMethods.includes(res.body.defaultPaymentMethod))
    assert.equal(typeof res.body.receiptPrefix, 'string')
    assert.equal(typeof res.body.creditAdmissionsEnabled, 'boolean')
    assert.equal(typeof res.body.allowDischargeWithOutstandingBalance, 'boolean')
    assert.ok(Number.isInteger(res.body.listPageSize))
    assert.equal('password' in res.body, false)
    assert.equal('key' in res.body, false)
  })

  it('saves billing and payment configuration and reloads it', async () => {
    const put = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: {
        currency: 'ETB',
        vatPercent: 15,
        paymentMethods: ['Cash', 'Bank Transfer'],
        defaultPaymentMethod: 'Bank Transfer',
        referenceRequiredMethods: ['Bank Transfer'],
      },
    })
    assert.equal(put.status, 200)
    assert.equal(put.body.vatPercent, 15)

    const get = await request(app, '/api/settings', { token: sign(admin) })
    assert.deepEqual(get.body.paymentMethods, ['Cash', 'Bank Transfer'])
    assert.equal(get.body.defaultPaymentMethod, 'Bank Transfer')
    assert.deepEqual(get.body.referenceRequiredMethods, ['Bank Transfer'])
  })

  it('saves receipt and invoice configuration while preserving the existing receipt footer', async () => {
    const before = await request(app, '/api/settings', { token: sign(admin) })
    const existingFooter = before.body.receiptFooter
    assert.ok(existingFooter, 'seeded receipt footer is required for this test')

    const put = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: {
        receiptHeader: 'Patient Deposit',
        receiptPrefix: 'RCP-',
        receiptShowPhone: true,
        invoiceHeader: 'Inpatient Statement',
        invoiceFooter: 'Payable within 15 days',
        invoiceShowTin: false,
      },
    })
    assert.equal(put.status, 200)

    const get = await request(app, '/api/settings', { token: sign(admin) })
    assert.equal(get.body.receiptFooter, existingFooter)
    assert.equal(get.body.receiptHeader, 'Patient Deposit')
    assert.equal(get.body.receiptPrefix, 'RCP-')
    assert.equal(get.body.receiptShowPhone, true)
    assert.equal(get.body.invoiceHeader, 'Inpatient Statement')
    assert.equal(get.body.invoiceFooter, 'Payable within 15 days')
    assert.equal(get.body.invoiceShowTin, false)
  })

  it('saves financial rules and system settings and reloads them', async () => {
    const put = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: {
        lowBalanceThreshold: 5000,
        minimumInitialDeposit: 12000,
        creditAdmissionsEnabled: false,
        allowDischargeWithOutstandingBalance: false,
        timezone: 'Africa/Addis_Ababa',
        dateFormat: 'iso',
        timeFormat: '24h',
        listPageSize: 25,
      },
    })
    assert.equal(put.status, 200)

    const get = await request(app, '/api/settings', { token: sign(admin) })
    assert.equal(get.body.lowBalanceThreshold, 5000)
    assert.equal(get.body.minimumInitialDeposit, 12000)
    assert.equal(get.body.creditAdmissionsEnabled, false)
    assert.equal(get.body.allowDischargeWithOutstandingBalance, false)
    assert.equal(get.body.timezone, 'Africa/Addis_Ababa')
    assert.equal(get.body.dateFormat, 'iso')
    assert.equal(get.body.timeFormat, '24h')
    assert.equal(get.body.listPageSize, 25)
  })

  it('keeps untouched sections when one section is saved', async () => {
    const before = await request(app, '/api/settings', { token: sign(admin) })
    const put = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { lowBalanceThreshold: 4500 },
    })
    assert.equal(put.status, 200)
    assert.equal(put.body.name, before.body.name)
    assert.equal(put.body.address, before.body.address)
    assert.equal(put.body.tin, before.body.tin)
    assert.equal(put.body.receiptFooter, before.body.receiptFooter)
    assert.equal(put.body.dailyDoctorVisitFee, before.body.dailyDoctorVisitFee)
    assert.equal(put.body.minimumInitialDeposit, before.body.minimumInitialDeposit)
    assert.equal(put.body.lowBalanceThreshold, 4500)
  })

  it('rejects invalid monetary and configuration values without saving', async () => {
    const before = await request(app, '/api/settings', { token: sign(admin) })

    const badMoney = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { lowBalanceThreshold: -100 },
    })
    assert.equal(badMoney.status, 400)
    assert.equal(badMoney.body.error, 'Low balance threshold must be a number of 0 or more.')

    const badVat = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { vatPercent: 250 },
    })
    assert.equal(badVat.status, 400)

    const badZone = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { timezone: 'Nowhere/Special' },
    })
    assert.equal(badZone.status, 400)

    const badMethod = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { paymentMethods: ['Barter'] },
    })
    assert.equal(badMethod.status, 400)

    const after = await request(app, '/api/settings', { token: sign(admin) })
    assert.equal(after.body.lowBalanceThreshold, before.body.lowBalanceThreshold)
    assert.equal(after.body.vatPercent, before.body.vatPercent)
    assert.equal(after.body.timezone, before.body.timezone)
    assert.deepEqual(after.body.paymentMethods, before.body.paymentMethods)
  })

  it('ignores unknown fields instead of writing them', async () => {
    const res = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { name: 'Central City Hospital', hackedField: 'nope', key: 'other' },
    })
    assert.equal(res.status, 200)
    const stored = await HospitalSettings.findOne({ key: 'default' }).lean()
    assert.equal(stored.key, 'default')
    assert.equal('hackedField' in stored, false)
  })

  it('rejects a body with no known settings', async () => {
    const res = await request(app, '/api/settings', {
      token: sign(admin),
      method: 'PUT',
      body: { totallyUnknown: 1 },
    })
    assert.equal(res.status, 400)
  })

  it('still serves category billing types', async () => {
    const res = await request(app, '/api/settings/categories', { token: sign(admin) })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
    const total = await ServiceCategory.countDocuments()
    assert.equal(res.body.length, total)
    if (res.body.length) {
      assert.ok('billingType' in res.body[0])
      assert.ok('name' in res.body[0])
    }
  })
})
