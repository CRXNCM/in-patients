import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { ensureDefaultRoles } from '../services/roles.js'
import { Bed } from '../models/Bed.js'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Doctor } from '../models/Doctor.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import { ClinicalNote } from '../models/ClinicalNote.js'
import { seedBaselineDepartmentsAndWards, printSeedSummary } from './seedDepartmentsWards.js'
import { loadCatalogSeed } from '../utils/catalogSnapshot.js'

const DEMO_USERS = [
  { email: 'reception@cc', name: 'Sara Bekele', role: 'Reception', slug: 'reception' },
  { email: 'nurse@cc', name: 'Nurse Almaz Tsegaye', role: 'Nurse', slug: 'nurse' },
  { email: 'emergency-nurse@cc', name: 'Emergency Nurse Hanna', role: 'Nurse', slug: 'emergency-nurse' },
  { email: 'admin@cc', name: 'Admin User', role: 'Admin', slug: 'admin' },
  { email: 'manager@cc', name: 'Manager User', role: 'Manager', slug: 'manager' },
  { email: 'pharmacist@cc', name: 'Dawit Lemma', role: 'Pharmacist', slug: 'pharmacist' },
  { email: 'laboratory@cc', name: 'Bethlehem Assefa', role: 'Laboratory', slug: 'laboratory' },
]

const ROOM_CONFIG = [
  { roomType: 'General Ward', prefix: 'GW', dailyRate: 1500, bedCount: 20 },
  { roomType: 'Private Room', prefix: 'PR', dailyRate: 5000, bedCount: 12 },
  { roomType: 'ICU', prefix: 'ICU', dailyRate: 8000, bedCount: 8 },
  { roomType: 'Operation', prefix: 'OP', dailyRate: 10000, bedCount: 4 },
]

function buildBeds() {
  const beds = []
  for (const room of ROOM_CONFIG) {
    for (let i = 1; i <= room.bedCount; i++) {
      const label = `${room.prefix}-${String(i).padStart(2, '0')}`
      beds.push({
        label,
        roomType: room.roomType,
        dailyRate: room.dailyRate,
        status: 'available',
        patientId: null,
      })
    }
  }
  return beds
}

async function seed() {
  await connectDB(process.env.MONGODB_URI)
  const hash = await bcrypt.hash('password', 10)

  await Promise.all([
    User.deleteMany({}),
    Bed.deleteMany({}),
    Patient.deleteMany({}),
    Deposit.deleteMany({}),
    RoomAssignment.deleteMany({}),
    ServiceCategory.deleteMany({}),
    ServiceRecord.deleteMany({}),
    HospitalSettings.deleteMany({}),
    Doctor.deleteMany({}),
    DoctorAssignment.deleteMany({}),
    ClinicalNote.deleteMany({}),
    Role.deleteMany({}),
  ])

  await ensureDefaultRoles()
  const roles = await Role.find()
  const roleBySlug = Object.fromEntries(roles.map((r) => [r.slug, r]))
  await User.insertMany(
    DEMO_USERS.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      username: u.email,
      password: hash,
      status: 'active',
      roleId: roleBySlug[u.slug]?._id,
    }))
  )

  await HospitalSettings.create({
    key: 'default',
    name: 'Central City Hospital',
    address: 'Konel, Dire Dawa, Ethiopia',
    tin: '0001234567',
    currency: 'ETB',
    lowBalanceThreshold: 3000,
    receiptFooter: 'Thank you for choosing Central City Hospital. Get well soon!',
    vatPercent: 0,
    dailyDoctorVisitFee: 1000,
    dailyDoctorVisitName: 'Daily Doctor Visit',
  })

  const catalog = loadCatalogSeed()
  await ServiceCategory.insertMany(catalog.categories)
  await Bed.insertMany(buildBeds())
  const hospitalSetup = await seedBaselineDepartmentsAndWards()

  console.log('Seed complete (catalog and staff only — no demo patients, doctors, or charges):')
  console.log('  Users: 7 (password: password)')
  console.log('  Beds:', await Bed.countDocuments())
  console.log('  Patients: 0')
  console.log('  Doctors: 0')
  console.log(`  Categories: ${catalog.categoryCount} (${catalog.itemCount} catalog items)`)
  printSeedSummary(hospitalSetup, { heading: 'Baseline departments and wards:' })
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
