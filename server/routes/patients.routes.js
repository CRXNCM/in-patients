import { Router } from 'express'
import { Bed } from '../models/Bed.js'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { authRequired, requirePermission, requireAnyPermission, requireRole } from '../middleware/auth.js'
import { roleHasPermission } from '../utils/permissions.js'
import { ensureAutomaticDailyCharges, calcPatientBalance, setDoctorVisitDisabled } from '../services/autoCharges.js'
import { requestDischarge, approveDischarge, rejectDischarge } from '../services/discharge.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import { listAssignments, assignDoctor, assignDoctorsOnAdmit, endAssignment } from '../services/doctorAssignments.js'
import { claimAvailableBed, releaseBed } from '../services/beds.js'
import { applyCreditFlags, normalizeAdmissionPaymentMode } from '../utils/credit.js'
import { MaternityBaby } from '../models/MaternityBaby.js'
import {
  normalizeAdmissionType,
  toFrontendBaby,
  validateBabyBody,
  resolveRecordSubject,
  babyFieldsFromBody,
} from '../utils/maternity.js'
import { toFrontendAssignment as toDoctorAssignment } from '../utils/doctors.js'
import { todayStr } from '../utils/dates.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { loadResolvedSettings } from '../utils/settings.js'
import {
  validateAdmitBody,
  validateDepositBody,
  validateTransferBody,
  computeAgeFromDob,
  resolveAdmissionDate,
  inpatientActionError,
} from '../utils/validation.js'
import {
  toFrontendPatient,
  toFrontendAssignment,
  toFrontendDeposit,
  buildRoomsFromBeds,
  buildRoomHistory,
  toFrontendRecord,
} from '../utils/mappers.js'

const router = Router()

function requireAdmit(req, res, next) {
  if (!roleHasPermission(req.auth?.role, 'admissions.create')) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const mode = String(req.body?.admissionPaymentMode || '').toLowerCase()
  if (mode === 'credit' && !roleHasPermission(req.auth.role, 'credit.create_admission')) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

async function nextPatientId() {
  const last = await Patient.findOne().sort({ patientId: -1 })
  const num = last ? parseInt(last.patientId.replace('PAT-', ''), 10) + 1 : 1
  return `PAT-${String(num).padStart(3, '0')}`
}

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

async function assignmentsByPatientIds(patientIds) {
  const rows = await DoctorAssignment.find({ patientId: { $in: patientIds } }).sort({ effectiveFrom: 1, assignedAt: 1 })
  const map = {}
  for (const row of rows) {
    if (!map[row.patientId]) map[row.patientId] = []
    map[row.patientId].push(toDoctorAssignment(row))
  }
  return map
}

function mapPatient(doc, balance, assignedDoctors = [], baby = null) {
  return toFrontendPatient({ ...doc.toObject(), assignedDoctors, baby }, balance)
}

async function mapPatientWithBaby(doc, balance, assignedDoctors = []) {
  const baby = await MaternityBaby.findOne({ motherPatientId: doc.patientId })
  return mapPatient(doc, balance, assignedDoctors, toFrontendBaby(baby))
}

async function babiesByMotherIds(patientIds) {
  const ids = patientIds.filter(Boolean)
  if (!ids.length) return {}
  const rows = await MaternityBaby.find({ motherPatientId: { $in: ids } })
  const map = {}
  for (const row of rows) map[row.motherPatientId] = toFrontendBaby(row)
  return map
}

router.get('/', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    if (req.query.view === 'full') {
      const [patients, beds, allDeposits, assignments] = await Promise.all([
        Patient.find({ status: { $ne: 'discharged' } }).sort({ admissionDate: -1 }),
        Bed.find().sort({ roomType: 1, label: 1 }),
        Deposit.find().sort({ date: -1 }),
        RoomAssignment.find().sort({ startDate: 1 }),
      ])

      const doctorMap = await assignmentsByPatientIds(patients.map((p) => p.patientId))
      const babyMap = await babiesByMotherIds(patients.map((p) => p.patientId))
      const list = await Promise.all(
        patients.map(async (p) => {
          const balance = await calcPatientBalance(p.patientId)
          const base = mapPatient(p, balance, doctorMap[p.patientId] || [], babyMap[p.patientId] || null)
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
    const doctorMap = await assignmentsByPatientIds(patients.map((p) => p.patientId))
    const babyMap = await babiesByMotherIds(patients.map((p) => p.patientId))
    const list = await Promise.all(
      patients.map(async (p) => {
        const balance = await calcPatientBalance(p.patientId)
        return mapPatient(p, balance, doctorMap[p.patientId] || [], babyMap[p.patientId] || null)
      })
    )
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load patients' })
  }
})

router.get('/pending-discharge', authRequired, requireAnyPermission('admissions.discharge', 'admissions.view'), async (_req, res) => {
  try {
    const patients = await Patient.find({ status: 'pending-discharge' }).sort({ dischargeRequestedAt: -1, admissionDate: -1 })
    const doctorMap = await assignmentsByPatientIds(patients.map((p) => p.patientId))
    const babyMap = await babiesByMotherIds(patients.map((p) => p.patientId))
    const list = await Promise.all(
      patients.map(async (p) => {
        const balance = await calcPatientBalance(p.patientId)
        return mapPatient(p, balance, doctorMap[p.patientId] || [], babyMap[p.patientId] || null)
      })
    )
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load pending discharges' })
  }
})

router.get('/discharged', authRequired, requirePermission('patients.view'), async (_req, res) => {
  try {
    const patients = await Patient.find({ status: 'discharged' }).sort({ dischargeCompletedAt: -1, updatedAt: -1 })
    const doctorMap = await assignmentsByPatientIds(patients.map((p) => p.patientId))
    const babyMap = await babiesByMotherIds(patients.map((p) => p.patientId))
    const list = await Promise.all(
      patients.map(async (p) => {
        const balance = await calcPatientBalance(p.patientId)
        return mapPatient(p, balance, doctorMap[p.patientId] || [], babyMap[p.patientId] || null)
      })
    )
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load discharged patients' })
  }
})

router.get('/:id/baby', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const baby = await MaternityBaby.findOne({ motherPatientId: patient.patientId })
    res.json({ baby: toFrontendBaby(baby) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load newborn' })
  }
})

router.put('/:id/baby', authRequired, requireAnyPermission('patients.edit', 'admissions.create'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    if (patient.admissionType !== 'maternity') {
      return res.status(400).json({ error: 'Newborn details can only be added to a maternity admission.' })
    }

    const babyErrors = validateBabyBody(req.body)
    if (babyErrors.length) return res.status(400).json({ error: babyErrors[0] })

    const fields = babyFieldsFromBody(req.body)
    const baby = await MaternityBaby.findOneAndUpdate(
      { motherPatientId: patient.patientId },
      {
        $set: { ...fields, updatedBy: req.user.name },
        $setOnInsert: { motherPatientId: patient.patientId, createdBy: req.user.name },
      },
      { upsert: true, new: true }
    )

    const assignedDoctors = await listAssignments(patient.patientId)
    res.json({
      baby: toFrontendBaby(baby),
      patient: mapPatient(patient, await calcPatientBalance(patient.patientId), assignedDoctors, toFrontendBaby(baby)),
    })
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await MaternityBaby.findOne({ motherPatientId: req.params.id })
      return res.json({ baby: toFrontendBaby(existing) })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to save newborn' })
  }
})

router.get('/:id/records', authRequired, requirePermission('patients.view'), async (req, res) => {
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

router.post('/:id/records', authRequired, requireAnyPermission('patients.edit', 'doctors.assign'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const recordBlock = inpatientActionError(patient, 'records')
    if (recordBlock) return res.status(400).json({ error: recordBlock })

    const { services, source = 'nurse', recordDate, recordName } = req.body
    if (!services?.length) return res.status(400).json({ error: 'Services required' })

    const baby = await MaternityBaby.findOne({ motherPatientId: patient.patientId })
    const subject = resolveRecordSubject(patient, req.body, baby)
    if (subject.error) return res.status(400).json({ error: subject.error })

    const date = recordDate || todayStr()
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
      subjectType: subject.subjectType,
      babyId: subject.babyId,
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

router.post('/:id/returns', authRequired, requireAnyPermission('patients.edit', 'doctors.assign'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const returnBlock = inpatientActionError(patient, 'returns')
    if (returnBlock) return res.status(400).json({ error: returnBlock })

    const { returnItems, source = 'nurse', recordDate } = req.body
    if (!returnItems?.length) return res.status(400).json({ error: 'Return items required' })

    const baby = await MaternityBaby.findOne({ motherPatientId: patient.patientId })
    const subject = resolveRecordSubject(patient, req.body, baby)
    if (subject.error) return res.status(400).json({ error: subject.error })

    const date = recordDate || todayStr()
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
      subjectType: subject.subjectType,
      babyId: subject.babyId,
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

router.post('/:id/transfer-room', authRequired, requirePermission('rooms.assign_beds'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    const transferErrors = validateTransferBody(req.body, patient)
    if (transferErrors.length) return res.status(400).json({ error: transferErrors[0] })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const { bedId, transferDate, transferReason } = req.body
    const bedLabel = String(bedId || '').replace(/^BED-/, '')

    const preview = await Bed.findOne({ label: bedLabel })
    if (preview && preview.label === patient.bed && preview.roomType === patient.room) {
      return res.status(400).json({ error: 'Cannot transfer to the same room and bed.' })
    }

    const currentAssignment = await RoomAssignment.findOne({ patientId: patient.patientId, endDate: null })
    if (!currentAssignment) return res.status(400).json({ error: 'No active room assignment' })

    let targetBed
    try {
      targetBed = await claimAvailableBed({ label: bedLabel, patientId: patient.patientId })
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message || 'Bed not available' })
    }

    const oldBed = await Bed.findOne({ label: currentAssignment.bedLabel })
    await releaseBed(oldBed, patient.patientId)

    currentAssignment.endDate = transferDate
    await currentAssignment.save()

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

    await ensureAutomaticDailyCharges(patient)

    const assignments = await RoomAssignment.find({ patientId: patient.patientId }).sort({ startDate: 1 })
    const beds = await Bed.find()
    res.json({
      roomType: targetBed.roomType,
      bedLabel: targetBed.label,
      dailyRate: targetBed.dailyRate,
      patient: { ...await mapPatientWithBaby(patient, await calcPatientBalance(patient.patientId), await listAssignments(patient.patientId)), roomHistory: buildRoomHistory(assignments) },
      assignments: assignments.map(toFrontendAssignment),
      rooms: buildRoomsFromBeds(beds),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to transfer room' })
  }
})

router.patch('/:id/doctor-visits/:date', authRequired, requirePermission('doctors.assign'), async (req, res) => {
  try {
    const existing = await Patient.findOne({ patientId: req.params.id })
    const visitBlock = inpatientActionError(existing, 'doctor-visit')
    if (!existing) return res.status(404).json({ error: 'Patient not found' })
    if (visitBlock) return res.status(400).json({ error: visitBlock })

    const { disabled } = req.body
    const patient = await setDoctorVisitDisabled(req.params.id, req.params.date, !!disabled)
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const assignedDoctors = await listAssignments(patient.patientId)
    res.json(await mapPatientWithBaby(patient, await calcPatientBalance(patient.patientId), assignedDoctors))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update doctor visit' })
  }
})

router.get('/:id', authRequired, requirePermission('patients.view'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    if (patient.status !== 'discharged') {
      await ensureAutomaticDailyCharges(patient)
    }

    const [deposits, assignments, records, balance, assignedDoctors, baby] = await Promise.all([
      Deposit.find({ patientId: patient.patientId }).sort({ date: -1 }),
      RoomAssignment.find({ patientId: patient.patientId }).sort({ startDate: 1 }),
      ServiceRecord.find({ patientId: patient.patientId }).sort({ date: -1 }),
      calcPatientBalance(patient.patientId),
      listAssignments(patient.patientId),
      MaternityBaby.findOne({ motherPatientId: patient.patientId }),
    ])

    res.json({
      patient: {
        ...mapPatient(patient, balance, assignedDoctors, toFrontendBaby(baby)),
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

router.post('/', authRequired, requireAdmit, async (req, res) => {
  let bedDoc = null
  try {
    const body = req.body
    const rules = await loadResolvedSettings(HospitalSettings)
    const admitErrors = validateAdmitBody(body, rules)
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
    try {
      bedDoc = await claimAvailableBed({ label, patientId: 'pending' })
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message })
    }

    const patientId = await nextPatientId()
    const deposit = Number(body.depositAmount)
    const admissionDate = resolveAdmissionDate(body.admissionDate)
    const paymentMode = normalizeAdmissionPaymentMode(body.admissionPaymentMode)
    const requiredInitialDeposit = rules.minimumInitialDeposit
    const ageValue =
      body.age !== undefined && body.age !== null && body.age !== ''
        ? Number(body.age)
        : computeAgeFromDob(body.dateOfBirth)

    const admissionType = normalizeAdmissionType(body.admissionType) || 'normal'

    const patient = await Patient.create({
      patientId,
      name: String(body.name).trim(),
      age: ageValue,
      dateOfBirth: body.dateOfBirth || null,
      gender: body.gender,
      admissionType,
      phone: body.phone?.trim() || '',
      address: String(body.address).trim(),
      emergencyContact: body.emergencyContact?.trim() || '',
      emergencyPhone: body.emergencyPhone?.trim() || '',
      mrn: mrn || undefined,
      nationalId: nationalId || undefined,
      admissionReason: body.admissionReason?.trim() || '',
      admissionDate,
      room: bedDoc.roomType,
      bed: bedDoc.label,
      bedId: bedDoc._id.toString(),
      depositTotal: deposit > 0 ? deposit : 0,
      requiredInitialDeposit,
      admissionPaymentMode: paymentMode,
      isCreditPatient: paymentMode === 'credit' && deposit < requiredInitialDeposit,
      creditMarkedBy: paymentMode === 'credit' ? req.user.name : undefined,
      creditMarkedAt: paymentMode === 'credit' ? new Date() : undefined,
      status: 'admitted',
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })

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
        date: admissionDate,
        receivedBy: req.user.name,
        isInitial: true,
      })
    }

    let assignedDoctors = []
    try {
      assignedDoctors = await assignDoctorsOnAdmit(patient, body.doctorIds || [], req.user.name)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      throw err
    }
    await ensureAutomaticDailyCharges(patient, null, { range: true })
    const balance = await calcPatientBalance(patientId)
    const assignments = await RoomAssignment.find({ patientId }).sort({ startDate: 1 })
    const beds = await Bed.find()

    res.status(201).json({
      patient: { ...mapPatient(patient, balance, assignedDoctors), roomHistory: buildRoomHistory(assignments) },
      rooms: buildRoomsFromBeds(beds),
    })
  } catch (err) {
    if (bedDoc) {
      await releaseBed(bedDoc, bedDoc.patientId || 'pending').catch(() => {})
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to admit patient' })
  }
})

router.get('/:id/doctors', authRequired, requireAnyPermission('doctors.view', 'doctors.assign'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    res.json(await listAssignments(patient.patientId))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load assigned doctors' })
  }
})

router.post('/:id/doctors', authRequired, requirePermission('doctors.assign'), async (req, res) => {
  try {
    const assignment = await assignDoctor(req.params.id, req.body, req.user.name)
    const patient = await Patient.findOne({ patientId: req.params.id })
    const assignedDoctors = await listAssignments(req.params.id)
    res.status(201).json({
      assignment,
      assignedDoctors,
      patient: await mapPatientWithBaby(patient, await calcPatientBalance(req.params.id), assignedDoctors),
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Failed to assign doctor' })
  }
})

router.patch('/:id/doctors/:assignmentId/end', authRequired, requirePermission('doctors.assign'), async (req, res) => {
  try {
    const assignment = await endAssignment(req.params.id, req.params.assignmentId, req.user.name)
    const assignedDoctors = await listAssignments(req.params.id)
    const patient = await Patient.findOne({ patientId: req.params.id })
    res.json({
      assignment,
      assignedDoctors,
      patient: await mapPatientWithBaby(patient, await calcPatientBalance(req.params.id), assignedDoctors),
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Failed to end doctor assignment' })
  }
})

router.post('/:id/deposits', authRequired, requireAnyPermission('payments.create', 'credit.record_payment'), async (req, res) => {
  try {
    const { amount, method, date, referenceNumber } = req.body
    const patient = await Patient.findOne({ patientId: req.params.id })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const depositBlock = inpatientActionError(patient, 'deposits')
    if (depositBlock) return res.status(400).json({ error: depositBlock })

    const [existingRefs, rules] = await Promise.all([
      Deposit.find({ referenceNumber: { $exists: true, $ne: '' } }).distinct('referenceNumber'),
      loadResolvedSettings(HospitalSettings),
    ])
    const depositErrors = validateDepositBody({ amount, method, referenceNumber }, existingRefs, rules)
    if (depositErrors.length) return res.status(400).json({ error: depositErrors[0] })

    const deposit = await Deposit.create({
      patientId: patient.patientId,
      amount: Number(amount),
      method: method || 'Cash',
      referenceNumber: referenceNumber?.trim() || undefined,
      date: date || todayStr(),
      receivedBy: req.user.name,
    })

    patient.depositTotal += Number(amount)
    applyCreditFlags(patient, patient.depositTotal)
    patient.updatedBy = req.user.name
    await patient.save()

    const assignedDoctors = await listAssignments(patient.patientId)
    res.status(201).json({
      deposit: toFrontendDeposit(deposit),
      patient: await mapPatientWithBaby(patient, await calcPatientBalance(patient.patientId), assignedDoctors),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add deposit' })
  }
})

function sendDischargeError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message })
  console.error(err)
  return res.status(500).json({ error: fallback })
}

router.post('/:id/discharge-request', authRequired, requireRole('Nurse'), async (req, res) => {
  try {
    const patient = await requestDischarge(req.params.id, {
      notes: req.body?.notes,
      userName: req.user.name,
    })
    const balance = await calcPatientBalance(patient.patientId)
    res.json(await mapPatientWithBaby(patient, balance, await listAssignments(patient.patientId)))
  } catch (err) {
    sendDischargeError(res, err, 'Failed to request discharge')
  }
})

router.post('/:id/discharge/approve', authRequired, requirePermission('admissions.discharge'), async (req, res) => {
  try {
    const { patient, balance } = await approveDischarge(req.params.id, { userName: req.user.name })
    const assignments = await RoomAssignment.find({ patientId: patient.patientId }).sort({ startDate: 1 })
    const beds = await Bed.find()
    res.json({
      patient: { ...await mapPatientWithBaby(patient, balance, await listAssignments(patient.patientId)), roomHistory: buildRoomHistory(assignments) },
      assignments: assignments.map(toFrontendAssignment),
      rooms: buildRoomsFromBeds(beds),
      balance,
    })
  } catch (err) {
    sendDischargeError(res, err, 'Failed to complete discharge')
  }
})

router.post('/:id/discharge/reject', authRequired, requirePermission('admissions.discharge'), async (req, res) => {
  try {
    const patient = await rejectDischarge(req.params.id, {
      reason: req.body?.reason,
      userName: req.user.name,
    })
    const balance = await calcPatientBalance(patient.patientId)
    res.json(await mapPatientWithBaby(patient, balance, await listAssignments(patient.patientId)))
  } catch (err) {
    sendDischargeError(res, err, 'Failed to reject discharge')
  }
})

export default router
