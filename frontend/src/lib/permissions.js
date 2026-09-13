export function hasPermission(user, key) {
  if (!user || !key) return false
  if (user.roleSlug === 'super-admin') return true
  return Array.isArray(user.permissions) && user.permissions.includes(key)
}

export function hasAnyPermission(user, keys = []) {
  return keys.some((key) => hasPermission(user, key))
}

export function hasAllPermissions(user, keys = []) {
  return keys.every((key) => hasPermission(user, key))
}
