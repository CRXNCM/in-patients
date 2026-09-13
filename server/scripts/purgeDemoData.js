import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Doctor } from '../models/Doctor.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import { Bed } from '../models/Bed.js'

async function purge() {
  await connectDB(process.env.MONGODB_URI)

  const [patients, doctors, records, deposits, rooms, assignments] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments(),
    ServiceRecord.countDocuments(),
    Deposit.countDocuments(),
    RoomAssignment.countDocuments(),
    DoctorAssignment.countDocuments(),
  ])

  await Promise.all([
    Patient.deleteMany({}),
    Deposit.deleteMany({}),
    RoomAssignment.deleteMany({}),
    ServiceRecord.deleteMany({}),
    Doctor.deleteMany({}),
    DoctorAssignment.deleteMany({}),
    Bed.updateMany({}, { $set: { status: 'available', patientId: null } }),
  ])

  console.log('Purged demo/test clinical data:')
  console.log(`  Patients removed: ${patients}`)
  console.log(`  Doctors removed: ${doctors}`)
  console.log(`  Service records removed: ${records}`)
  console.log(`  Deposits removed: ${deposits}`)
  console.log(`  Room assignments removed: ${rooms}`)
  console.log(`  Doctor assignments removed: ${assignments}`)
  console.log('  All beds set to available')
  console.log('Staff users, room inventory, service catalog, and settings were kept.')

  await mongoose.disconnect()
}

purge().catch((err) => {
  console.error(err)
  process.exit(1)
})
