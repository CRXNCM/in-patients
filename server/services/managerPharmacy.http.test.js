import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import managerRoutes from '../routes/manager.routes.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'mgrpharm-test-'
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
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('GET /api/manager/pharmacy-usage HTTP', { skip: !hasDb }, () => {
  let app
  let manager
  const created = { roles: [], users: [], orders: [] }
  const today = todayStr()

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await PharmacyOrder.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    app = express()
    app.use(express.json())
    app.use('/api/manager', managerRoutes)

    const role = await Role.create({
      name: `${PREFIX}mgr`,
      slug: `${PREFIX}mgr`,
      accessRole: 'Manager',
      permissions: ['reports.view'],
      active: true,
      system: false,
    })
    created.roles.push(role._id)
    manager = await User.create({
      email: `${PREFIX}mgr@example.invalid`,
      username: `${PREFIX}mgr`,
      password: await bcrypt.hash('password', 8),
      name: 'Manager Pharmacy',
      role: 'Manager',
      roleId: role._id,
      status: 'active',
    })
    created.users.push(manager._id)

    const order = await PharmacyOrder.create({
      submissionId: `${PREFIX}sub`,
      patientId: `${PREFIX}PAT`,
      patientName: 'Pharmacy Patient',
      admissionId: `${PREFIX}stay`,
      requestedAt: `${today}T08:00:00.000Z`,
      status: 'fulfilled',
      items: [{
        lineId: 'med-1',
        name: 'Ceftriaxone 1g',
        unit: 'vial',
        requestedQuantity: 5,
        suppliedQuantity: 5,
        unitPrice: 280,
        status: 'fulfilled',
        history: [{ action: 'handed_over', quantity: 5, at: `${today}T09:00:00.000Z` }],
      }],
      returns: [],
    })
    created.orders.push(order._id)
  })

  after(async () => {
    await PharmacyOrder.deleteMany({ _id: { $in: created.orders } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
  })

  it('returns top medicines and high-use patients for the manager', async () => {
    const forbidden = await request(app, `/api/manager/pharmacy-usage?view=day&date=${today}`)
    assert.equal(forbidden.status, 401)

    const res = await request(app, `/api/manager/pharmacy-usage?view=day&date=${today}`, sign(manager))
    assert.equal(res.status, 200, res.body.error)
    assert.equal(res.body.topMedicines[0].name, 'Ceftriaxone 1g')
    assert.equal(res.body.topMedicines[0].issuedQuantity, 5)
    assert.equal(res.body.topPatients[0].patientId, `${PREFIX}PAT`)

    const printed = await request(app, `/api/manager/reports/pharmacy?view=day&date=${today}`, sign(manager))
    assert.equal(printed.status, 200, printed.body.error)
    assert.equal(printed.body.kind, 'pharmacy')
    assert.equal(printed.body.rows[0].issuedQuantity, 5)
  })
})
