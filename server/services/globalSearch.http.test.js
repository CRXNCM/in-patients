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
import { Doctor } from '../models/Doctor.js'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { Bed } from '../models/Bed.js'
import searchRoutes from '../routes/search.routes.js'

const PREFIX = 'search-test-'
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

function assertNoSecrets(body) {
  const raw = JSON.stringify(body)
  for (const key of ['password', 'visitPrice', 'deposit', 'depositTotal', 'dailyRate', 'token']) {
    assert.equal(raw.includes(`"${key}"`), false, `unexpected field ${key}`)
  }
}

describe('GET /api/search HTTP', { skip: !hasDb }, () => {
  let app
  const created = { roles: [], users: [], patients: [], doctors: [], depts: [], wards: [], rooms: [], beds: [] }

  async function makeUser({ permissions, slug, accessRole = 'Nurse', accessLabel = 'Nurse', roleDoc, name }) {
    const role =
      roleDoc ||
      (await Role.create({
        name: `${PREFIX}${slug}`,
        slug: `${PREFIX}${slug}`,
        accessRole,
        description: 'Search test role',
        permissions,
        active: true,
        system: false,
      }))
    if (!roleDoc) created.roles.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: name || `Search ${slug}`,
      role: accessLabel,
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
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Doctor.deleteMany({ name: { $regex: `^${PREFIX}` } })
    await Department.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })
    await Ward.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })
    await Room.deleteMany({ nameKey: { $regex: `^${PREFIX}` } })
    await Bed.deleteMany({ label: { $regex: `^${PREFIX}` } })

    const dept = await Department.create({ name: `${PREFIX}Cardiology`, nameKey: `${PREFIX}cardiology` })
    const ward = await Ward.create({ name: `${PREFIX}Male Ward`, nameKey: `${PREFIX}male-ward`, departmentId: dept._id })
    const room = await Room.create({
      name: `${PREFIX}Room 204`,
      nameKey: `${PREFIX}room-204`,
      wardId: ward._id,
      departmentId: dept._id,
      roomType: 'General Ward',
      capacity: 2,
      dailyRate: 900,
    })
    const bed = await Bed.create({
      label: `${PREFIX}204-A`,
      name: 'A',
      nameKey: 'a',
      roomType: 'General Ward',
      dailyRate: 900,
      status: 'available',
      roomId: room._id,
      wardId: ward._id,
      departmentId: dept._id,
    })
    created.depts.push(dept._id)
    created.wards.push(ward._id)
    created.rooms.push(room._id)
    created.beds.push(bed._id)

    const patient = await Patient.create({
      patientId: `${PREFIX}PAT-ABEBE`,
      name: `${PREFIX}Abebe Kebede`,
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: '2026-09-11',
      status: 'admitted',
      phone: '0911000000',
      mrn: `${PREFIX}MRN-1`,
      room: `${PREFIX}Room 204`,
      bed: `${PREFIX}204-A`,
      depositTotal: 4000,
      isCreditPatient: true,
    })
    created.patients.push(patient._id)

    for (let i = 0; i < 6; i += 1) {
      const doc = await Doctor.create({
        name: `${PREFIX}Dr Abebe ${i}`,
        specialty: 'Internal Medicine',
        visitPrice: 700,
        active: true,
      })
      created.doctors.push(doc._id)
    }

    app = express()
    app.use(express.json())
    app.use('/api/search', searchRoutes)
  })

  after(async () => {
    await Bed.deleteMany({ _id: { $in: created.beds } })
    await Room.deleteMany({ _id: { $in: created.rooms } })
    await Ward.deleteMany({ _id: { $in: created.wards } })
    await Department.deleteMany({ _id: { $in: created.depts } })
    await Doctor.deleteMany({ _id: { $in: created.doctors } })
    await Patient.deleteMany({ _id: { $in: created.patients } })
    await User.deleteMany({ _id: { $in: created.users } })
    await Role.deleteMany({ _id: { $in: created.roles } })
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await mongoose.disconnect()
  })

  it('rejects unauthenticated requests', async () => {
    const res = await request(app, `/api/search?q=${PREFIX}Abebe`)
    assert.equal(res.status, 401)
  })

  it('rejects empty and short queries', async () => {
    const user = await makeUser({ permissions: ['patients.view'], slug: 'q-empty' })
    const token = sign(user)
    const empty = await request(app, '/api/search?q=', token)
    assert.equal(empty.status, 400)
    const short = await request(app, '/api/search?q=a', token)
    assert.equal(short.status, 400)
  })

  it('rejects overly long queries', async () => {
    const user = await makeUser({ permissions: ['patients.view'], slug: 'q-long' })
    const long = await request(app, `/api/search?q=${'ab'.repeat(50)}`, sign(user))
    assert.equal(long.status, 400)
  })

  it('returns patients for patients.view and hides other types', async () => {
    const user = await makeUser({ permissions: ['patients.view'], slug: 'patients', accessRole: 'Nurse', accessLabel: 'Nurse' })
    const res = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Abebe`)}`, sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.groups.patients.items.some((row) => row.id === `${PREFIX}PAT-ABEBE`))
    assert.equal(res.body.groups.doctors, undefined)
    assert.equal(res.body.groups.users, undefined)
    const patient = res.body.groups.patients.items.find((row) => row.id === `${PREFIX}PAT-ABEBE`)
    assert.equal(patient.route, `/nurse/patient/${PREFIX}PAT-ABEBE`)
    assert.equal(patient.depositTotal, undefined)
    assertNoSecrets(res.body)
  })

  it('does not return patients without patients.view or admissions.view', async () => {
    const user = await makeUser({ permissions: ['doctors.view'], slug: 'no-patients', accessRole: 'Admin', accessLabel: 'Admin' })
    const res = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Abebe`)}`, sign(user))
    assert.equal(res.status, 200)
    assert.equal(res.body.groups.patients, undefined)
    assert.ok(res.body.groups.doctors)
  })

  it('requires doctors.view for doctor results and limits them', async () => {
    const user = await makeUser({ permissions: ['doctors.view'], slug: 'doctors', accessRole: 'Admin', accessLabel: 'Admin' })
    const res = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Dr Abebe`)}`, sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.groups.doctors.items.length <= 5)
    assert.equal(res.body.groups.doctors.hasMore, true)
    assert.ok(res.body.groups.doctors.items.every((row) => row.visitPrice === undefined))
  })

  it('requires rooms.view or beds.view for room and bed results', async () => {
    const allowed = await makeUser({ permissions: ['rooms.view'], slug: 'rooms', accessRole: 'Admin', accessLabel: 'Admin' })
    const denied = await makeUser({ permissions: ['patients.view'], slug: 'no-rooms', accessRole: 'Admin', accessLabel: 'Admin' })
    const ok = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Room`)}`, sign(allowed))
    const no = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Room`)}`, sign(denied))
    assert.ok(ok.body.groups.rooms.items.some((row) => row.title.includes('Room 204')))
    assert.equal(ok.body.groups.rooms.items[0].dailyRate, undefined)
    assert.equal(no.body.groups.rooms, undefined)
  })

  it('requires department and ward view permissions separately', async () => {
    const deptUser = await makeUser({ permissions: ['departments.view'], slug: 'depts', accessRole: 'Admin', accessLabel: 'Admin' })
    const wardUser = await makeUser({ permissions: ['wards.view'], slug: 'wards', accessRole: 'Admin', accessLabel: 'Admin' })
    const deptRes = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Cardiology`)}`, sign(deptUser))
    const wardRes = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}Male`)}`, sign(wardUser))
    assert.ok(deptRes.body.groups.departments.items.length >= 1)
    assert.equal(deptRes.body.groups.wards, undefined)
    assert.ok(wardRes.body.groups.wards.items.length >= 1)
    assert.equal(wardRes.body.groups.departments, undefined)
  })

  it('requires users.view for user results and never returns passwords', async () => {
    const allowed = await makeUser({ permissions: ['users.view'], slug: 'users', accessRole: 'Admin', accessLabel: 'Admin', name: `${PREFIX}User Finder` })
    const denied = await makeUser({ permissions: ['patients.view'], slug: 'no-users', accessRole: 'Admin', accessLabel: 'Admin' })
    const ok = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}User Finder`)}`, sign(allowed))
    const no = await request(app, `/api/search?q=${encodeURIComponent(`${PREFIX}User Finder`)}`, sign(denied))
    assert.ok(ok.body.groups.users.items.some((row) => row.title.includes('User Finder')))
    assert.equal(no.body.groups.users, undefined)
    assertNoSecrets(ok.body)
  })

  it('lets Super Admin search across permitted scopes', async () => {
    const existing = await Role.findOne({ slug: 'super-admin', active: { $ne: false } })
    assert.ok(existing)
    const user = await makeUser({
      permissions: [],
      slug: 'super',
      accessRole: 'Admin',
      accessLabel: 'Admin',
      roleDoc: existing,
    })
    const res = await request(app, `/api/search?q=${encodeURIComponent(PREFIX)}`, sign(user))
    assert.equal(res.status, 200)
    assert.ok(res.body.groups.patients)
    assert.ok(res.body.groups.doctors)
    assert.ok(res.body.groups.rooms)
    assert.ok(res.body.groups.departments)
    assert.ok(res.body.groups.users)
    assertNoSecrets(res.body)
  })
})
