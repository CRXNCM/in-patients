import bcrypt from 'bcryptjs'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'
import { DEFAULT_ROLES } from '../utils/roles.js'
import { defaultPermissionsForSlug, PREDEFINED_ROLE_SLUGS } from '../utils/permissions.js'

export async function ensureDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    const permissions = defaultPermissionsForSlug(role.slug)
    const saved = await Role.findOneAndUpdate(
      { slug: role.slug },
      { $setOnInsert: { ...role, active: true, permissions, permissionsSetAt: new Date() } },
      { upsert: true, new: true }
    )
    if (!saved.permissionsSetAt || PREDEFINED_ROLE_SLUGS.includes(role.slug)) {
      saved.permissions = permissions
      saved.permissionsSetAt = new Date()
      await saved.save()
    }
  }

  const users = await User.find({ $or: [{ roleId: { $exists: false } }, { roleId: null }] })
  for (const user of users) {
    const match =
      (await Role.findOne({ name: user.role, active: true })) ||
      (await Role.findOne({ accessRole: user.role, system: true })) ||
      (await Role.findOne({ accessRole: user.role }))
    if (!match) continue
    user.roleId = match._id
    if (!user.username) user.username = user.email
    await user.save()
  }
}

const WORKFLOW_STAFF = [
  { email: 'pharmacist@cc', name: 'Dawit Lemma', role: 'Pharmacist', slug: 'pharmacist' },
  { email: 'laboratory@cc', name: 'Bethlehem Assefa', role: 'Laboratory', slug: 'laboratory' },
  { email: 'emergency-nurse@cc', name: 'Emergency Nurse Hanna', role: 'Nurse', slug: 'emergency-nurse' },
  { email: 'credit-reception@cc', name: 'Credit Reception Lulit', role: 'Reception', slug: 'credit-reception' },
]

export async function ensureWorkflowStaff() {
  const hash = await bcrypt.hash('password', 10)
  for (const spec of WORKFLOW_STAFF) {
    const role = await Role.findOne({ slug: spec.slug })
    if (!role) continue
    const existing = await User.findOne({ email: spec.email })
    if (existing) continue
    await User.create({
      email: spec.email,
      username: spec.email,
      name: spec.name,
      role: spec.role,
      roleId: role._id,
      password: hash,
      status: 'active',
    })
  }
}
