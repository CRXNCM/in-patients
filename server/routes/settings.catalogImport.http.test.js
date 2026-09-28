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
import { buildCatalogImportTemplateCsv } from '../utils/catalogImport.js'

const PREFIX = 'catalog-import-test-'
const ITEM_A = 'BULK-IMPORT-TEST Creatinine'
const ITEM_B = 'BULK-IMPORT-TEST Wound Dressing'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, { token, method = 'GET', body, raw = false } = {}) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: raw ? 'text/csv' : 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = raw ? await res.text() : await res.json().catch(() => ({}))
    return { status: res.status, body: payload }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('catalog bulk import HTTP', { skip: !hasDb }, () => {
  let app
  let admin
  let viewer
  let recordsBefore = 0
  const created = { roles: [], users: [] }

  async function makeUser({ slug, permissions, accessRole = 'Admin' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary catalog import test role',
      permissions,
      active: true,
      system: false,
    })
    created.roles.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Catalog import ${slug}`,
      role: accessRole,
      roleId: role._id,
      status: 'active',
    })
    created.users.push(user._id)
    return user
  }

  async function cleanupTestItems() {
    await ServiceCategory.updateMany(
      { slug: { $in: ['laboratory', 'procedures', 'pharmacy'] } },
      { $pull: { services: { name: { $in: [ITEM_A, ITEM_B] } } } }
    )
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await cleanupTestItems()

    recordsBefore = await ServiceRecord.countDocuments()
    admin = await makeUser({ slug: 'admin', permissions: ['system.view_settings', 'system.modify_settings'] })
    viewer = await makeUser({ slug: 'viewer', permissions: ['system.view_settings'] })

    app = express()
    app.use(express.json({ limit: '1mb' }))
    app.use('/api/settings', settingsRoutes)
  })

  after(async () => {
    await cleanupTestItems()
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await mongoose.disconnect()
  })

  it('lets an admin download the CSV template', async () => {
    const res = await request(app, '/api/settings/catalog/import/template', { token: sign(admin), raw: true })
    assert.equal(res.status, 200)
    assert.equal(res.body, buildCatalogImportTemplateCsv())
  })

  it('previews adds and skips without writing, then imports only new items', async () => {
    const lab = await ServiceCategory.findOne({ slug: 'laboratory' }).lean()
    const existingName = lab.services[0].name
    const existingPrice = lab.services[0].price
    const labCountBefore = lab.services.length

    const rows = [
      { category: 'laboratory', subcategory: 'Chemistry', name: ITEM_A, unit: 'test', price: 250 },
      { category: 'laboratory', name: existingName, unit: 'test', price: Number(existingPrice) + 50 },
      { category: 'procedures', name: ITEM_B, unit: 'procedure', price: 800 },
      { category: 'room', name: 'ICU Daily', unit: 'day', price: 8000 },
    ]

    const preview = await request(app, '/api/settings/catalog/import/preview', {
      token: sign(admin),
      method: 'POST',
      body: { rows },
    })
    assert.equal(preview.status, 200)
    assert.equal(preview.body.counts.add, 2)
    assert.equal(preview.body.counts.skip, 1)
    assert.equal(preview.body.counts.error, 1)

    const stillPreview = await ServiceCategory.findOne({ slug: 'laboratory' }).lean()
    assert.equal(stillPreview.services.length, labCountBefore)
    assert.equal(
      stillPreview.services.find((item) => item.name === existingName).price,
      existingPrice
    )

    const applied = await request(app, '/api/settings/catalog/import', {
      token: sign(admin),
      method: 'POST',
      body: { rows },
    })
    assert.equal(applied.status, 200)
    assert.equal(applied.body.added, 2)
    assert.ok(applied.body.items.some((item) => item.name === ITEM_A && item.slug === 'laboratory'))

    const after = await ServiceCategory.findOne({ slug: 'laboratory' }).lean()
    const imported = after.services.find((item) => item.name === ITEM_A)
    assert.ok(imported)
    assert.equal(imported.price, 250)
    assert.equal(imported.subcategory, 'Chemistry')
    assert.notEqual(imported.active, false)
    assert.equal(after.services.find((item) => item.name === existingName).price, existingPrice)

    const again = await request(app, '/api/settings/catalog/import', {
      token: sign(admin),
      method: 'POST',
      body: { rows },
    })
    assert.equal(again.status, 200)
    assert.equal(again.body.added, 0)
    assert.equal(again.body.counts.skip, 3)
  })

  it('accepts the template CSV and rejects viewers', async () => {
    const csv = await request(app, '/api/settings/catalog/import/preview', {
      token: sign(admin),
      method: 'POST',
      body: { csv: buildCatalogImportTemplateCsv() },
    })
    assert.equal(csv.status, 200)
    assert.ok(csv.body.counts.add + csv.body.counts.skip >= 3)

    const forbidden = await request(app, '/api/settings/catalog/import/preview', {
      token: sign(viewer),
      method: 'POST',
      body: { rows: [{ category: 'laboratory', name: ITEM_A, price: 1 }] },
    })
    assert.equal(forbidden.status, 403)
  })

  it('does not modify existing patient service records', async () => {
    const recordsAfter = await ServiceRecord.countDocuments()
    assert.equal(recordsAfter, recordsBefore)
  })
})
