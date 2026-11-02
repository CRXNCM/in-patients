import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Doctor } from '../models/Doctor.js'
import { DoctorAssignment } from '../models/DoctorAssignment.js'
import { ClinicalNote } from '../models/ClinicalNote.js'
import { MaternityBaby } from '../models/MaternityBaby.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { LaboratoryRequest } from '../models/LaboratoryRequest.js'
import { WardSubmission } from '../models/WardSubmission.js'
import { ConversionRequest } from '../models/ConversionRequest.js'
import { CreditCompany } from '../models/CreditCompany.js'
import { Bed } from '../models/Bed.js'
import { User } from '../models/User.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { claimAvailableBed } from '../services/beds.js'
import { assignDoctorsOnAdmit } from '../services/doctorAssignments.js'
import { ensureAutomaticDailyCharges } from '../services/autoCharges.js'
import { applyCreditFlags } from '../utils/credit.js'
import { companyNameKey } from '../services/creditCompanies.js'
import { applyAdmissionPrice, catalogPricingForPatient, isEmergencyOpdAdmission } from '../utils/admissions.js'
import { todayStr, shiftDate } from '../utils/dates.js'

const ACTOR = 'Sara Bekele'
const NURSE = 'Nurse Almaz Tsegaye'

const DOCTORS = [
  { name: 'Dr. Yonas Mekonnen', specialty: 'Internal Medicine', visitPrice: 800, phone: '0911223344', department: 'Medical' },
  { name: 'Dr. Selamawit Haile', specialty: 'Obstetrics & Gynecology', visitPrice: 1200, phone: '0911556677', department: 'Maternity' },
  { name: 'Dr. Abel Tadesse', specialty: 'General Surgery', visitPrice: 1500, phone: '0911889900', department: 'Surgery' },
  { name: 'Dr. Hiwot Alemu', specialty: 'Cardiology', visitPrice: 1500, phone: '0911332211', department: 'Medical' },
  { name: 'Dr. Dawit Tesfaye', specialty: 'Emergency Medicine', visitPrice: 1000, phone: '0911445566', department: 'Emergency' },
  { name: 'Dr. Meron Kebede', specialty: 'Pediatrics', visitPrice: 900, phone: '0911778899', department: 'Pediatrics' },
]

const CREDIT_COMPANIES = [
  { name: 'Ethiopian Insurance Corporation', code: 'EIC', contactPerson: 'Ato Getu Hailu', phone: '0251112233', address: 'Kezira, Dire Dawa' },
  { name: 'Nile Insurance S.C.', code: 'NILE', contactPerson: 'W/ro Saba Worku', phone: '0251123344', address: 'Konel, Dire Dawa' },
  { name: 'Awash Insurance Company', code: 'AWASH', contactPerson: 'Ato Samuel Bekele', phone: '0251134455', address: 'Sabean, Dire Dawa' },
  { name: 'Dire Dawa City Administration', code: 'DDCA', contactPerson: 'Ato Ibrahim Ahmed', phone: '0251145566', address: 'City Hall, Dire Dawa' },
]

const CASES = [
  { kind: 'normal', name: 'Hana Bekele', gender: 'Female', age: 28, phone: '0911234567', address: 'Kebele 05, Sabian, Dire Dawa', roomType: 'General Ward', specialty: 'Internal Medicine', reason: 'Community-acquired pneumonia with productive cough and fever for 4 days.', services: ['CBC', 'Chest X-ray'] },
  { kind: 'credit', company: 'Ethiopian Insurance Corporation', name: 'Yonas Tesfaye', gender: 'Male', age: 54, phone: '0911987654', address: 'Kebele 03, Kezira, Dire Dawa', roomType: 'Private Room', specialty: 'Internal Medicine', reason: 'Uncontrolled type 2 diabetes mellitus with hyperglycemia and fatigue.', services: ['FBS', 'HbA1c'] },
  { kind: 'maternity', name: 'Meron Haile', gender: 'Female', age: 24, phone: '0911765432', address: 'Kebele 09, Gende Kore, Dire Dawa', roomType: 'General Ward', specialty: 'Obstetrics & Gynecology', reason: 'Term pregnancy in active labour, 39 weeks, membranes ruptured.', baby: { name: 'Baby of Meron Haile', sex: 'Female', weight: 3100, deliveryType: 'Spontaneous vaginal delivery', time: '03:40' } },
  { kind: 'emergency', name: 'Abel Kebede', gender: 'Male', age: 19, phone: '0911345678', address: 'Melka Jebdu, Dire Dawa', specialty: 'Emergency Medicine', reason: 'Acute febrile illness with chills; malaria smear requested in Emergency OPD.' },
  { kind: 'normal', name: 'Selamawit Lemma', gender: 'Female', age: 61, phone: '0911456789', address: 'Kebele 02, Taiwan, Dire Dawa', roomType: 'ICU', specialty: 'Cardiology', reason: 'Acute ischemic stroke with right-sided weakness and slurred speech.', services: ['Head without Contrast'] },
  { kind: 'credit', company: 'Nile Insurance S.C.', name: 'Dawit Mekonnen', gender: 'Male', age: 33, phone: '0911567890', address: 'Kebele 06, Addis Ketema, Dire Dawa', roomType: 'General Ward', specialty: 'Internal Medicine', reason: 'Typhoid fever with prolonged fever, abdominal pain, and constipation.', services: ['Widal', 'CBC'] },
  { kind: 'maternity', name: 'Bethlehem Assefa', gender: 'Female', age: 31, phone: '0911678901', address: 'Kebele 04, Greek Camp, Dire Dawa', roomType: 'Private Room', specialty: 'Obstetrics & Gynecology', reason: 'Severe preeclampsia at 36 weeks; blood pressure 170/110 with proteinuria.', baby: { name: 'Baby of Bethlehem Assefa', sex: 'Male', weight: 2400, deliveryType: 'Emergency caesarean section', time: '11:15' } },
  { kind: 'emergency', name: 'Tewodros Girma', gender: 'Male', age: 41, phone: '0911789012', address: 'Hafat Issa, Dire Dawa', specialty: 'Emergency Medicine', reason: 'Road traffic accident: blunt chest trauma and laceration to the left forearm.' },
  { kind: 'normal', name: 'Frehiwot Tadesse', gender: 'Female', age: 22, phone: '0911890123', address: 'Kebele 01, Megala, Dire Dawa', roomType: 'General Ward', specialty: 'General Surgery', reason: 'Acute appendicitis with migrating right iliac fossa pain and vomiting.', services: ['CBC', 'Abdominal Without contrast'] },
  { kind: 'credit', company: 'Awash Insurance Company', name: 'Mulugeta Worku', gender: 'Male', age: 47, phone: '0911012345', address: 'Kebele 07, Number One, Dire Dawa', roomType: 'Private Room', specialty: 'Internal Medicine', reason: 'Acute exacerbation of bronchial asthma after a dusty market day.', services: ['CBC'] },
  { kind: 'maternity', name: 'Rahel Solomon', gender: 'Female', age: 27, phone: '0911123456', address: 'Kebele 08, Gende Tesfa, Dire Dawa', roomType: 'General Ward', specialty: 'Obstetrics & Gynecology', reason: 'Primigravida at 40 weeks in second stage of labour.', baby: { name: 'Baby of Rahel Solomon', sex: 'Male', weight: 3450, deliveryType: 'Spontaneous vaginal delivery', time: '18:05' } },
  { kind: 'emergency', name: 'Getachew Alemu', gender: 'Male', age: 36, phone: '0911112233', address: 'Ashewa, Dire Dawa', specialty: 'Emergency Medicine', reason: 'Acute watery diarrhea and vomiting for 12 hours; dehydration in Emergency OPD.' },
  { kind: 'normal', name: 'Mahlet Fikadu', gender: 'Female', age: 16, phone: '0911223345', address: 'Kebele 10, Gende Gerada, Dire Dawa', roomType: 'General Ward', specialty: 'Pediatrics', reason: 'Plasmodium falciparum malaria with high fever and headache.', services: ['Malaria', 'CBC'] },
  { kind: 'credit', company: 'Dire Dawa City Administration', name: 'Solomon Desta', gender: 'Male', age: 58, phone: '0911334456', address: 'Kebele 03, Konel, Dire Dawa', roomType: 'ICU', specialty: 'General Surgery', reason: 'Polytrauma after a motorcycle collision; observation in ICU.', services: ['CBC', 'Chest X-ray'] },
  { kind: 'maternity', name: 'Eyerusalem Negash', gender: 'Female', age: 29, phone: '0911445567', address: 'Kebele 05, Legehare, Dire Dawa', roomType: 'Private Room', specialty: 'Obstetrics & Gynecology', reason: 'Elective repeat caesarean section at 38 weeks for previous scar.', baby: { name: 'Baby of Eyerusalem Negash', sex: 'Female', weight: 3280, deliveryType: 'Elective caesarean section', time: '09:20' } },
  { kind: 'emergency', name: 'Kassahun Berhanu', gender: 'Male', age: 45, phone: '0911556678', address: 'Goro, Dire Dawa', specialty: 'Emergency Medicine', reason: 'Severe asthma attack with wheeze and difficulty speaking full sentences.' },
  { kind: 'normal', name: 'Tsion Abera', gender: 'Female', age: 39, phone: '0911667789', address: 'Kebele 02, Sabean, Dire Dawa', roomType: 'Private Room', specialty: 'Cardiology', reason: 'Hypertensive urgency with headache and BP 190/120 mmHg.', services: ['CBC'] },
  { kind: 'normal', name: 'Mekdes Wolde', gender: 'Female', age: 35, phone: '0911778890', address: 'Kebele 06, Gende Kore, Dire Dawa', roomType: 'General Ward', specialty: 'General Surgery', reason: 'Closed fracture of the left radius after a fall at home.', services: ['CBC'] },
  { kind: 'credit', company: 'Ethiopian Insurance Corporation', name: 'Henok Getachew', gender: 'Male', age: 50, phone: '0911889901', address: 'Kebele 04, Kezira, Dire Dawa', roomType: 'General Ward', specialty: 'Internal Medicine', reason: 'Lobar pneumonia with hypoxia; started on oxygen and IV antibiotics.', services: ['CBC', 'Chest X-ray'] },
  { kind: 'normal', name: 'Kidist Ayele', gender: 'Female', age: 26, phone: '0911990012', address: 'Kebele 01, Taiwan, Dire Dawa', roomType: 'General Ward', specialty: 'Internal Medicine', reason: 'Acute pyelonephritis with flank pain, dysuria, and fever.', services: ['CBC', 'Urinalysis'] },
]

function dobFromAge(age, admissionDate) {
  const year = Number(admissionDate.slice(0, 4)) - Number(age)
  return `${year}-06-15`
}

function padId(n) {
  return `PAT-${String(n).padStart(3, '0')}`
}

function spreadDates(count, today) {
  const dates = []
  for (let i = 0; i < count; i += 1) {
    const offset = i % 7
    dates.push(shiftDate(today, -offset))
  }
  return dates
}

function findDoctor(doctors, specialty) {
  return doctors.find((row) => row.specialty === specialty) || doctors[0]
}

function findCompany(companies, name) {
  return companies.find((row) => row.name === name) || companies[0]
}

function catalogHits(categories, names = []) {
  const hits = []
  for (const wanted of names) {
    const needle = wanted.toLowerCase()
    for (const category of categories) {
      const item = (category.services || []).find((service) => service.active !== false && String(service.name).toLowerCase().includes(needle))
      if (item) {
        hits.push({ category: category.name, item })
        break
      }
    }
  }
  return hits
}

async function wipePatientData() {
  const counts = {
    patients: await Patient.countDocuments(),
    records: await ServiceRecord.countDocuments(),
    deposits: await Deposit.countDocuments(),
    rooms: await RoomAssignment.countDocuments(),
    doctorAssignments: await DoctorAssignment.countDocuments(),
    notes: await ClinicalNote.countDocuments(),
    babies: await MaternityBaby.countDocuments(),
    pharmacy: await PharmacyOrder.countDocuments(),
    laboratory: await LaboratoryOrder.countDocuments(),
    labRequests: await LaboratoryRequest.countDocuments(),
    wardSubmissions: await WardSubmission.countDocuments(),
    conversions: await ConversionRequest.countDocuments(),
  }
  await Promise.all([
    Patient.deleteMany({}),
    Deposit.deleteMany({}),
    RoomAssignment.deleteMany({}),
    ServiceRecord.deleteMany({}),
    DoctorAssignment.deleteMany({}),
    ClinicalNote.deleteMany({}),
    MaternityBaby.deleteMany({}),
    PharmacyOrder.deleteMany({}),
    LaboratoryOrder.deleteMany({}),
    LaboratoryRequest.deleteMany({}),
    WardSubmission.deleteMany({}),
    ConversionRequest.deleteMany({}),
    Bed.updateMany({ status: 'occupied' }, { $set: { status: 'available', patientId: null } }),
  ])
  return counts
}

async function ensureDoctors() {
  const docs = []
  for (const row of DOCTORS) {
    const existing = await Doctor.findOne({ name: row.name, specialty: row.specialty })
    if (existing) {
      existing.active = true
      existing.visitPrice = row.visitPrice
      await existing.save()
      docs.push(existing)
      continue
    }
    docs.push(await Doctor.create({ ...row, active: true, createdBy: ACTOR }))
  }
  return docs
}

async function ensureCompanies() {
  const rows = []
  for (const company of CREDIT_COMPANIES) {
    const nameKey = companyNameKey(company.name)
    const existing = await CreditCompany.findOne({ nameKey })
    if (existing) {
      existing.active = true
      await existing.save()
      rows.push(existing)
      continue
    }
    rows.push(await CreditCompany.create({ ...company, nameKey, active: true, createdBy: ACTOR }))
  }
  return rows
}

async function takeBed(roomType, patientId) {
  const preferred = roomType || 'General Ward'
  let bed = await Bed.findOne({ roomType: preferred, status: 'available' })
  if (!bed) bed = await Bed.findOne({ status: 'available' })
  if (!bed) throw new Error('No available bed. Run the main seed first so rooms exist.')
  return claimAvailableBed({ label: bed.label, patientId })
}

async function addCaseRecord(patient, catalog, admissionDate, serviceNames) {
  const picks = catalogHits(catalog, serviceNames || [])
  if (!picks.length) return null
  const pricing = catalogPricingForPatient(patient)
  const services = picks.map(({ category, item }) => {
    const priced = applyAdmissionPrice(item.price, { inpatientPricing: pricing.inpatientPricing })
    return {
      category,
      serviceName: item.name,
      quantity: 1,
      unitPrice: priced.unitPrice,
      baseUnitPrice: priced.baseUnitPrice,
      priceMultiplier: priced.priceMultiplier,
      pricingAdmissionType: pricing.pricingAdmissionType,
      unit: item.unit || '',
      catalogItemId: String(item._id),
      total: priced.unitPrice,
      notes: patient.admissionReason,
    }
  })
  const now = new Date().toISOString()
  return ServiceRecord.create({
    patientId: patient.patientId,
    recordName: patient.name,
    date: admissionDate,
    status: 'approved',
    recordType: 'daily',
    source: 'nurse',
    services,
    submittedBy: NURSE,
    approvedBy: ACTOR,
    recordedAt: new Date(),
    reviewedAt: new Date(),
    auditTrail: [
      { action: 'recorded', by: NURSE, at: now, note: patient.admissionReason },
      { action: 'approved', by: ACTOR, at: now, note: 'Approved on admission workup' },
    ],
  })
}

async function seed() {
  await connectDB(process.env.MONGODB_URI)
  const today = todayStr()
  const removed = await wipePatientData()

  const availableBeds = await Bed.countDocuments({ status: 'available' })
  if (availableBeds < 16) {
    throw new Error(`Need enough empty beds for inpatients (found ${availableBeds}). Run npm run seed in server first.`)
  }

  const [doctors, companies, catalog, nurse] = await Promise.all([
    ensureDoctors(),
    ensureCompanies(),
    ServiceCategory.find().lean(),
    User.findOne({ email: 'nurse@cc' }),
  ])
  const dates = spreadDates(CASES.length, today)

  for (let i = 0; i < CASES.length; i += 1) {
    const spec = CASES[i]
    const admissionDate = dates[i]
    const patientId = padId(i + 1)
    const emergency = spec.kind === 'emergency'
    const maternity = spec.kind === 'maternity'
    const credit = spec.kind === 'credit'
    const company = credit ? findCompany(companies, spec.company) : null
    const doctor = findDoctor(doctors, spec.specialty)
    const depositAmount = emergency ? 0 : credit ? 5000 : 15000

    let bedDoc = null
    if (!emergency) {
      bedDoc = await takeBed(spec.roomType, patientId)
    }

    const patient = new Patient({
      patientId,
      name: spec.name,
      age: spec.age,
      dateOfBirth: dobFromAge(spec.age, admissionDate),
      gender: spec.gender,
      phone: spec.phone,
      address: spec.address,
      emergencyContact: spec.gender === 'Female' ? 'Family member' : 'Spouse',
      emergencyPhone: '0911001122',
      admissionType: emergency ? 'emergency-opd' : maternity ? 'maternity' : 'normal',
      originalAdmissionType: emergency ? 'emergency-opd' : maternity ? 'maternity' : 'normal',
      admissionReason: spec.reason,
      admissionDate,
      status: 'admitted',
      room: bedDoc?.roomType || null,
      bed: bedDoc?.label || null,
      bedId: bedDoc?._id?.toString() || null,
      depositTotal: depositAmount,
      requiredInitialDeposit: emergency || credit ? 0 : 15000,
      admissionPaymentMode: credit ? 'credit' : 'paid',
      isCreditPatient: Boolean(credit),
      creditCompanyId: company ? String(company._id) : '',
      creditCompanyName: company ? company.name : '',
      creditMarkedBy: credit ? ACTOR : undefined,
      creditMarkedAt: credit ? new Date() : undefined,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    })
    applyCreditFlags(patient)
    await patient.save()

    if (bedDoc) {
      await RoomAssignment.create({
        patientId,
        bedId: bedDoc.label,
        roomType: bedDoc.roomType,
        bedLabel: bedDoc.label,
        startDate: admissionDate,
        dailyRate: bedDoc.dailyRate,
        reason: 'Admission',
        assignedBy: ACTOR,
      })
    }

    if (depositAmount > 0) {
      await Deposit.create({
        patientId,
        amount: depositAmount,
        method: 'Cash',
        referenceNumber: credit ? `CR-${patientId}` : `DEP-${patientId}`,
        date: admissionDate,
        receivedBy: ACTOR,
        isInitial: true,
      })
    }

    await assignDoctorsOnAdmit(patient, [String(doctor._id)], ACTOR)
    if (!isEmergencyOpdAdmission(patient)) {
      await ensureAutomaticDailyCharges(patient, null, { range: true })
    } else {
      await ensureAutomaticDailyCharges(patient, null, { range: true })
    }

    await addCaseRecord(patient, catalog, admissionDate, spec.services)

    if (maternity && spec.baby) {
      await MaternityBaby.create({
        motherPatientId: patientId,
        name: spec.baby.name,
        sex: spec.baby.sex,
        dateOfBirth: admissionDate,
        timeOfBirth: spec.baby.time,
        birthWeightGrams: spec.baby.weight,
        deliveryType: spec.baby.deliveryType,
        notes: spec.reason,
        status: 'admitted',
        createdBy: NURSE,
        updatedBy: NURSE,
      })
    }

    if (nurse?._id) {
      await ClinicalNote.create({
        patient: patient._id,
        patientId,
        admissionId: String(patient._id),
        note: `${spec.reason} Assigned to ${doctor.name} (${doctor.specialty}). ${emergency ? 'Managed in Emergency OPD without a bed.' : `Admitted to ${bedDoc.roomType} bed ${bedDoc.label}.`}`,
        createdBy: nurse._id,
      })
    }
  }

  const summary = {
    total: await Patient.countDocuments(),
    emergency: await Patient.countDocuments({ admissionType: 'emergency-opd' }),
    maternity: await Patient.countDocuments({ admissionType: 'maternity' }),
    credit: await Patient.countDocuments({ isCreditPatient: true }),
    normal: await Patient.countDocuments({ admissionType: 'normal', isCreditPatient: { $ne: true } }),
  }

  console.log('Removed previous patient data:')
  console.log(removed)
  console.log(`Seeded ${summary.total} patients across ${today} back through ${shiftDate(today, -6)}:`)
  console.log(`  Emergency OPD: ${summary.emergency}`)
  console.log(`  Maternity: ${summary.maternity}`)
  console.log(`  Credit: ${summary.credit}`)
  console.log(`  Other inpatient: ${summary.normal}`)
  console.log('Doctors, catalog, users, and room inventory were kept.')
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
