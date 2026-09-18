import 'dotenv/config'
import mongoose from 'mongoose'
import { pathToFileURL } from 'url'
import { connectDB } from '../config/db.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import { User } from '../models/User.js'
import { Bed } from '../models/Bed.js'
import { Doctor } from '../models/Doctor.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { MANUAL_STARTER_SLUGS, planHospitalCatalogPopulation } from '../utils/hospitalCatalog.js'

async function safetySnapshot() {
  const [
    patients,
    records,
    deposits,
    users,
    beds,
    doctors,
    settings,
    categories,
  ] = await Promise.all([
    Patient.countDocuments(),
    ServiceRecord.countDocuments(),
    Deposit.countDocuments(),
    User.countDocuments(),
    Bed.countDocuments(),
    Doctor.countDocuments(),
    HospitalSettings.countDocuments(),
    ServiceCategory.countDocuments(),
  ])
  return { patients, records, deposits, users, beds, doctors, settings, categories }
}

function assertUnchanged(before, after) {
  const keys = ['patients', 'records', 'deposits', 'users', 'beds', 'doctors', 'settings', 'categories']
  const changed = keys.filter((key) => before[key] !== after[key])
  if (changed.length) {
    throw new Error(`Safety check failed; unexpected count change: ${changed.join(', ')}`)
  }
}

export async function populateHospitalCatalog() {
  const before = await safetySnapshot()
  const docs = await ServiceCategory.find({ slug: { $in: MANUAL_STARTER_SLUGS } })
  const bySlug = Object.fromEntries(docs.map((doc) => [doc.slug, doc]))
  const plan = planHospitalCatalogPopulation(bySlug)

  const summary = []
  for (const row of plan) {
    if (row.missingCategory) {
      summary.push(row)
      continue
    }
    const category = bySlug[row.slug]
    for (const item of row.added) {
      category.services.push(item)
    }
    if (row.added.length) await category.save()
    summary.push({
      ...row,
      totalAfter: category.services.length,
    })
  }

  const after = await safetySnapshot()
  assertUnchanged(before, after)
  return { before, after, summary }
}

export function printCatalogPopulateSummary(result) {
  console.log('Hospital catalog population')
  console.log('Existing items were preserved. Missing items were added. Prices were not overwritten.')
  console.log('')
  for (const row of result.summary) {
    if (row.missingCategory) {
      console.log(`${row.slug}: category not found — skipped`)
      continue
    }
    console.log(
      `${row.name}: existing ${row.existingCount} | preserved ${row.preserved.length} | added ${row.added.length} | total ${row.totalAfter}`
    )
    if (row.inactiveMatches.length) {
      for (const match of row.inactiveMatches) {
        console.log(`  inactive match left unchanged: "${match.existing}" (starter name "${match.desired}")`)
      }
    }
  }
  const added = result.summary.reduce((sum, row) => sum + (row.added?.length || 0), 0)
  const preserved = result.summary.reduce((sum, row) => sum + (row.preserved?.length || 0), 0)
  console.log('')
  console.log(`Added ${added} item(s). Preserved ${preserved} existing match(es).`)
  console.log('Patients, records, deposits, users, beds, doctors, settings, and category documents were not replaced.')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  connectDB(uri)
    .then(() => populateHospitalCatalog())
    .then((result) => {
      printCatalogPopulateSummary(result)
      return mongoose.disconnect()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
