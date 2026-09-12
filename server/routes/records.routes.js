import { Router } from 'express'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Patient } from '../models/Patient.js'
import { authRequired } from '../middleware/auth.js'
import { toFrontendRecord } from '../utils/mappers.js'

const router = Router()

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

router.get('/pending', authRequired, async (_req, res) => {
  try {
    const records = await ServiceRecord.find({ status: 'pending' }).sort({ recordedAt: -1, createdAt: -1 })
    const patients = await Patient.find({ patientId: { $in: records.map((r) => r.patientId) } })
    const nameMap = Object.fromEntries(patients.map((p) => [p.patientId, p.name]))
    res.json(records.map((r) => toFrontendRecord(r, nameMap[r.patientId])))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load pending records' })
  }
})

router.get('/', authRequired, async (req, res) => {
  try {
    const filter = {}
    if (req.query.patientId) filter.patientId = req.query.patientId
    if (req.query.status) filter.status = req.query.status
    const records = await ServiceRecord.find(filter).sort({ date: -1, createdAt: -1 })
    const patients = await Patient.find({ patientId: { $in: [...new Set(records.map((r) => r.patientId))] } })
    const nameMap = Object.fromEntries(patients.map((p) => [p.patientId, p.name]))
    res.json(records.map((r) => toFrontendRecord(r, nameMap[r.patientId])))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load records' })
  }
})

router.post('/:id/approve', authRequired, async (req, res) => {
  try {
    const note = req.body.note || 'Approved by reception'
    const record = await ServiceRecord.findById(req.params.id)
    if (!record) return res.status(404).json({ error: 'Record not found' })
    if (record.status !== 'pending') return res.status(400).json({ error: 'Record is not pending' })

    const now = new Date()
    record.status = 'approved'
    record.approvedBy = req.user.name
    record.reviewedAt = now
    record.auditTrail = [...(record.auditTrail || []), audit('approved', req.user.name, note)]
    await record.save()

    const patient = await Patient.findOne({ patientId: record.patientId })
    res.json(toFrontendRecord(record, patient?.name))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to approve record' })
  }
})

router.post('/:id/reject', authRequired, async (req, res) => {
  try {
    const reason = req.body.reason || 'Rejected by reception'
    const record = await ServiceRecord.findById(req.params.id)
    if (!record) return res.status(404).json({ error: 'Record not found' })
    if (record.status !== 'pending') return res.status(400).json({ error: 'Record is not pending' })

    const now = new Date()
    record.status = 'rejected'
    record.approvedBy = req.user.name
    record.reviewedAt = now
    record.rejectionReason = reason
    record.auditTrail = [...(record.auditTrail || []), audit('rejected', req.user.name, reason)]
    await record.save()

    const patient = await Patient.findOne({ patientId: record.patientId })
    res.json(toFrontendRecord(record, patient?.name))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to reject record' })
  }
})

export default router
