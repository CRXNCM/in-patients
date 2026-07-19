import { Router } from 'express'
import { Bed } from '../models/Bed.js'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { authRequired } from '../middleware/auth.js'
import { ensureAutomaticDailyCharges, calcPatientBalance, setDoctorVisitDisabled } from '../services/autoCharges.js'
import { validateAdmitBody, validateDepositBody, validateTransferBody } from '../utils/validation.js'
import {
  toFrontendPatient,
  toFrontendAssignment,
  toFrontendDeposit,
  buildRoomsFromBeds,
  buildRoomHistory,
  toFrontendRecord,
} from '../utils/mappers.js'

const router = Router()

async function nextPatientId() {
  const last = await Patient.findOne().sort({ patientId: -1 })
  const num = last ? parseInt(last.patientId.replace('PAT-', ''), 10) + 1 : 1
  return `PAT-${String(num).padStart(3, '0')}`
}

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

router.get('/', authRequired, async (req, res) => {
  try {
    if (req.query.view === 'full') {
      const [patients, beds, allDeposits, assignments] = await Promise.all([
        Patient.find({ status: { $ne: 'discharged' } }).sort({ admissionDate: -1 }),
        Bed.find().sort({ roomType: 1, label: 1 }),
        Deposit.find().sort({ date: -1 }),
        RoomAssignment.find().sort({ startDate: 1 }),
      ])

      const list = await Promise.all(
        patients.map(async (p) => {
          const balance = await calcPatientBalance(p.patientId)
          const base = toFrontendPatient(p, balance)
          const pAssignments = assignments.filter((a) => a.patientId === p.patientId)
          return { ...base, roomHistory: buildRoomHistory(pAssignments) }
        })
      )

      const depositMap = {}
      allDeposits.forEach((d) => {
        if (!depositMap[d.patientId]) depositMap[d.patientId] = []
        depositMap[d.patientId].push(toFrontendDeposit(d))
      })

      return res.json({
        patients: list,
        deposits: depositMap,
        assignments: assignments.map(toFrontendAssignment),
        rooms: buildRoomsFromBeds(beds),
      })
    }

    const patients = await Patient.find({ status: { $ne: 'discharged' } }).sort({ admissionDate: -1 })
    const list = await Promise.all(
      patients.map(async (p) => {
        const balance = await calcPatientBalance(p.patientId)
        return toFrontendPatient(p, balance)
      })
    )
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load patients' })
  }
})

router.get('/:id/records', authRequired, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const records = await ServiceRecord.find({ patientId: patient.patientId }).sort({ date: -1, createdAt: -1 })
    res.json(records.map((r) => toFrontendRecord(r, patient.name)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load records' })
  }
})

router.post('/:id/records', authRequired, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const { services, source = 'nurse', recordDate, recordName } = req.body
    if (!services?.length) return res.status(400).json({ error: 'Services required' })

    const date = recordDate || new Date().toISOString().slice(0, 10)
    const isReception = source === 'reception'
    const now = new Date()
    const lines = services.map((s, i) => ({
      id: s.id || `svc-${Date.now()}-${i}`,
      category: s.category,
      serviceName: s.serviceName,
      quantity: Number(s.quantity),
      unitPrice: Number(s.unitPrice),
      total: Number(s.total ?? Number(s.quantity) * Number(s.unitPrice)),
      notes: s.notes || '',
    }))

    const record = await ServiceRecord.create({
      patientId: patient.patientId,
      recordName: recordName || patient.name,
      date,
      status: isReception ? 'approved' : 'pending',
      recordType: 'daily',
      source,
      services: lines,
      submittedBy: req.user.name,
      approvedBy: isReception ? req.user.name : null,
      recordedAt: now,
      reviewedAt: isReception ? now : null,
      auditTrail: [
        audit('recorded', req.user.name, `Daily record submitted — ${lines.length} service(s)`),
        ...(isReception ? [audit('approved', req.user.name, 'Auto-approved reception entry')] : []),
      ],
    })

    res.status(201).json(toFrontendRecord(record, patient.name))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit record' })
  }
})

router.post('/:id/returns', authRequired, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const { returnItems, source = 'nurse', recordDate } = req.body
    if (!returnItems?.length) return res.status(400).json({ error: 'Return items required' })

    const date = recordDate || new Date().toISOString().slice(0, 10)
    const isReception = source === 'reception'
    const now = new Date()
    const items = returnItems.map((r, i) => ({
      id: r.id || `ret-${Date.now()}-${i}`,
      serviceName: r.serviceName,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
      total: Number(r.total ?? Number(r.quantity) * Number(r.unitPrice)),
      reason: r.reason || '',
    }))

    const record = await ServiceRecord.create({
      patientId: patient.patientId,
      recordName: patient.name,
      date,
      status: isReception ? 'approved' : 'pending',
      recordType: 'return',
      source,
      returnItems: items,
      services: [],
      submittedBy: req.user.name,
      approvedBy: isReception ? req.user.name : null,
      recordedAt: now,
      reviewedAt: isReception ? now : null,
      auditTrail: [
        audit('recorded', req.user.name, `Pharmacy return submitted — ${items.length} item(s)`),
        ...(isReception ? [audit('approved', req.user.name, 'Auto-approved return')] : []),
      ],
    })

    res.status(201).json(toFrontendRecord(record, patient.name))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit return' })
  }
})

router.post('/:id/transfer-room', authRequired, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    const transferErrors = validateTransferBody(req.body, patient)
    if (transferErrors.length) return res.status(400).json({ error: transferErrors[0] })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const { bedId, transferDate, transferReason } = req.body
    const bedLabel = String(bedId || '').replace(/^BED-/, '')

    const targetBed = await Bed.findOne({ label: bedLabel })
    if (!targetBed || targetBed.status !== 'available') {
      return res.status(400).json({ error: 'Bed not available' })
    }

    if (targetBed.label === patient.bed && targetBed.roomType === patient.room) {
      return res.status(400).json({ error: 'Cannot transfer to the same room and bed.' })
    }

    const currentAssignment = await RoomAssignment.findOne({ patientId: patient.patientId, endDate: null })
    if (!currentAssignment) return res.status(400).json({ error: 'No active room assignment' })

    const oldBed = await Bed.findOne({ label: currentAssignment.bedLabel })
    if (oldBed) {
      oldBed.status = 'available'
      oldBed.patientId = null
      await oldBed.save()
    }

    currentAssignment.endDate = transferDate
    await currentAssignment.save()

    targetBed.status = 'occupied'
    targetBed.patientId = patient.patientId
    await targetBed.save()

    await RoomAssignment.create({
      patientId: patient.patientId,
      bedId: targetBed.label,
      roomType: targetBed.roomType,
      bedLabel: targetBed.label,
      startDate: transferDate,
      dailyRate: targetBed.dailyRate,
      reason: transferReason.trim(),
      assignedBy: req.user.name,
    })

    patient.room = targetBed.roomType
    patient.bed = targetBed.label
    patient.bedId = targetBed._id.toString()
    patient.updatedBy = req.user.name
    await patient.save()

    await ensureAutomaticDailyCharges(patient, new Date().toISOString().slice(0, 10))

    const assignments = await RoomAssignment.find({ patientId: patient.patientId }).sort({ startDate: 1 })
    const beds = await Bed.find()
    res.json({
      roomType: targetBed.roomType,
      bedLabel: targetBed.label,
      dailyRate: targetBed.dailyRate,
      patient: { ...toFrontendPatient(patient, await calcPatientBalance(patient.patientId)), roomHistory: buildRoomHistory(assignments) },
      assignments: assignments.map(toFrontendAssignment),
      rooms: buildRoomsFromBeds(beds),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to transfer room' })
  }
})

router.patch('/:id/doctor-visits/:date', authRequired, async (req, res) => {
  try {
    const { disabled } = req.body
    const patient = await setDoctorVisitDisabled(req.params.id, req.params.date, !!disabled)
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    res.json(toFrontendPatient(patient, await calcPatientBalance(patient.patientId)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update doctor visit' })
  }
})

router.get('/:id', authRequired, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const [deposits, assignments, records, balance] = await Promise.all([
      Deposit.find({ patientId: patient.patientId }).sort({ date: -1 }),
      RoomAssignment.find({ patientId: patient.patientId }).sort({ startDate: 1 }),
      ServiceRecord.find({ patientId: patient.patientId }).sort({ date: -1 }),
      calcPatientBalance(patient.patientId),
    ])

    res.json({
      patient: {
        ...toFrontendPatient(patient, balance),
        roomHistory: buildRoomHistory(assignments),
      },
      deposits: deposits.map(toFrontendDeposit),
      assignments: assignments.map(toFrontendAssignment),
      records: records.map((r) => toFrontendRecord(r, patient.name)),
      balance,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load patient' })
  }
})

router.post('/', authRequired, async (req, res) => {
  try {
    const body = req.body
    const admitErrors = validateAdmitBody(body)
    if (admitErrors.length) return res.status(400).json({ error: admitErrors[0] })

    const mrn = String(body.mrn || '').trim()
    const nationalId = String(body.nationalId || '').trim()
    if (mrn) {
      const dup = await Patient.findOne({ mrn, status: { $ne: 'discharged' } })
      if (dup) return res.status(400).json({ error: 'A patient with this MRN already has an active admission.' })
    }
    if (nationalId) {
      const dup = await Patient.findOne({ nationalId, status: { $ne: 'discharged' } })
      if (dup) return res.status(400).json({ error: 'A patient with this National ID already has an active admission.' })
    }

    const label = String(body.bedId).replace(/^BED-/, '')
    const bedDoc = await Bed.findOne({ label })
    if (!bedDoc || bedDoc.status !== 'available') {
      return res.status(400).json({ error: 'Selected bed is not available.' })
    }

    const patientId = await nextPatientId()
    const deposit = Number(body.depositAmount)

    const patient = await Patient.create({
      patientId,
      name: String(body.name).trim(),
      age: Number(body.age),
      dateOfBirth: body.dateOfBirth || null,
      gender: body.gender,
      phone: body.phone?.trim() || '',
      address: String(body.address).trim(),
      emergencyContact: String(body.emergencyContact).trim(),
      emergencyPhone: body.emergencyPhone?.trim() || '',
      mrn: mrn || undefined,
      nationalId: nationalId || undefined,
      admissionReason: String(body.admissionReason).trim(),
      admissionDate: body.admissionDate,
      room: bedDoc.roomType,
      bed: bedDoc.label,
      bedId: bedDoc._id.toString(),
      depositTotal: deposit,
      status: 'admitted',
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })

    bedDoc.status = 'occupied'
    bedDoc.patientId = patientId
    await bedDoc.save()

    await RoomAssignment.create({
      patientId,
      bedId: bedDoc.label,
      roomType: bedDoc.roomType,
      bedLabel: bedDoc.label,
      startDate: admissionDate,
      dailyRate: bedDoc.dailyRate,
      reason: 'Initial admission',
      assignedBy: req.user.name,
    })

    if (deposit > 0) {
      await Deposit.create({
        patientId,
        amount: deposit,
        method: body.depositMethod || 'Cash',
        referenceNumber: body.referenceNumber?.trim() || undefined,
        date: body.admissionDate,
        receivedBy: req.user.name,
        isInitial: true,
      })
    }

    await ensureAutomaticDailyCharges(patient, admissionDate)
    const balance = await calcPatientBalance(patientId)
    const assignments = await RoomAssignment.find({ patientId }).sort({ startDate: 1 })
    const beds = await Bed.find()

    res.status(201).json({
      patient: { ...toFrontendPatient(patient, balance), roomHistory: buildRoomHistory(assignments) },
      rooms: buildRoomsFromBeds(beds),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to admit patient' })
  }
})

router.post('/:id/deposits', authRequired, async (req, res) => {
  try {
    const { amount, method, date, referenceNumber } = req.body
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const existingRefs = await Deposit.find({ referenceNumber: { $exists: true, $ne: '' } }).distinct('referenceNumber')
    const depositErrors = validateDepositBody({ amount, method, referenceNumber }, existingRefs)
    if (depositErrors.length) return res.status(400).json({ error: depositErrors[0] })

    const deposit = await Deposit.create({
      patientId: patient.patientId,
      amount: Number(amount),
      method: method || 'Cash',
      referenceNumber: referenceNumber?.trim() || undefined,
      date: date || new Date().toISOString().slice(0, 10),
      receivedBy: req.user.name,
    })

    patient.depositTotal += Number(amount)
    patient.updatedBy = req.user.name
    await patient.save()

    res.status(201).json(toFrontendDeposit(deposit))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add deposit' })
  }
})

export default router
