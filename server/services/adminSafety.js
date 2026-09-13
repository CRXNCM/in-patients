import { Role } from '../models/Role.js'
import { User } from '../models/User.js'
import { roleIsPrivileged } from '../utils/permissions.js'

async function privilegedRoleIds() {
  const roles = await Role.find()
  return roles.filter(roleIsPrivileged).map((role) => role._id)
}

export async function countPrivilegedUsers(excludeUserId) {
  const roleIds = await privilegedRoleIds()
  if (!roleIds.length) return 0
  const filter = { status: 'active', roleId: { $in: roleIds } }
  if (excludeUserId) filter._id = { $ne: excludeUserId }
  return User.countDocuments(filter)
}

export async function assertKeepsAdministrator({ excludeUserId, nextRole, nextStatus } = {}) {
  if (nextStatus === 'inactive' || (nextRole && !roleIsPrivileged(nextRole))) {
    const remaining = await countPrivilegedUsers(excludeUserId)
    if (remaining < 1) {
      return 'This change would leave the hospital without an administrator who can manage users.'
    }
  }
  return null
}

export async function assertRoleChangeKeepsAdministrator(role, nextPermissions, nextActive) {
  if (!roleIsPrivileged(role)) return null

  const hypothetical = {
    slug: role.slug,
    permissions: nextPermissions !== undefined ? nextPermissions : role.permissions,
    active: nextActive !== undefined ? nextActive : role.active,
  }
  if (roleIsPrivileged(hypothetical)) return null

  const assigned = await User.countDocuments({ roleId: role._id, status: 'active' })
  const remaining = await countPrivilegedUsers()
  if (remaining - assigned < 1) {
    return 'This change would leave the hospital without an administrator who can manage users.'
  }
  return null
}
