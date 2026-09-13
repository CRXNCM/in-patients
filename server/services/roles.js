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
