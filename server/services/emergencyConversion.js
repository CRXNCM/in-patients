import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { claimAvailableBed, releaseBed } from './beds.js'
import { assignDoctorsOnAdmit } from './doctorAssignments.js'
import { ensureAutomaticDailyCharges, calcPatientBalance } from './autoCharges.js'
import { resolveActiveCreditCompany } from './creditCompanies.js'
import { normalizeAdmissionPaymentMode } from '../utils/credit.js'
import { validateConvertToInpatientBody } from '../utils/validation.js'
import { isEmergencyOpdAdmission } from '../utils/admissions.js'
import { todayStr } from '../utils/dates.js'

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

export async function convertEmergencyOpdToInpatient({
  patientId,
  body,
  userName,
  actor = null,
  pathway = 'reception',
  conversionRequestId = '',
  rules,
}) {
  const patient = await Patient.findOne({ patientId })
  if (!patient) throw httpError(404, 'Patient not found')
  if (!isEmergencyOpdAdmission(patient)) {
    throw httpError(400, 'Only Emergency OPD admissions can be converted to inpatient.')
  }
  if (patient.status === 'discharged') {
    throw httpError(400, 'A discharged admission cannot be converted.')
  }

  const errors = validateConvertToInpatientBody(body, rules)
  if (errors.length) throw httpError(400, errors[0])

  const label = String(body.bedId).replace(/^BED-/, '')
  let bedDoc
  try {
    bedDoc = await claimAvailableBed({ label, patientId: patient.patientId })
  } catch (err) {
    throw httpError(err.status || 400, err.message)
  }

  const paymentMode = normalizeAdmissionPaymentMode(body.admissionPaymentMode)
  let creditCompany = null
  if (paymentMode === 'credit') {
    const resolved = await resolveActiveCreditCompany(body.creditCompanyId)
    if (resolved.error) {
      await releaseBed(bedDoc, patient.patientId).catch(() => {})
      throw httpError(400, resolved.error)
    }
    creditCompany = resolved.company
  }

  const deposit = Number(body.depositAmount) || 0
  const conversionDate = todayStr()
  const doctorIds = [...new Set((body.doctorIds || []).map((id) => String(id).trim()).filter(Boolean))]

  try {
    patient.admissionType = 'normal'
    patient.originalAdmissionType = patient.originalAdmissionType || 'emergency-opd'
    patient.convertedFromEmergency = true
    patient.convertedToInpatientAt = new Date()
    patient.convertedToInpatientBy = userName
    patient.room = bedDoc.roomType
    patient.bed = bedDoc.label
    patient.bedId = bedDoc._id.toString()
    patient.depositTotal = (Number(patient.depositTotal) || 0) + (deposit > 0 ? deposit : 0)
    patient.requiredInitialDeposit = paymentMode === 'credit' ? 0 : rules.minimumInitialDeposit
    patient.admissionPaymentMode = paymentMode
    patient.isCreditPatient = paymentMode === 'credit'
    patient.creditCompanyId = creditCompany ? String(creditCompany._id) : ''
    patient.creditCompanyName = creditCompany ? creditCompany.name : ''
    patient.creditMarkedBy = paymentMode === 'credit' ? userName : undefined
    patient.creditMarkedAt = paymentMode === 'credit' ? new Date() : undefined
    patient.updatedBy = userName

    await RoomAssignment.create({
      patientId: patient.patientId,
      bedId: bedDoc.label,
      roomType: bedDoc.roomType,
      bedLabel: bedDoc.label,
      startDate: conversionDate,
      dailyRate: bedDoc.dailyRate,
      reason: 'Converted from Emergency OPD',
      assignedBy: userName,
    })

    let depositDoc = null
    if (deposit > 0) {
      depositDoc = await Deposit.create({
        patientId: patient.patientId,
        amount: deposit,
        method: body.depositMethod || 'Cash',
        referenceNumber: body.referenceNumber?.trim() || undefined,
        date: conversionDate,
        receivedBy: userName,
        isInitial: true,
      })
    }

    const assignedDoctors = await assignDoctorsOnAdmit(patient, doctorIds, userName)

    const conversionEvent = {
      fromType: 'emergency-opd',
      toType: 'normal',
      at: new Date().toISOString(),
      by: userName,
      byId: actor?.id || '',
      byRole: actor?.role || '',
      pathway,
      conversionRequestId: conversionRequestId || '',
      room: bedDoc.roomType,
      bed: bedDoc.label,
      bedId: bedDoc._id.toString(),
      doctorIds,
      depositAmount: deposit,
      depositMethod: deposit > 0 ? (body.depositMethod || 'Cash') : '',
      depositId: depositDoc ? String(depositDoc._id) : '',
      admissionPaymentMode: paymentMode,
    }
    patient.conversionEvents = [...(patient.conversionEvents || []), conversionEvent]
    await patient.save()

    await ensureAutomaticDailyCharges(patient, null, { range: true })
    const balance = await calcPatientBalance(patient.patientId)
    return { patient, bedDoc, assignedDoctors, balance, depositDoc, conversionEvent }
  } catch (err) {
    await releaseBed(bedDoc, patient.patientId).catch(() => {})
    throw err
  }
}
