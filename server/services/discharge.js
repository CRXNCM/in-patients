import mongoose from 'mongoose'
import { Patient } from '../models/Patient.js'
import { Bed } from '../models/Bed.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ensureAutomaticDailyCharges, calcPatientBalance } from './autoCharges.js'
import {
  dischargeRequestStatusError,
  dischargeApproveStatusError,
  dischargeRejectStatusError,
  validateDischargeRejectBody,
} from '../utils/validation.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function event(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

function isTransactionUnsupported(err) {
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    /replica set|transaction numbers|Transactions? are/i.test(err?.message || '')
  )
}

async function runOptionallyInTransaction(work) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      return work(null)
    }
    throw err
  } finally {
    await session.endSession()
  }
}

function sessionOpt(session) {
  return session ? { session } : {}
}

export async function requestDischarge(patientId, { notes, userName }) {
  const existing = await Patient.findOne({ patientId })
  if (!existing) {
    const error = new Error('Patient not found')
    error.status = 404
    throw error
  }

  const statusError = dischargeRequestStatusError(existing.status)
  if (statusError) {
    const error = new Error(statusError)
    error.status = 400
    throw error
  }

  const now = new Date()
  const note = String(notes || '').trim()
  const claimed = await Patient.findOneAndUpdate(
    { patientId, status: 'admitted' },
    {
      $set: {
        status: 'pending-discharge',
        pendingDischarge: true,
        dischargeRequestedBy: userName,
        dischargeRequestedAt: now,
        dischargeRequestNotes: note,
        dischargeRejectedBy: null,
        dischargeRejectedAt: null,
        dischargeRejectionReason: null,
        updatedBy: userName,
      },
      $push: { dischargeEvents: event('requested', userName, note || 'Discharge requested') },
    },
    { new: true }
  )

  if (!claimed) {
    const latest = await Patient.findOne({ patientId })
    const error = new Error(
      dischargeRequestStatusError(latest?.status) || 'Could not create discharge request.'
    )
    error.status = latest?.status === 'admitted' ? 409 : 400
    if (latest?.status === 'pending-discharge' || latest?.status === 'discharged') {
      error.status = latest.status === 'pending-discharge' ? 409 : 400
    }
    throw error
  }

  return claimed
}

export async function rejectDischarge(patientId, { reason, userName }) {
  const bodyErrors = validateDischargeRejectBody({ reason })
  if (bodyErrors.length) {
    const error = new Error(bodyErrors[0])
    error.status = 400
    throw error
  }

  const existing = await Patient.findOne({ patientId })
  if (!existing) {
    const error = new Error('Patient not found')
    error.status = 404
    throw error
  }

  const statusError = dischargeRejectStatusError(existing.status)
  if (statusError) {
    const error = new Error(statusError)
    error.status = 400
    throw error
  }

  const now = new Date()
  const trimmed = String(reason).trim()
  const claimed = await Patient.findOneAndUpdate(
    { patientId, status: 'pending-discharge' },
    {
      $set: {
        status: 'admitted',
        pendingDischarge: false,
        dischargeRejectedBy: userName,
        dischargeRejectedAt: now,
        dischargeRejectionReason: trimmed,
        updatedBy: userName,
      },
      $push: { dischargeEvents: event('rejected', userName, trimmed) },
    },
    { new: true }
  )

  if (!claimed) {
    const error = new Error('Discharge request was already reviewed.')
    error.status = 409
    throw error
  }

  return claimed
}

async function completeDischargeWork(patientId, userName, session) {
  const opt = sessionOpt(session)
  const patient = await Patient.findOne({ patientId }, null, opt)
  if (!patient) {
    const error = new Error('Patient not found')
    error.status = 404
    throw error
  }

  const statusError = dischargeApproveStatusError(patient.status)
  if (statusError) {
    const error = new Error(statusError)
    error.status = 400
    throw error
  }

  const assignment = await RoomAssignment.findOne({ patientId, endDate: null }, null, opt)
  if (!assignment) {
    const error = new Error('No active room assignment. Cannot complete discharge.')
    error.status = 400
    throw error
  }

  const bed = await Bed.findOne({ label: assignment.bedLabel }, null, opt)
  if (!bed) {
    const error = new Error('Assigned bed was not found. Cannot complete discharge.')
    error.status = 400
    throw error
  }

  const dischargeDate = todayStr()
  await ensureAutomaticDailyCharges(patient, dischargeDate)

  const closed = await RoomAssignment.findOneAndUpdate(
    { _id: assignment._id, endDate: null },
    { $set: { endDate: dischargeDate } },
    { new: true, ...opt }
  )
  if (!closed) {
    const error = new Error('Room assignment was already closed.')
    error.status = 409
    throw error
  }

  if (bed.status === 'occupied' && (!bed.patientId || bed.patientId === patientId)) {
    bed.status = 'available'
    bed.patientId = null
    await bed.save(opt)
  } else if (bed.patientId && bed.patientId !== patientId) {
    const error = new Error('Bed is occupied by a different patient. Cannot complete discharge.')
    error.status = 409
    throw error
  }

  const balance = await calcPatientBalance(patientId)
  const now = new Date()
  const claimed = await Patient.findOneAndUpdate(
    { patientId, status: 'pending-discharge' },
    {
      $set: {
        status: 'discharged',
        pendingDischarge: false,
        dischargeCompletedBy: userName,
        dischargeCompletedAt: now,
        dischargeFinalCharges: balance.totalCharges,
        dischargeFinalDeposits: balance.depositTotal,
        dischargeFinalBalance: balance.balance,
        updatedBy: userName,
      },
      $push: {
        dischargeEvents: event(
          'approved',
          userName,
          `Discharge completed. Charges ${balance.totalCharges}, deposits ${balance.depositTotal}, remaining ${balance.balance}.`
        ),
      },
    },
    { new: true, ...opt }
  )

  if (!claimed) {
    await RoomAssignment.findOneAndUpdate(
      { _id: assignment._id },
      { $set: { endDate: null } },
      opt
    )
    bed.status = 'occupied'
    bed.patientId = patientId
    await bed.save(opt)
    const error = new Error('Discharge was already completed.')
    error.status = 409
    throw error
  }

  return { patient: claimed, balance, dischargeDate }
}

export async function approveDischarge(patientId, { userName }) {
  return runOptionallyInTransaction((session) => completeDischargeWork(patientId, userName, session))
}
