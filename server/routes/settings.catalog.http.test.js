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
import { ServiceCategory } from '../models/ServiceCategory.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import settingsRoutes from './settings.routes.js'

const PREFIX = 'catalog-test-'
const TEST_ITEM_NAME = 'TEST - DELETE ME'
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

describe('catalog item CRUD HTTP', { skip: !hasDb }, () => {
  let app
  let admin
  let viewer
  let outsider
  let clinician
  let recordsBefore = 0
  const created = { roles: [], users: [] }
  const createdItemIds = []

  async function makeUser({ slug, permissions, accessRole = 'Admin' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary catalog test role',
      permissions,
      active: true,
      system: false,
    })
    created.roles.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Catalog ${slug}`,
      role: accessRole,
      roleId: role._id,
      status: 'active',
    })
    created.users.push(user._id)
    return user
  }

  async function cleanupTestItems() {
    await ServiceCategory.updateOne(
      { slug: 'pharmacy' },
      { $pull: { services: { name: TEST_ITEM_NAME } } }
    )
    for (const id of createdItemIds) {
      await ServiceCategory.updateOne(
        { slug: 'pharmacy' },
        { $pull: { services: { _id: id } } }
      )
    }
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await cleanupTestItems()

    recordsBefore = await ServiceRecord.countDocuments()
    admin = await makeUser({ slug: 'admin', permissions: ['system.view_settings', 'system.modify_settings'] })
    viewer = await makeUser({ slug: 'viewer', permissions: ['system.view_settings'] })
    outsider = await makeUser({ slug: 'outsider', permissions: ['reports.view'], accessRole: 'Manager' })
    clinician = await makeUser({
      slug: 'clinician',
      permissions: ['patients.view', 'admissions.view'],
      accessRole: 'Nurse',
    })

    app = express()
    app.use(express.json())
    app.use('/api/settings', settingsRoutes)
  })

  after(async () => {
    await cleanupTestItems()
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('GET existing categories still includes name, price, and active flags', async () => {
    const res = await request(app, '/api/settings/categories', { token: sign(clinician) })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
    const pharmacy = res.body.find((c) => c.id === 'pharmacy')
    assert.ok(pharmacy, 'seeded pharmacy category must still exist')
    assert.equal(pharmacy.billingType, 'quantity')
    assert.ok(Array.isArray(pharmacy.services))
    assert.ok(pharmacy.services.length > 0, 'existing pharmacy items must remain available')
    const sample = pharmacy.services[0]
    assert.equal(typeof sample.id, 'string')
    assert.ok(sample.id.length > 0)
    assert.equal(typeof sample.name, 'string')
    assert.equal(typeof sample.price, 'number')
    assert.equal(typeof sample.unit, 'string')
    assert.equal(typeof sample.active, 'boolean')
  })

  it('GET pharmacy services returns persisted catalog items', async () => {
    const res = await request(app, '/api/settings/categories/pharmacy/services', { token: sign(viewer) })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
    assert.ok(res.body.some((item) => item.name && Number.isFinite(item.price)))
    assert.ok(res.body.every((item) => item.id && item.active !== undefined))
  })

  it('creates, reloads, updates, and deactivates a temporary catalog item', async () => {
    const created = await request(app, '/api/settings/categories/pharmacy/services', {
      token: sign(admin),
      method: 'POST',
      body: { name: TEST_ITEM_NAME, price: 12, unit: 'tablet', _id: 'client-id', active: false },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.name, TEST_ITEM_NAME)
    assert.equal(created.body.price, 12)
    assert.equal(created.body.unit, 'tablet')
    assert.equal(created.body.active, true)
    assert.notEqual(created.body.id, 'client-id')
    createdItemIds.push(created.body.id)

    const stored = await ServiceCategory.findOne({ slug: 'pharmacy' }).lean()
    const persisted = stored.services.find((item) => String(item._id) === created.body.id)
    assert.ok(persisted, 'item must exist in MongoDB after create')
    assert.equal(persisted.name, TEST_ITEM_NAME)
    assert.equal(persisted.active, true)

    const reloaded = await request(app, '/api/settings/categories/pharmacy/services', { token: sign(admin) })
    assert.ok(reloaded.body.some((item) => item.id === created.body.id && item.name === TEST_ITEM_NAME))

    const patched = await request(app, `/api/settings/categories/pharmacy/services/${created.body.id}`, {
      token: sign(admin),
      method: 'PATCH',
      body: { name: TEST_ITEM_NAME, price: 18, unit: 'vial' },
    })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.price, 18)
    assert.equal(patched.body.unit, 'vial')
    assert.equal(patched.body.active, true)

    const deactivated = await request(app, `/api/settings/categories/pharmacy/services/${created.body.id}`, {
      token: sign(admin),
      method: 'PATCH',
      body: { active: false },
    })
    assert.equal(deactivated.status, 200)
    assert.equal(deactivated.body.active, false)

    const after = await ServiceCategory.findOne({ slug: 'pharmacy' }).lean()
    const stillThere = after.services.find((item) => String(item._id) === created.body.id)
    assert.ok(stillThere)
    assert.equal(stillThere.active, false)
    assert.equal(stillThere.name, TEST_ITEM_NAME)
  })

  it('rejects unauthorized create and update', async () => {
    const viewerCreate = await request(app, '/api/settings/categories/pharmacy/services', {
      token: sign(viewer),
      method: 'POST',
      body: { name: TEST_ITEM_NAME, price: 1 },
    })
    assert.equal(viewerCreate.status, 403)

    const outsiderGet = await request(app, '/api/settings/categories/pharmacy/services', { token: sign(outsider) })
    assert.equal(outsiderGet.status, 403)

    const unauth = await request(app, '/api/settings/categories/pharmacy/services', {
      method: 'POST',
      body: { name: TEST_ITEM_NAME, price: 1 },
    })
    assert.equal(unauth.status, 401)
  })

  it('rejects invalid prices and unknown category slugs', async () => {
    const badPrice = await request(app, '/api/settings/categories/pharmacy/services', {
      token: sign(admin),
      method: 'POST',
      body: { name: TEST_ITEM_NAME, price: -25 },
    })
    assert.equal(badPrice.status, 400)
    assert.match(badPrice.body.error || '', /0 or more/)

    const missing = await request(app, '/api/settings/categories/not-a-real-slug/services', { token: sign(admin) })
    assert.equal(missing.status, 404)

    const missingWrite = await request(app, '/api/settings/categories/not-a-real-slug/services', {
      token: sign(admin),
      method: 'POST',
      body: { name: TEST_ITEM_NAME, price: 10 },
    })
    assert.equal(missingWrite.status, 404)
  })

  it('does not modify existing patient service records', async () => {
    const recordsAfter = await ServiceRecord.countDocuments()
    assert.equal(recordsAfter, recordsBefore)
  })
})
