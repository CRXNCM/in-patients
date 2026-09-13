import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { roleHasPermission } from '../utils/permissions.js'
import { toFrontendUser, validateUserBody } from '../utils/roles.js'
import { assertKeepsAdministrator } from '../services/adminSafety.js'
import { recordSecurityEvent } from '../services/securityAudit.js'

const router = Router()

router.use(authRequired)

async function loadRole(roleId) {
  if (!roleId || !mongoose.isValidObjectId(roleId)) return null
  return Role.findById(roleId)
}

async function roleMap(users) {
  const ids = [...new Set(users.map((u) => u.roleId).filter(Boolean).map(String))]
  if (!ids.length) return {}
  const roles = await Role.find({ _id: { $in: ids } })
  return Object.fromEntries(roles.map((role) => [role._id.toString(), role]))
}

function requireUserPatch(req, res, next) {
  const keys = Object.keys(req.body || {}).filter((key) => req.body[key] !== undefined && key !== 'id')
  const onlyStatus = keys.length === 1 && keys[0] === 'status'
  const role = req.auth.role
  if (onlyStatus) {
    if (roleHasPermission(role, 'users.disable') || roleHasPermission(role, 'users.edit')) return next()
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (roleHasPermission(role, 'users.edit')) return next()
  return res.status(403).json({ error: 'Forbidden' })
}

router.get('/', requirePermission('users.view'), async (_req, res) => {
  try {
    const users = await User.find().select('-password').sort({ name: 1 })
    const roles = await roleMap(users)
    res.json(users.map((user) => toFrontendUser(user, roles[String(user.roleId)])))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load users' })
  }
})

router.get('/:id', requirePermission('users.view'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    const role = await loadRole(user.roleId)
    res.json(toFrontendUser(user, role))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load user' })
  }
})

router.post('/', requirePermission('users.create'), async (req, res) => {
  try {
    const errors = validateUserBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const username = String(req.body.username).trim().toLowerCase()
    const email = username.includes('@') ? username : `${username}@hospital.local`
    const role = await loadRole(req.body.roleId)
    if (!role) return res.status(400).json({ error: 'Selected role was not found.' })
    if (!role.active) return res.status(400).json({ error: 'Inactive roles cannot be assigned.' })

    const exists = await User.findOne({ $or: [{ username }, { email }] })
    if (exists) return res.status(400).json({ error: 'A user with this username already exists.' })

    const user = await User.create({
      name: String(req.body.name).trim(),
      username,
      email,
      password: await bcrypt.hash(String(req.body.password), 10),
      role: role.accessRole,
      roleId: role._id,
      status: req.body.status === 'inactive' ? 'inactive' : 'active',
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    await recordSecurityEvent({
      action: 'user.created',
      actor: req.user,
      targetType: 'user',
      targetId: user._id,
      targetName: user.name,
      note: `Assigned role ${role.name}`,
    })
    res.status(201).json(toFrontendUser(user, role))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

router.patch('/:id', requireUserPatch, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const errors = validateUserBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const previousRole = await loadRole(user.roleId)
    const previousStatus = user.status
    let nextRole = previousRole

    if (req.body.name !== undefined) user.name = String(req.body.name).trim()
    if (req.body.username !== undefined) {
      const username = String(req.body.username).trim().toLowerCase()
      const email = username.includes('@') ? username : `${username}@hospital.local`
      const dup = await User.findOne({ $or: [{ username }, { email }], _id: { $ne: user._id } })
      if (dup) return res.status(400).json({ error: 'A user with this username already exists.' })
      user.username = username
      user.email = email
    }
    if (req.body.roleId !== undefined) {
      const role = await loadRole(req.body.roleId)
      if (!role) return res.status(400).json({ error: 'Selected role was not found.' })
      if (!role.active) return res.status(400).json({ error: 'Inactive roles cannot be assigned.' })
      nextRole = role
      user.roleId = role._id
      user.role = role.accessRole
    }
    if (req.body.status !== undefined) {
      if (req.params.id === req.user.id && req.body.status === 'inactive') {
        return res.status(400).json({ error: 'You cannot disable your own account.' })
      }
      user.status = req.body.status
    }

    const safetyError = await assertKeepsAdministrator({
      excludeUserId: user._id,
      nextRole,
      nextStatus: user.status,
    })
    if (safetyError) return res.status(400).json({ error: safetyError })

    if (req.body.password) {
      user.password = await bcrypt.hash(String(req.body.password), 10)
    }
    user.updatedBy = req.user.name
    await user.save()

    if (previousRole && nextRole && String(previousRole._id) !== String(nextRole._id)) {
      await recordSecurityEvent({
        action: 'user.role_changed',
        actor: req.user,
        targetType: 'user',
        targetId: user._id,
        targetName: user.name,
        removed: [previousRole.name],
        added: [nextRole.name],
        note: `Role changed from ${previousRole.name} to ${nextRole.name}`,
      })
    }
    if (req.body.status !== undefined && previousStatus !== user.status) {
      await recordSecurityEvent({
        action: user.status === 'inactive' ? 'user.disabled' : 'user.enabled',
        actor: req.user,
        targetType: 'user',
        targetId: user._id,
        targetName: user.name,
      })
    }

    const role = await loadRole(user.roleId)
    const safe = await User.findById(user._id).select('-password')
    res.json(toFrontendUser(safe, role))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

export default router
