import { Router } from 'express'
import mongoose from 'mongoose'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { toFrontendDepartment, trimText, validateDepartmentBody } from '../utils/hospitalSetup.js'

const router = Router()

router.use(authRequired)

async function wardCounts() {
  const rows = await Ward.aggregate([{ $group: { _id: '$departmentId', count: { $sum: 1 } } }])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]))
}

router.get('/', requirePermission('departments.view'), async (_req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 })
    const counts = await wardCounts()
    res.json(departments.map((dept) => toFrontendDepartment(dept, counts[dept._id.toString()] || 0)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load departments' })
  }
})

router.get('/:id', requirePermission('departments.view'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Department not found' })
    const department = await Department.findById(req.params.id)
    if (!department) return res.status(404).json({ error: 'Department not found' })
    const wardCount = await Ward.countDocuments({ departmentId: department._id })
    res.json(toFrontendDepartment(department, wardCount))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load department' })
  }
})

router.post('/', requirePermission('departments.create'), async (req, res) => {
  try {
    const errors = validateDepartmentBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const name = trimText(req.body.name)
    const nameKey = name.toLowerCase()
    const exists = await Department.findOne({ nameKey })
    if (exists) return res.status(400).json({ error: 'A department with this name already exists.' })

    const department = await Department.create({
      name,
      nameKey,
      description: trimText(req.body.description),
      active: req.body.active !== false,
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    res.status(201).json(toFrontendDepartment(department, 0))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A department with this name already exists.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to create department' })
  }
})

router.patch('/:id', requireAnyPermission('departments.edit', 'departments.manage'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Department not found' })
    const department = await Department.findById(req.params.id)
    if (!department) return res.status(404).json({ error: 'Department not found' })

    const errors = validateDepartmentBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    if (req.body.name !== undefined) {
      const name = trimText(req.body.name)
      const nameKey = name.toLowerCase()
      const dup = await Department.findOne({ nameKey, _id: { $ne: department._id } })
      if (dup) return res.status(400).json({ error: 'A department with this name already exists.' })
      department.name = name
      department.nameKey = nameKey
    }
    if (req.body.description !== undefined) department.description = trimText(req.body.description)
    if (req.body.active !== undefined) department.active = !!req.body.active
    department.updatedBy = req.user.name
    await department.save()

    const wardCount = await Ward.countDocuments({ departmentId: department._id })
    res.json(toFrontendDepartment(department, wardCount))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A department with this name already exists.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to update department' })
  }
})

export default router
