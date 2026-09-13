import 'dotenv/config'
import mongoose from 'mongoose'
import { pathToFileURL } from 'url'
import { connectDB } from '../config/db.js'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'

const SEEDED_BY = 'seed'

export const BASELINE_DEPARTMENTS = [
  {
    name: 'Internal Medicine',
    description: 'Adult medical inpatient care',
    wards: ['Male Medical Ward', 'Female Medical Ward', 'Isolation Ward'],
  },
  {
    name: 'Surgery',
    description: 'Surgical inpatient care',
    wards: ['Male Surgical Ward', 'Female Surgical Ward', 'Post-Operative Ward'],
  },
  {
    name: 'Obstetrics & Gynecology',
    description: 'Maternity and gynecology inpatient care',
    wards: ['Maternity / Labor Ward', 'Delivery Ward', 'Postnatal Ward', 'Gynecology Ward'],
  },
  {
    name: 'Pediatrics',
    description: 'Pediatric inpatient care',
    wards: ['Pediatric Ward', 'Pediatric Isolation Ward'],
  },
  {
    name: 'Neonatology',
    description: 'Newborn and neonatal inpatient care',
    wards: ['NICU', 'Newborn / Neonatal Ward'],
  },
  {
    name: 'Critical Care',
    description: 'Intensive and critical inpatient care',
    wards: ['ICU'],
  },
  {
    name: 'Orthopedics',
    description: 'Orthopedic inpatient care',
    wards: ['Orthopedic Ward'],
  },
  {
    name: 'Emergency',
    description: 'Emergency observation and short-stay care',
    wards: ['Emergency Observation'],
  },
]

function nameKeyFor(name) {
  return String(name).trim().toLowerCase()
}

async function findOrCreateDepartment(item) {
  const name = item.name.trim()
  const nameKey = nameKeyFor(name)
  const existing = await Department.findOne({ nameKey })
  if (existing) return { department: existing, created: false }

  try {
    const department = await Department.create({
      name,
      nameKey,
      description: item.description || '',
      active: true,
      createdBy: SEEDED_BY,
      updatedBy: SEEDED_BY,
    })
    return { department, created: true }
  } catch (err) {
    if (err.code !== 11000) throw err
    const department = await Department.findOne({ nameKey })
    if (!department) throw err
    return { department, created: false }
  }
}

async function findOrCreateWard(department, wardName) {
  const name = wardName.trim()
  const nameKey = nameKeyFor(name)
  const existing = await Ward.findOne({ departmentId: department._id, nameKey })
  if (existing) return { ward: existing, created: false }

  try {
    const ward = await Ward.create({
      name,
      nameKey,
      departmentId: department._id,
      description: '',
      active: true,
      createdBy: SEEDED_BY,
      updatedBy: SEEDED_BY,
    })
    return { ward, created: true }
  } catch (err) {
    if (err.code !== 11000) throw err
    const ward = await Ward.findOne({ departmentId: department._id, nameKey })
    if (!ward) throw err
    return { ward, created: false }
  }
}

export async function seedBaselineDepartmentsAndWards() {
  const createdDepartments = []
  const createdWards = []
  let departmentsCreated = 0
  let departmentsExisting = 0
  let wardsCreated = 0
  let wardsExisting = 0

  for (const item of BASELINE_DEPARTMENTS) {
    const { department, created } = await findOrCreateDepartment(item)
    if (created) {
      departmentsCreated += 1
      createdDepartments.push(department.name)
    } else {
      departmentsExisting += 1
    }

    for (const wardName of item.wards) {
      const result = await findOrCreateWard(department, wardName)
      if (result.created) {
        wardsCreated += 1
        createdWards.push(`${result.ward.name} → ${department.name}`)
      } else {
        wardsExisting += 1
      }
    }
  }

  return {
    departmentsCreated,
    departmentsExisting,
    wardsCreated,
    wardsExisting,
    createdDepartments,
    createdWards,
  }
}

export function printSeedSummary(summary, { heading = 'Department and ward seed complete' } = {}) {
  console.log(heading)
  console.log('Departments:')
  console.log(`  Created: ${summary.departmentsCreated}`)
  console.log(`  Existing: ${summary.departmentsExisting}`)
  console.log('Wards:')
  console.log(`  Created: ${summary.wardsCreated}`)
  console.log(`  Existing: ${summary.wardsExisting}`)
  if (summary.createdDepartments.length) {
    console.log('New departments:')
    for (const name of summary.createdDepartments) console.log(`  - ${name}`)
  }
  if (summary.createdWards.length) {
    console.log('New wards:')
    for (const name of summary.createdWards) console.log(`  - ${name}`)
  }
  if (!summary.departmentsCreated && !summary.wardsCreated) {
    console.log('Nothing new was created. Existing records were left unchanged.')
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  connectDB(uri)
    .then(() => seedBaselineDepartmentsAndWards())
    .then((summary) => {
      printSeedSummary(summary)
      return mongoose.disconnect()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
