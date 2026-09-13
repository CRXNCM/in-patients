import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { effectivePermissions, roleHasAllPermissions, roleHasAnyPermission } from '../utils/permissions.js'

export async function authRequired(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const dbUser = await User.findById(payload.id).select('-password')
    if (!dbUser || dbUser.status !== 'active') {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const role = dbUser.roleId ? await Role.findById(dbUser.roleId) : null
    req.user = {
      id: dbUser._id.toString(),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      roleKey: dbUser.role.toLowerCase(),
      roleId: dbUser.roleId ? String(dbUser.roleId) : null,
    }
    req.auth = {
      user: dbUser,
      role,
      permissions: effectivePermissions(role),
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export function requirePermission(...keys) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Unauthorized' })
    if (!roleHasAllPermissions(req.auth.role, keys)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export function requireAnyPermission(...keys) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Unauthorized' })
    if (!roleHasAnyPermission(req.auth.role, keys)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export async function attachUser(req, _res, next) {
  if (!req.user?.id) return next()
  req.dbUser = await User.findById(req.user.id).select('-password')
  next()
}
