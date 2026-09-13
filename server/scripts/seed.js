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
import { seedBaselineDepartmentsAndWards, printSeedSummary } from './seedDepartmentsWards.js'

const DEMO_USERS = [
  { email: 'reception@cc', name: 'Sara Bekele', role: 'Reception' },
  { email: 'nurse@cc', name: 'Nurse Almaz Tsegaye', role: 'Nurse' },
  { email: 'admin@cc', name: 'Admin User', role: 'Admin' },
  { email: 'manager@cc', name: 'Manager User', role: 'Manager' },
]

const ROOM_CONFIG = [
  { roomType: 'General Ward', prefix: 'GW', dailyRate: 1500, bedCount: 20 },
  { roomType: 'Private Room', prefix: 'PR', dailyRate: 5000, bedCount: 12 },
  { roomType: 'ICU', prefix: 'ICU', dailyRate: 8000, bedCount: 8 },
  { roomType: 'Operation', prefix: 'OP', dailyRate: 10000, bedCount: 4 },
]

const CATEGORIES = [
  {
    slug: 'pharmacy',
    name: 'Pharmacy',
    description: 'Medications and IV drugs',
    billingType: 'quantity',
    services: [
      { name: 'Paracetamol 500mg', price: 15 },
      { name: 'Ibuprofen 400mg', price: 20 },
      { name: 'Diclofenac Injection', price: 80 },
      { name: 'Tramadol Injection', price: 150 },
      { name: 'Amoxicillin 500mg', price: 35 },
      { name: 'Ceftriaxone 1g', price: 280 },
      { name: 'Cefixime 400mg', price: 120 },
      { name: 'Azithromycin 500mg', price: 90 },
      { name: 'Metronidazole IV', price: 180 },
      { name: 'Gentamicin Injection', price: 120 },
      { name: 'Insulin', price: 350 },
      { name: 'Omeprazole Injection', price: 150 },
      { name: 'Pantoprazole Injection', price: 180 },
      { name: 'IV Normal Saline 500ml', price: 120 },
      { name: 'Ringer Lactate', price: 140 },
      { name: 'Dextrose 5%', price: 150 },
      { name: 'Dopamine IV', price: 450 },
      { name: 'Adrenaline Injection', price: 120 },
      { name: 'Hydrocortisone Injection', price: 180 },
      { name: 'Vitamin K Injection', price: 100 }
    ],
  },
  {
    slug: 'medical-supplies',
    name: 'Medical Supplies',
    description: 'Reusable and durable medical supplies',
    billingType: 'quantity',
    services: [
      { name: 'Blood Pressure Cuff (use)', price: 100 },
      { name: 'Pulse Oximeter (use)', price: 80 },
      { name: 'Nebulizer Kit', price: 250 },
      { name: 'Wheelchair Rental', price: 300 },
      { name: 'Oxygen Cylinder', price: 500 },
      { name: 'Oxygen Mask', price: 120 },
      { name: 'Suction Machine Use', price: 400 },
      { name: 'Infusion Pump Use', price: 350 },
      { name: 'ECG Machine Use', price: 600 },
      { name: 'Patient Monitor Use', price: 500 },
      { name: 'Walker', price: 250 },
      { name: 'Crutches', price: 300 }
    ],
  },
  {
    slug: 'consumables',
    name: 'Consumables',
    description: 'Disposable medical supplies',
    billingType: 'quantity',
    services: [
      { name: 'Surgical Gloves (pair)', price: 25 },
      { name: 'Sterile Gloves', price: 40 },
      { name: 'Face Mask', price: 10 },
      { name: 'Syringe 2ml', price: 10 },
      { name: 'Syringe 5ml', price: 15 },
      { name: 'Syringe 10ml', price: 20 },
      { name: 'IV Cannula 18G', price: 45 },
      { name: 'IV Cannula 20G', price: 45 },
      { name: 'Alcohol Swab', price: 5 },
      { name: 'Cotton Roll', price: 30 },
      { name: 'Gauze', price: 20 },
      { name: 'Bandage Roll', price: 35 },
      { name: 'Micropore Tape', price: 45 },
      { name: 'Urine Bag', price: 150 },
      { name: 'NG Tube', price: 180 },
      { name: 'Feeding Tube', price: 160 },
      { name: 'Disposable Apron', price: 50 },
      { name: 'Surgical Blade', price: 25 }
    ],
  },
  {
    slug: 'laboratory',
    name: 'Laboratory',
    description: 'Lab tests and diagnostic requests',
    billingType: 'selection',
    services: [
      { name: 'Complete Blood Count (CBC)', price: 450 },
      { name: 'Blood Sugar (FBS)', price: 200 },
      { name: 'Random Blood Sugar', price: 200 },
      { name: 'HbA1c', price: 700 },
      { name: 'Liver Function Test', price: 1200 },
      { name: 'Kidney Function Test', price: 1100 },
      { name: 'Electrolytes', price: 900 },
      { name: 'Lipid Profile', price: 1000 },
      { name: 'Urinalysis', price: 250 },
      { name: 'Stool Examination', price: 300 },
      { name: 'Blood Group & Rh', price: 300 },
      { name: 'Cross Match', price: 500 },
      { name: 'Pregnancy Test', price: 250 },
      { name: 'HIV Test', price: 450 },
      { name: 'Hepatitis B Test', price: 600 },
      { name: 'Malaria Test', price: 350 },
      { name: 'Typhoid Test', price: 450 },
      { name: 'COVID-19 Test', price: 700 }
    ]
  },
  {
    slug: 'procedures',
    name: 'Procedures',
    description: 'Clinical procedures and nursing interventions',
    billingType: 'selection',
    services: [
      { name: 'Wound Dressing', price: 800 },
      { name: 'Suturing', price: 1200 },
      { name: 'Catheter Insertion', price: 1500 },
      { name: 'Catheter Removal', price: 500 },
      { name: 'Nebulization Therapy', price: 600 },
      { name: 'IV Cannulation', price: 350 },
      { name: 'Blood Transfusion', price: 1800 },
      { name: 'NG Tube Insertion', price: 1200 },
      { name: 'Oxygen Therapy', price: 600 },
      { name: 'ECG', price: 700 },
      { name: 'CPR', price: 2500 },
      { name: 'Minor Surgery', price: 3500 },
      { name: 'Abscess Drainage', price: 2000 },
      { name: 'Plaster Application', price: 1800 },
      { name: 'Cast Removal', price: 1000 }
    ],
  },
  {
    slug: 'radiology',
    name: 'Radiology',
    description: 'Imaging and diagnostic scans',
    billingType: 'selection',
    services: [
      { name: 'Chest X-Ray', price: 800 },
      { name: 'Abdominal X-Ray', price: 900 },
      { name: 'Pelvic X-Ray', price: 900 },
      { name: 'Spine X-Ray', price: 1200 },
      { name: 'Ultrasound Scan', price: 3500 },
      { name: 'Obstetric Ultrasound', price: 3000 },
      { name: 'Echocardiography', price: 4500 },
      { name: 'CT Scan - Head', price: 8500 },
      { name: 'CT Scan - Chest', price: 9000 },
      { name: 'CT Scan - Abdomen', price: 9500 },
      { name: 'MRI Brain', price: 15000 },
      { name: 'MRI Spine', price: 16000 },
      { name: 'Mammography', price: 5000 }
    ],
  },
  {
    slug: 'doctor',
    name: 'Doctor Visits',
    description: 'Automatic daily physician visit while admitted',
    billingType: 'automatic_daily',
    services: [{ name: 'Daily Doctor Visit', price: 2000 }],
  },
  {
    slug: 'room',
    name: 'Room Services',
    description: 'Automatic daily room charge from room assignment',
    billingType: 'automatic_daily',
    services: [
      { name: 'General Ward - Daily Rate', price: 1500 },
      { name: 'Private Room - Daily Rate', price: 5000 },
      { name: 'ICU - Daily Rate', price: 8000 },
      { name: 'Operation Room - Daily Rate', price: 10000 },
    ],
  },
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
    Role.deleteMany({}),
  ])

  await ensureDefaultRoles()
  const roles = await Role.find()
  const roleByAccess = Object.fromEntries(roles.filter((r) => r.system).map((r) => [r.accessRole, r]))
  await User.insertMany(
    DEMO_USERS.map((u) => ({
      ...u,
      username: u.email,
      password: hash,
      status: 'active',
      roleId: roleByAccess[u.role]?._id,
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

  await ServiceCategory.insertMany(CATEGORIES)
  await Bed.insertMany(buildBeds())
  const hospitalSetup = await seedBaselineDepartmentsAndWards()

  console.log('Seed complete (catalog and staff only — no demo patients, doctors, or charges):')
  console.log('  Users: 4 (password: password)')
  console.log('  Beds:', await Bed.countDocuments())
  console.log('  Patients: 0')
  console.log('  Doctors: 0')
  console.log('  Categories:', await ServiceCategory.countDocuments())
  printSeedSummary(hospitalSetup, { heading: 'Baseline departments and wards:' })
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
