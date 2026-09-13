import { Router } from 'express'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { slugify, toFrontendRole, validateRoleBody } from '../utils/roles.js'
import { PERMISSION_CATALOG, buildPermissionPresets, permissionDiff, sanitizePermissions } from '../utils/permissions.js'
import { assertRoleChangeKeepsAdministrator } from '../services/adminSafety.js'
import { recordSecurityEvent } from '../services/securityAudit.js'

const router = Router()

router.use(authRequired)

router.get('/catalog', requirePermission('users.view'), async (_req, res) => {
  const presets = buildPermissionPresets()
  res.json({
    modules: PERMISSION_CATALOG,
    presets,
    total: PERMISSION_CATALOG.reduce((sum, group) => sum + group.permissions.length, 0),
  })
})

router.get('/', requirePermission('users.view'), async (_req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 })
    const counts = await User.aggregate([
      { $match: { roleId: { $ne: null } } },
      { $group: { _id: '$roleId', count: { $sum: 1 } } },
    ])
    const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.count]))
    res.json(roles.map((role) => toFrontendRole(role, countMap[role._id.toString()] || 0)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load roles' })
  }
})

router.post('/', requirePermission('users.edit'), async (req, res) => {
  try {
    const errors = validateRoleBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const name = String(req.body.name).trim()
    const slug = slugify(req.body.slug || name)
    const exists = await Role.findOne({ $or: [{ name }, { slug }] })
    if (exists) return res.status(400).json({ error: 'A role with this name already exists.' })

    const permissions = sanitizePermissions(req.body.permissions)
    const role = await Role.create({
      name,
      slug,
      accessRole: req.body.accessRole,
      description: String(req.body.description || '').trim(),
      permissions,
      permissionsSetAt: new Date(),
      active: req.body.active !== false,
      system: false,
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    await recordSecurityEvent({
      action: 'role.created',
      actor: req.user,
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      added: permissions,
    })
    res.status(201).json(toFrontendRole(role, 0))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create role' })
  }
})

router.get('/:id', requirePermission('users.view'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ error: 'Role not found' })
    const userCount = await User.countDocuments({ roleId: role._id })
    res.json(toFrontendRole(role, userCount))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load role' })
  }
})

router.patch('/:id', requirePermission('users.edit'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ error: 'Role not found' })

    const errors = validateRoleBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const beforePermissions = [...(role.permissions || [])]

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim()
      const dup = await Role.findOne({ name, _id: { $ne: role._id } })
      if (dup) return res.status(400).json({ error: 'A role with this name already exists.' })
      if (role.system && name !== role.name) {
        return res.status(400).json({ error: 'System role names cannot be changed.' })
      }
      role.name = name
      if (!role.system) role.slug = slugify(name)
    }
    if (req.body.description !== undefined) role.description = String(req.body.description).trim()
    if (req.body.accessRole !== undefined) {
      if (role.system && req.body.accessRole !== role.accessRole) {
        return res.status(400).json({ error: 'System role application access cannot be changed.' })
      }
      role.accessRole = req.body.accessRole
    }
    if (req.body.active !== undefined) {
      if (role.system && req.body.active === false) {
        return res.status(400).json({ error: 'System roles cannot be deactivated.' })
      }
      role.active = !!req.body.active
    }
    if (req.body.permissions !== undefined) {
      role.permissions = sanitizePermissions(req.body.permissions)
      role.permissionsSetAt = new Date()
    }

    const safetyError = await assertRoleChangeKeepsAdministrator(role, role.permissions, role.active)
    if (safetyError) return res.status(400).json({ error: safetyError })

    role.updatedBy = req.user.name
    await role.save()

    const diff = permissionDiff(beforePermissions, role.permissions)
    await recordSecurityEvent({
      action: 'role.updated',
      actor: req.user,
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      added: diff.added,
      removed: diff.removed,
      note: [diff.removed.length ? `Removed: ${diff.removed.join(', ')}` : '', diff.added.length ? `Added: ${diff.added.join(', ')}` : '']
        .filter(Boolean)
        .join('. '),
    })

    const userCount = await User.countDocuments({ roleId: role._id })
    res.json(toFrontendRole(role, userCount))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

export default router
