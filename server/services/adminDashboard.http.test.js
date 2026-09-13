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
import adminRoutes from '../routes/admin.routes.js'
import { ADMIN_DASHBOARD_PERMISSIONS } from './adminDashboard.js'

const PREFIX = 'admdash-test-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, token) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: 'application/json' }
    if (token !== undefined) headers.Authorization = token ? `Bearer ${token}` : ''
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('GET /api/admin/dashboard HTTP', { skip: !hasDb }, () => {
  let app
  const createdRoleIds = []
  const createdUserIds = []

  async function makeUser({ permissions, slug, accessRole = 'Admin', accessLabel = 'Admin', roleDoc }) {
    const role =
      roleDoc ||
      (await Role.create({
        name: `${PREFIX}${slug}`,
        slug: `${PREFIX}${slug}`,
        accessRole,
        description: 'Temporary admin dashboard test role',
        permissions,
        active: true,
        system: false,
      }))
    if (!roleDoc) createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: `Dash Test ${slug}`,
      role: accessLabel,
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
    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)
  })

  after(async () => {
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('rejects missing and invalid tokens', async () => {
    const none = await request(app, '/api/admin/dashboard')
    assert.equal(none.status, 401)
    assert.equal(none.body.error, 'Unauthorized')

    const bad = await request(app, '/api/admin/dashboard', 'not-a-jwt')
    assert.equal(bad.status, 401)
    assert.equal(bad.body.error, 'Invalid or expired token')
  })

  it('forbids a user with no dashboard permissions', async () => {
    const user = await makeUser({ permissions: ['reports.view'], slug: 'none' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'Forbidden')
  })

  it('returns only patient sections for patients.view', async () => {
    const user = await makeUser({ permissions: ['patients.view'], slug: 'patients' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(Array.isArray(res.body.recentAdmissions))
    assert.equal(res.body.recentAdmissions.length <= 8, true)
    assert.equal(res.body.beds, undefined)
    assert.equal(res.body.setup, undefined)
    assert.equal(res.body.catalog, undefined)
    assert.equal(res.body.finance, undefined)
    assert.equal(res.body.credit, undefined)
    assert.equal(res.body.stats, undefined)
    for (const row of res.body.recentAdmissions) {
      assert.ok(row.patientId)
      assert.equal(row.phone, undefined)
      assert.equal(row.balance, undefined)
      assert.equal(row.isCreditPatient, undefined)
    }
  })

  it('adds occupancy when patients.view and beds.view are granted', async () => {
    const user = await makeUser({ permissions: ['patients.view', 'beds.view'], slug: 'patients-beds' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.beds)
    assert.equal(typeof res.body.beds.occupancyPercentage, 'number')
    assert.equal(res.body.setup.beds, res.body.beds.total)
    assert.equal(res.body.setup.departments, undefined)
    assert.equal(res.body.finance, undefined)
  })

  it('returns deposits without credit when only payments.view is granted', async () => {
    const user = await makeUser({ permissions: ['payments.view'], slug: 'payments' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok('todayDeposits' in res.body.finance)
    assert.equal(res.body.credit, undefined)
    assert.equal(res.body.census, undefined)
  })

  it('returns credit without finance when only credit.view is granted', async () => {
    const user = await makeUser({ permissions: ['credit.view'], slug: 'credit' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok('creditAdmissions' in res.body.credit)
    assert.equal(res.body.finance, undefined)
  })

  it('returns every section for a custom role with all dashboard permissions', async () => {
    const user = await makeUser({ permissions: ADMIN_DASHBOARD_PERMISSIONS, slug: 'all-sections' })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.beds)
    assert.ok(res.body.setup)
    assert.ok(res.body.catalog)
    assert.ok(res.body.recentAdmissions)
    assert.ok(res.body.finance)
    assert.ok(res.body.credit)
    assert.equal('serviceCategories' in res.body.catalog, true)
    assert.equal('priceLines' in res.body.catalog, true)
    assert.equal('activeServices' in res.body.catalog, false)
  })

  it('returns every section for Super Admin via slug bypass', async () => {
    const existing = await Role.findOne({ slug: 'super-admin', active: { $ne: false } })
    assert.ok(existing, 'seeded Super Admin role is required')
    const user = await makeUser({
      permissions: [],
      slug: 'super',
      roleDoc: existing,
    })
    const res = await request(app, '/api/admin/dashboard', sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.census)
    assert.ok(res.body.beds)
    assert.ok(res.body.setup.users >= 1)
    assert.ok(res.body.finance)
    assert.ok(res.body.credit)
    assert.equal(res.body.stats, undefined)
    assert.equal(res.body.revenueByDepartment, undefined)
  })
})
