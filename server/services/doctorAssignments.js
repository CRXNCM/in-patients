import mongoose from 'mongoose'
import { Doctor } from '../models/Doctor.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import { Patient } from '../models/Patient.js'
import { ensureAutomaticDailyCharges } from './autoCharges.js'
import { todayStr } from '../utils/dates.js'
import { toFrontendAssignment } from '../utils/doctors.js'
import { inpatientActionError, validateAssignDoctorBody } from '../utils/validation.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export async function listAssignments(patientId) {
  const rows = await DoctorAssignment.find({ patientId }).sort({ effectiveFrom: 1, assignedAt: 1 })
  return rows.map(toFrontendAssignment)
}

export async function assignDoctor(patientId, body, userName, { generateCharges = true } = {}) {
  const patient = await Patient.findOne({ patientId })
  if (!patient) throw httpError(404, 'Patient not found')

  const errors = validateAssignDoctorBody(body, patient)
  if (errors.length) throw httpError(400, errors[0])

  if (!mongoose.isValidObjectId(body.doctorId)) throw httpError(400, 'Doctor is not valid.')
  const doctor = await Doctor.findById(body.doctorId)
  if (!doctor) throw httpError(404, 'Doctor not found')
  if (!doctor.active) throw httpError(400, 'Inactive doctors cannot be assigned to patients.')

  const existingActive = await DoctorAssignment.findOne({
    patientId,
    doctorId: doctor._id.toString(),
    status: 'active',
  })
  if (existingActive) return toFrontendAssignment(existingActive)

  const effectiveFrom = String(body.effectiveFrom || todayStr())
  try {
    const created = await DoctorAssignment.create({
      patientId,
      doctorId: doctor._id.toString(),
      doctorNameSnapshot: doctor.name,
      specialtySnapshot: doctor.specialty,
      visitPriceSnapshot: doctor.visitPrice,
      effectiveFrom,
      assignedBy: userName,
      assignedAt: new Date(),
      status: 'active',
    })
    if (generateCharges) await ensureAutomaticDailyCharges(patient)
    return toFrontendAssignment(created)
  } catch (err) {
    if (err?.code === 11000) {
      const again = await DoctorAssignment.findOne({
        patientId,
        doctorId: doctor._id.toString(),
        status: 'active',
      })
      if (again) return toFrontendAssignment(again)
      throw httpError(409, 'This doctor is already assigned to the patient.')
    }
    throw err
  }
}

export async function assignDoctorsOnAdmit(patient, doctorIds, userName) {
  const ids = [...new Set((doctorIds || []).map((id) => String(id).trim()).filter(Boolean))]
  if (!ids.length) return []
  const doctors = await Doctor.find({ _id: { $in: ids } })
  if (doctors.length !== ids.length) {
    const error = new Error('One or more selected doctors were not found.')
    error.status = 400
    throw error
  }
  if (doctors.some((d) => !d.active)) {
    const error = new Error('Inactive doctors cannot be assigned to patients.')
    error.status = 400
    throw error
  }
  const assignments = []
  for (const doctorId of ids) {
    assignments.push(
      await assignDoctor(patient.patientId, { doctorId, effectiveFrom: patient.admissionDate }, userName, {
        generateCharges: false,
      })
    )
  }
  return assignments
}

export async function endAssignment(patientId, assignmentId, userName) {
  const patient = await Patient.findOne({ patientId })
  if (!patient) throw httpError(404, 'Patient not found')
  const stayError = inpatientActionError(patient, 'assign-doctor')
  if (stayError) throw httpError(400, stayError)

  const assignment = await DoctorAssignment.findOne({ _id: assignmentId, patientId })
  if (!assignment) throw httpError(404, 'Doctor assignment not found')
  if (assignment.status === 'ended') return toFrontendAssignment(assignment)

  assignment.status = 'ended'
  assignment.effectiveTo = todayStr()
  assignment.endedBy = userName
  assignment.endedAt = new Date()
  await assignment.save()
  return toFrontendAssignment(assignment)
}

export async function endActiveAssignments(patientId, endDate, userName) {
  await DoctorAssignment.updateMany(
    { patientId, status: 'active' },
    {
      $set: {
        status: 'ended',
        effectiveTo: endDate,
        endedBy: userName,
        endedAt: new Date(),
      },
    }
  )
}
