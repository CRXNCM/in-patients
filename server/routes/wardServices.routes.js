import { Router } from 'express'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { MaternityBaby } from '../models/MaternityBaby.js'
import { Bed } from '../models/Bed.js'
import { Ward } from '../models/Ward.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { WardSubmission } from '../models/WardSubmission.js'
import { authRequired } from '../middleware/auth.js'
import { inpatientActionError } from '../utils/validation.js'
import { resolveCatalogServiceLines } from '../utils/catalog.js'
import { catalogPricingForPatient, isEmergencyOpdAdmission } from '../utils/admissions.js'
import { emergencyServicesAutoApprove } from '../utils/stayScope.js'
import { resolveRecordSubject } from '../utils/maternity.js'
import { todayStr } from '../utils/dates.js'
import { toFrontendRecord } from '../utils/mappers.js'
import {
  buildPharmacyOrder,
  partitionServiceLines,
  serviceLineSignature,
} from '../../frontend/src/services/pharmacyFulfillment.js'
import { buildLaboratoryOrder } from '../../frontend/src/services/laboratoryOrders.js'
import { plainPharmacyOrder } from './pharmacy.routes.js'
import { plainLaboratoryOrder } from './laboratory.routes.js'

const router = Router()

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

async function staySnapshot(patient) {
  const bed = patient.bed ? await Bed.findOne({ label: patient.bed }).lean() : null
  let ward = ''
  if (bed?.wardId) {
    const wardDoc = await Ward.findById(bed.wardId).lean()
    ward = wardDoc?.name || ''
  }
  return {
    patientId: patient.patientId,
    patientName: patient.name,
    admissionId: String(patient._id),
    admissionNumber: patient.patientId,
    ward,
    room: patient.room || '',
    bed: patient.bed || '',
    admissionType: patient.admissionType || 'normal',
    convertedFromEmergency: Boolean(patient.convertedFromEmergency),
  }
}

router.post('/patients/:id/ward-services', authRequired, async (req, res) => {
  const submissionId = String(req.body?.submissionId || '').trim()
  try {
    if (req.user.role !== 'Nurse') return res.status(403).json({ error: 'Forbidden' })
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(submissionId)) {
      return res.status(400).json({ error: 'A submission id is required.' })
    }

    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const recordBlock = inpatientActionError(patient, 'records')
    if (recordBlock) return res.status(400).json({ error: recordBlock })

    const { services, recordDate, recordName } = req.body || {}
    if (!services?.length) return res.status(400).json({ error: 'Services required' })
    const signature = serviceLineSignature(services)

    const existing = await WardSubmission.findOne({ submissionId })
    if (existing?.response) {
      if (existing.signature === signature) return res.status(200).json(existing.response)
      return res.status(409).json({
        error: 'This submission was already recorded with different items. Submit the new items as a new record.',
      })
    }
    if (existing) {
      return res.status(409).json({
        error: 'This submission is already being saved. Refresh and check the queues before trying again.',
      })
    }

    await WardSubmission.create({
      submissionId,
      patientId: patient.patientId,
      signature,
      status: 'processing',
    })

    let createdRecordId = null
    try {
      const baby = await MaternityBaby.findOne({ motherPatientId: patient.patientId })
      const subject = resolveRecordSubject(patient, req.body, baby)
      if (subject.error) {
        await WardSubmission.deleteOne({ submissionId })
        return res.status(400).json({ error: subject.error })
      }

      const resolved = await resolveCatalogServiceLines(services, catalogPricingForPatient(patient))
      if (resolved.error) {
        await WardSubmission.deleteOne({ submissionId })
        return res.status(400).json({ error: resolved.error })
      }

      const parts = partitionServiceLines(resolved.lines)
      await WardSubmission.updateOne(
        { submissionId },
        {
          $set: {
            admissionId: String(patient._id),
            submittedById: String(req.user.id || ''),
            submittedByName: req.user.name || '',
            staffAccount: req.auth?.user?.username || '',
            submittedAt: new Date(),
            originalItems: resolved.lines.map((line) => ({
              category: line.category || '',
              name: line.serviceName || '',
              quantity: line.quantity,
              unit: line.unit || '',
              instructions: String(line.notes || '').slice(0, 400),
            })),
          },
        }
      )
      const stay = await staySnapshot(patient)
      const actor = { id: req.user.id, name: req.user.name }
      const now = new Date()
      const at = now.toISOString()

      let pharmacyOrder = null
      if (parts.pharmacy.length) {
        const built = buildPharmacyOrder({
          submissionId,
          stay,
          actor,
          lines: parts.pharmacy,
          at,
        })
        if (built.error) {
          await WardSubmission.deleteOne({ submissionId })
          return res.status(400).json({ error: built.error })
        }
        const { id: _ignored, ...payload } = built.order
        const saved = await PharmacyOrder.create(payload)
        pharmacyOrder = plainPharmacyOrder(saved)
      }

      let laboratoryOrder = null
      if (parts.laboratory.length) {
        const built = buildLaboratoryOrder({
          submissionId,
          stay,
          actor,
          lines: parts.laboratory,
          at,
        })
        if (built.error) {
          await PharmacyOrder.deleteOne({ submissionId })
          await WardSubmission.deleteOne({ submissionId })
          return res.status(400).json({ error: built.error })
        }
        const { id: _ignoredLab, ...payload } = built.order
        const saved = await LaboratoryOrder.create(payload)
        laboratoryOrder = plainLaboratoryOrder(saved)
      }

      let record = null
      if (parts.other.length) {
        const routed = parts.pharmacy.length || parts.laboratory.length
        const autoApprove = emergencyServicesAutoApprove(patient, parts.other)
        const saved = await ServiceRecord.create({
          patientId: patient.patientId,
          subjectType: subject.subjectType,
          babyId: subject.babyId,
          recordName: recordName || patient.name,
          date: recordDate || todayStr(),
          status: autoApprove ? 'approved' : 'pending',
          recordType: 'daily',
          source: 'nurse',
          submissionId,
          services: parts.other,
          submittedBy: req.user.name,
          approvedBy: autoApprove ? req.user.name : null,
          recordedAt: now,
          reviewedAt: autoApprove ? now : null,
          auditTrail: [
            audit(
              'recorded',
              req.user.name,
              routed
                ? `Daily record submitted — ${parts.other.length} service(s). Pharmacy and laboratory items were routed to their queues and return to ${isEmergencyOpdAdmission(patient) ? 'the Emergency Nurse' : 'reception'} after the department releases them.`
                : `Daily record submitted — ${parts.other.length} service(s)`
            ),
            ...(autoApprove
              ? [audit('approved', req.user.name, 'Auto-approved Emergency OPD service. Reception reviews this stay only after inpatient conversion.')]
              : []),
          ],
        })
        createdRecordId = saved._id
        record = toFrontendRecord(saved, patient.name)
        if (pharmacyOrder) {
          await PharmacyOrder.updateOne({ _id: pharmacyOrder.id }, { sourceRecordId: record.id })
          pharmacyOrder.sourceRecordId = record.id
        }
        if (laboratoryOrder) {
          await LaboratoryOrder.updateOne({ _id: laboratoryOrder.id }, { sourceRecordId: record.id })
          laboratoryOrder.sourceRecordId = record.id
        }
      }

      const response = {
        record,
        pharmacyOrder,
        laboratoryOrder,
        counts: {
          pharmacy: parts.pharmacy.length,
          laboratory: parts.laboratory.length,
          reception: parts.other.length,
        },
      }
      await WardSubmission.updateOne({ submissionId }, { $set: { status: 'saved', response } })
      res.status(201).json(response)
    } catch (err) {
      if (createdRecordId) await ServiceRecord.deleteOne({ _id: createdRecordId })
      await PharmacyOrder.deleteOne({ submissionId })
      await LaboratoryOrder.deleteOne({ submissionId })
      await WardSubmission.deleteOne({ submissionId })
      throw err
    }
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await WardSubmission.findOne({ submissionId })
      if (existing?.response) return res.status(200).json(existing.response)
      return res.status(409).json({ error: 'This submission is already being saved.' })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to route the service record' })
  }
})

export default router
