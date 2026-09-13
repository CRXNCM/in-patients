import { Router } from 'express'
import { Doctor } from '../models/Doctor.js'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { validateDoctorBody, toFrontendDoctor } from '../utils/doctors.js'

const router = Router()

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

router.get('/', authRequired, requireAnyPermission('doctors.view', 'doctors.assign', 'doctors.manage'), async (req, res) => {
  try {
    const filter = {}
    if (req.query.active === 'true') filter.active = true
    if (req.query.active === 'false') filter.active = false
    const doctors = await Doctor.find(filter).sort({ name: 1 })
    res.json(doctors.map(toFrontendDoctor))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load doctors' })
  }
})

router.get('/:id', authRequired, requireAnyPermission('doctors.view', 'doctors.assign', 'doctors.manage'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' })
    res.json(toFrontendDoctor(doctor))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load doctor' })
  }
})

router.post('/', authRequired, requirePermission('doctors.manage'), async (req, res) => {
  try {
    const errors = validateDoctorBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const doctor = await Doctor.create({
      name: String(req.body.name).trim(),
      specialty: req.body.specialty,
      visitPrice: Number(req.body.visitPrice),
      active: req.body.active !== false,
      phone: String(req.body.phone || '').trim(),
      department: String(req.body.department || '').trim(),
      createdBy: req.user.name,
      updatedBy: req.user.name,
      auditTrail: [audit('created', req.user.name, `Visit price ${Number(req.body.visitPrice)} ETB`)],
    })
    res.status(201).json(toFrontendDoctor(doctor))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create doctor' })
  }
})

router.patch('/:id', authRequired, requireAnyPermission('doctors.manage', 'doctors.manage_pricing'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' })

    const errors = validateDoctorBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const notes = []
    if (req.body.name !== undefined) doctor.name = String(req.body.name).trim()
    if (req.body.specialty !== undefined) doctor.specialty = req.body.specialty
    if (req.body.phone !== undefined) doctor.phone = String(req.body.phone).trim()
    if (req.body.department !== undefined) doctor.department = String(req.body.department).trim()
    if (req.body.visitPrice !== undefined && Number(req.body.visitPrice) !== doctor.visitPrice) {
      notes.push(`Visit price ${doctor.visitPrice} → ${Number(req.body.visitPrice)} ETB`)
      doctor.visitPrice = Number(req.body.visitPrice)
    }
    if (req.body.active !== undefined && req.body.active !== doctor.active) {
      notes.push(req.body.active ? 'Activated' : 'Deactivated')
      doctor.active = !!req.body.active
    }
    doctor.updatedBy = req.user.name
    doctor.auditTrail = [
      ...(doctor.auditTrail || []),
      audit('updated', req.user.name, notes.join('; ') || 'Doctor updated'),
    ]
    await doctor.save()
    res.json(toFrontendDoctor(doctor))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update doctor' })
  }
})

export default router
