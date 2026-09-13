import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { approveDischarge } from './discharge.js'
import { todayStr } from '../utils/dates.js'

const PREFIX = 'dischargerule-test-'
const hasDb = Boolean(process.env.MONGODB_URI)

describe('discharge with outstanding balance setting', { skip: !hasDb }, () => {
  let snapshot = null
  const patientId = `${PREFIX}P1`

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    snapshot = await HospitalSettings.findOne({ key: 'default' }).lean()
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ServiceRecord.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    const today = todayStr()
    await Patient.create({
      patientId,
      name: 'Discharge Rule Patient',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'pending-discharge',
      pendingDischarge: true,
      depositTotal: 100,
      disabledDoctorVisitDates: [today],
    })
    await ServiceRecord.create({
      patientId,
      recordName: 'Lab work',
      date: today,
      status: 'approved',
      recordType: 'daily',
      source: 'nurse',
      submittedBy: 'Nurse A',
      recordedAt: new Date(),
      services: [{ serviceName: 'CBC', quantity: 1, unitPrice: 500, total: 500 }],
    })
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

  it('blocks approval when the setting is off and charges exceed deposits', async () => {
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: false } },
      { upsert: true }
    )
    await assert.rejects(
      () => approveDischarge(patientId, { userName: 'Tester' }),
      (err) => {
        assert.equal(err.status, 400)
        assert.match(err.message, /Outstanding balance of 400 ETB/)
        return true
      }
    )
    const stillPending = await Patient.findOne({ patientId }).lean()
    assert.equal(stillPending.status, 'pending-discharge')
  })

  it('lets approval continue once the balance is covered', async () => {
    await Patient.updateOne({ patientId }, { $set: { depositTotal: 600 } })
    // The stay has no room assignment, so passing the balance gate surfaces the next check.
    await assert.rejects(
      () => approveDischarge(patientId, { userName: 'Tester' }),
      (err) => {
        assert.match(err.message, /No active room assignment/)
        return true
      }
    )
  })

  it('does not check the balance when the setting is on', async () => {
    await Patient.updateOne({ patientId }, { $set: { depositTotal: 0 } })
    await HospitalSettings.updateOne(
      { key: 'default' },
      { $set: { allowDischargeWithOutstandingBalance: true } },
      { upsert: true }
    )
    await assert.rejects(
      () => approveDischarge(patientId, { userName: 'Tester' }),
      (err) => {
        assert.match(err.message, /No active room assignment/)
        return true
      }
    )
  })
})
