import { Router } from 'express'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { WardSubmission } from '../models/WardSubmission.js'
import { Bed } from '../models/Bed.js'
import { Ward } from '../models/Ward.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { authRequired, requirePermission } from '../middleware/auth.js'
import {
  assembleRequests,
  buildConsolidatedReceipt,
  collectRequests,
  escapeRegex,
} from '../services/serviceHistory.js'

const router = Router()

function publicPatient(patient) {
  return {
    patientId: patient.patientId,
    name: patient.name,
    phone: patient.phone || '',
    gender: patient.gender || '',
    age: patient.age ?? null,
    status: patient.status,
    admissionId: String(patient._id),
    admissionDate: patient.admissionDate || '',
  }
}

async function locationOf(patient) {
  const bed = patient.bed ? await Bed.findOne({ label: patient.bed }).lean() : null
  let ward = ''
  if (bed?.wardId) {
    const wardDoc = await Ward.findById(bed.wardId).lean()
    ward = wardDoc?.name || ''
  }
  return {
    id: String(patient._id),
    admissionNumber: patient.patientId,
    admissionDate: patient.admissionDate || '',
    status: patient.status,
    ward,
    room: patient.room || '',
    bed: patient.bed || '',
    dischargeDate: patient.dischargeCompletedAt ? new Date(patient.dischargeCompletedAt).toISOString() : '',
  }
}

async function loadPatient(patientId) {
  return Patient.findOne({ patientId: String(patientId || '').trim() })
}

function sameAdmission(patient, admissionId) {
  return patient && String(patient._id) === String(admissionId || '')
}

function pageNumber(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 ? number : fallback
}

router.get('/patients', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length === 1) return res.status(400).json({ error: 'Enter at least 2 characters to search.' })
    const pageSize = Math.min(pageNumber(req.query.pageSize, 10), 100)
    const page = pageNumber(req.query.page, 1)
    const filter = {}
    if (q.length >= 2) {
      const pattern = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ name: pattern }, { patientId: pattern }, { phone: pattern }]
    }
    const total = await Patient.countDocuments(filter)
    const patients = await Patient.find(filter)
      .sort({ admissionDate: -1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
    res.json({
      patients: patients.map(publicPatient),
      count: total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize) || 1),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Patient search failed.' })
  }
})

router.get('/patients/:patientId', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const patient = await loadPatient(req.params.patientId)
    if (!patient) return res.status(404).json({ error: 'Patient not found.' })
    const admission = await locationOf(patient)
    res.json({ patient: publicPatient(patient), admissions: [admission] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load admissions.' })
  }
})

router.get('/patients/:patientId/admissions/:admissionId/requests', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const patient = await loadPatient(req.params.patientId)
    if (!patient || !sameAdmission(patient, req.params.admissionId)) {
      return res.status(404).json({ error: 'Admission not found.' })
    }
    const [submissions, records, pharmacyOrders, laboratoryOrders] = await Promise.all([
      WardSubmission.find({ patientId: patient.patientId }).sort({ createdAt: -1 }).lean(),
      ServiceRecord.find({ patientId: patient.patientId }).lean(),
      PharmacyOrder.find({ patientId: patient.patientId }).lean(),
      LaboratoryOrder.find({ patientId: patient.patientId }).lean(),
    ])
    const requests = collectRequests({
      submissions,
      records: records.map((row) => ({ ...row, id: String(row._id) })),
      pharmacyOrders,
      laboratoryOrders,
    })
    res.json({ requests })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load service history.' })
  }
})

router.get('/patients/:patientId/admissions/:admissionId/receipt', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const patient = await loadPatient(req.params.patientId)
    if (!patient || !sameAdmission(patient, req.params.admissionId)) {
      return res.status(404).json({ error: 'Admission not found.' })
    }
    const [submissions, records, pharmacyOrders, laboratoryOrders, settings] = await Promise.all([
      WardSubmission.find({ patientId: patient.patientId }).lean(),
      ServiceRecord.find({ patientId: patient.patientId }).lean(),
      PharmacyOrder.find({ patientId: patient.patientId }).lean(),
      LaboratoryOrder.find({ patientId: patient.patientId }).lean(),
      HospitalSettings.findOne().lean(),
    ])
    const requests = assembleRequests({
      submissions,
      records: records.map((row) => ({ ...row, id: String(row._id) })),
      pharmacyOrders,
      laboratoryOrders,
    })
    res.json(buildConsolidatedReceipt({
      hospitalName: settings?.name || 'Central City Hospital',
      patient,
      admission: await locationOf(patient),
      requests,
      generatedAt: new Date(),
    }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load the service request receipt.' })
  }
})

export default router
