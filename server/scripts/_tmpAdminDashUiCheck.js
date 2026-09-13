import 'dotenv/config'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { ADMIN_DASHBOARD_PERMISSIONS } from '../services/adminDashboard.js'

const PREFIX = 'admdash-ui-'
await connectDB(process.env.MONGODB_URI)
await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  )
}

async function make(slug, permissions) {
  const role = await Role.create({
    name: PREFIX + slug,
    slug: PREFIX + slug,
    accessRole: 'Admin',
    permissions,
    active: true,
    system: false,
  })
  const user = await User.create({
    email: `${PREFIX}${slug}@example.invalid`,
    username: PREFIX + slug,
    password: await bcrypt.hash('password', 8),
    name: slug,
    role: 'Admin',
    roleId: role._id,
    status: 'active',
  })
  return sign(user)
}

async function dash(token) {
  const res = await fetch('http://localhost:5000/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  return {
    status: res.status,
    keys: Object.keys(body).filter((k) => k !== 'error' && k !== 'generatedAt'),
    error: body.error,
    finance: Boolean(body.finance),
    credit: Boolean(body.credit),
  }
}

const cases = [
  ['all-perms', ADMIN_DASHBOARD_PERMISSIONS],
  ['patients-only', ['patients.view']],
  ['patients-beds', ['patients.view', 'beds.view']],
  ['payments-only', ['payments.view']],
  ['credit-only', ['credit.view']],
  ['none', ['reports.view']],
]

for (const [slug, perms] of cases) {
  const token = await make(slug, perms)
  console.log(slug, JSON.stringify(await dash(token)))
}

const none = await fetch('http://localhost:5000/api/admin/dashboard')
console.log('no-auth', none.status, JSON.stringify(await none.json()))

await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
await mongoose.disconnect()
