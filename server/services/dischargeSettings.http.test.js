import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { Bed } from '../models/Bed.js'
import { approveDischarge } from './discharge.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'dischargerule-test-'
const hasDb = Boolean(process.env.MONGODB_URI)

function approvedLab(patientId, amount) {
  return {
    patientId,
    recordName: 'Lab work',
    date: todayStr(),
    status: 'approved',
    recordType: 'daily',
    source: 'nurse',
    submittedBy: 'Nurse A',
    recordedAt: new Date(),
    services: [{ serviceName: 'CBC', quantity: 1, unitPrice: amount, total: amount }],
  }
}

describe('discharge with outstanding balance setting', { skip: !hasDb }, () => {
  let snapshot = null
  const paidId = `${PREFIX}P1`
  const creditId = `${PREFIX}P2`

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    snapshot = await HospitalSettings.findOne({ key: 'default' }).lean()
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    const today = todayStr()
    await Patient.create({
      patientId: paidId,
      name: 'Discharge Rule Paid Patient',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'pending-discharge',
      pendingDischarge: true,
      admissionPaymentMode: 'paid',
      requiredInitialDeposit: 15000,
      depositTotal: 100,
      isCreditPatient: false,
      disabledDoctorVisitDates: [today],
    })
    await Patient.create({
      patientId: creditId,
      name: 'Discharge Rule Credit Patient',
      gender: 'Female',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'pending-discharge',
      pendingDischarge: true,
      admissionPaymentMode: 'credit',
      requiredInitialDeposit: 15000,
      depositTotal: 100,
      isCreditPatient: true,
      disabledDoctorVisitDates: [today],
    })
    await ServiceRecord.create(approvedLab(paidId, 500))
    await ServiceRecord.create(approvedLab(creditId, 500))
  })

  after(async () => {
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    if (snapshot) {
      const { _id, ...rest } = snapshot
      await HospitalSettings.replaceOne({ key: 'default' }, rest, { upsert: true })
    } else {
      await HospitalSettings.deleteOne({ key: 'default' })
    }
    await mongoose.disconnect()
  })

  it('blocks non-credit patients with an outstanding balance even when the setting is on', async () => {
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: true } },
      { upsert: true }
    )
    await Patient.updateOne({ patientId: paidId }, { $set: { depositTotal: 100 } })
    await assert.rejects(
      () => approveDischarge(paidId, { userName: 'Tester' }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /Non-credit patients must settle an outstanding balance of 400 ETB/)
        return true
      }
    )
    const stillPending = await Patient.findOne({ patientId: paidId }).lean()
    assert.equal(stillPending.status, 'pending-discharge')
  })

  it('blocks non-credit patients when the setting is off and charges exceed deposits', async () => {
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: false } },
      { upsert: true }
    )
    await assert.rejects(
      () => approveDischarge(paidId, { userName: 'Tester' }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /Non-credit patients must settle an outstanding balance of 400 ETB/)
        return true
      }
    )
    const stillPending = await Patient.findOne({ patientId: paidId }).lean()
    assert.equal(stillPending.status, 'pending-discharge')
  })

  it('lets paid approval continue once the balance is covered', async () => {
    await Patient.updateOne({ patientId: paidId }, { $set: { depositTotal: 600 } })
    await assert.rejects(
      () => approveDischarge(paidId, { userName: 'Tester' }),
      (err) => {
        assert.match(err.message, /No active room assignment/)
        return true
      }
    )
  })

  it('lets credit patients proceed with an outstanding balance when the setting is on', async () => {
    await Patient.updateOne({ patientId: creditId }, { $set: { depositTotal: 100 } })
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: true } },
      { upsert: true }
    )
    await assert.rejects(
      () => approveDischarge(creditId, { userName: 'Tester' }),
      (err) => {
        assert.match(err.message, /No active room assignment/)
        return true
      }
    )
  })

  it('blocks credit patients with an outstanding balance when the setting is off', async () => {
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: false } },
      { upsert: true }
    )
    await assert.rejects(
      () => approveDischarge(creditId, { userName: 'Tester' }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /Outstanding balance of 400 ETB must be settled/)
        return true
      }
    )
    const stillPending = await Patient.findOne({ patientId: creditId }).lean()
    assert.equal(stillPending.status, 'pending-discharge')
  })

  it('blocks approval while a pending record exists', async () => {
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: true } },
      { upsert: true }
    )
    await Patient.updateOne({ patientId: paidId }, { $set: { depositTotal: 600 } })
    const pending = await ServiceRecord.create({
      patientId: paidId,
      recordName: 'Pending lab',
      date: todayStr(),
      status: 'pending',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Nurse A',
      recordedAt: new Date(),
      services: [{ serviceName: 'ESR', quantity: 1, unitPrice: 50, total: 50 }],
    })
    await assert.rejects(
      () => approveDischarge(paidId, { userName: 'Tester' }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /pending record/)
        return true
      }
    )
    const stillPending = await Patient.findOne({ patientId: paidId }).lean()
    assert.equal(stillPending.status, 'pending-discharge')
    await ServiceRecord.deleteOne({ _id: pending._id })
  })

  it('completes discharge when the room assignment was already closed', async () => {
    const closedId = `${PREFIX}CLOSED`
    const today = todayStr()
    const label = `${PREFIX}BED-1`
    await Patient.deleteMany({ patientId: closedId })
    await RoomAssignment.deleteMany({ patientId: closedId })
    await Bed.deleteMany({ label })
    await ServiceRecord.deleteMany({ patientId: closedId })
    await Bed.create({
      label,
      name: label,
      nameKey: label.toLowerCase(),
      roomType: 'General Ward',
      dailyRate: 1500,
      status: 'available',
      patientId: null,
    })
    await Patient.create({
      patientId: closedId,
      name: 'Closed Assignment Patient',
      gender: 'Male',
      address: 'Dire Dawa',
      admissionDate: today,
      admissionType: 'normal',
      status: 'pending-discharge',
      pendingDischarge: true,
      room: 'General Ward',
      bed: label,
      admissionPaymentMode: 'paid',
      requiredInitialDeposit: 0,
      depositTotal: 600,
      isCreditPatient: false,
      disabledDoctorVisitDates: [today],
    })
    await RoomAssignment.create({
      patientId: closedId,
      bedId: label,
      roomType: 'General Ward',
      bedLabel: label,
      startDate: today,
      endDate: today,
      dailyRate: 1500,
      reason: 'Converted from Emergency OPD',
      assignedBy: 'Tester',
    })
    const result = await approveDischarge(closedId, { userName: 'Tester' })
    assert.equal(result.patient.status, 'discharged')
    await ServiceRecord.deleteMany({ patientId: closedId })
    await RoomAssignment.deleteMany({ patientId: closedId })
    await Patient.deleteMany({ patientId: closedId })
    await Bed.deleteMany({ label })
  })
})
