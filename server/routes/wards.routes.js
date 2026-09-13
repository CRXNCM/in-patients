import { Router } from 'express'
import mongoose from 'mongoose'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { toFrontendWard, trimText, validateWardBody } from '../utils/hospitalSetup.js'

async function roomCounts() {
  const rows = await Room.aggregate([{ $group: { _id: '$wardId', count: { $sum: 1 } } }])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]))
}

const router = Router()

router.use(authRequired)

async function loadDepartment(departmentId) {
  if (!departmentId || !mongoose.isValidObjectId(departmentId)) return null
  return Department.findById(departmentId)
}

router.get('/', requirePermission('wards.view'), async (_req, res) => {
  try {
    const wards = await Ward.find().sort({ name: 1 }).populate('departmentId')
    const counts = await roomCounts()
    res.json(wards.map((ward) => toFrontendWard(ward, ward.departmentId, counts[ward._id.toString()] || 0)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load wards' })
  }
})

router.get('/:id', requirePermission('wards.view'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Ward not found' })
    const ward = await Ward.findById(req.params.id).populate('departmentId')
    if (!ward) return res.status(404).json({ error: 'Ward not found' })
    const roomCount = await Room.countDocuments({ wardId: ward._id })
    res.json(toFrontendWard(ward, ward.departmentId, roomCount))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load ward' })
  }
})

router.post('/', requirePermission('wards.create'), async (req, res) => {
  try {
    const errors = validateWardBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const department = await loadDepartment(req.body.departmentId)
    if (!department) return res.status(400).json({ error: 'Selected department was not found.' })
    if (!department.active) return res.status(400).json({ error: 'Wards cannot be added to an inactive department.' })

    const name = trimText(req.body.name)
    const nameKey = name.toLowerCase()
    const exists = await Ward.findOne({ departmentId: department._id, nameKey })
    if (exists) return res.status(400).json({ error: 'A ward with this name already exists in this department.' })

    const ward = await Ward.create({
      name,
      nameKey,
      description: trimText(req.body.description),
      departmentId: department._id,
      active: req.body.active !== false,
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    res.status(201).json(toFrontendWard(ward, department))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A ward with this name already exists in this department.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to create ward' })
  }
})

router.patch('/:id', requireAnyPermission('wards.edit', 'wards.manage'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Ward not found' })
    const ward = await Ward.findById(req.params.id)
    if (!ward) return res.status(404).json({ error: 'Ward not found' })

    const errors = validateWardBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    let department = await loadDepartment(ward.departmentId)
    if (req.body.departmentId !== undefined) {
      department = await loadDepartment(req.body.departmentId)
      if (!department) return res.status(400).json({ error: 'Selected department was not found.' })
      if (!department.active) return res.status(400).json({ error: 'Wards cannot be moved to an inactive department.' })
      ward.departmentId = department._id
    }

    if (req.body.name !== undefined) {
      const name = trimText(req.body.name)
      ward.name = name
      ward.nameKey = name.toLowerCase()
    }
    if (req.body.description !== undefined) ward.description = trimText(req.body.description)
    if (req.body.active !== undefined) ward.active = !!req.body.active

    const dup = await Ward.findOne({
      departmentId: ward.departmentId,
      nameKey: ward.nameKey,
      _id: { $ne: ward._id },
    })
    if (dup) return res.status(400).json({ error: 'A ward with this name already exists in this department.' })

    ward.updatedBy = req.user.name
    await ward.save()
    res.json(toFrontendWard(ward, department))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A ward with this name already exists in this department.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to update ward' })
  }
})

export default router
