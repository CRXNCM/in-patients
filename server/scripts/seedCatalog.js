import 'dotenv/config'
import mongoose from 'mongoose'
import { pathToFileURL } from 'url'
import { connectDB } from '../config/db.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { loadCatalogSeed, planCatalogSnapshotApply } from '../utils/catalogSnapshot.js'

export async function applyCatalogSnapshot() {
  const seed = loadCatalogSeed()
  const existing = await ServiceCategory.find().lean()
  const plan = planCatalogSnapshotApply(existing, seed.categories)
  for (const row of plan) {
    if (row.action === 'create') {
      const spec = seed.categories.find((category) => category.slug === row.slug)
      await ServiceCategory.create(spec)
      continue
    }
    if (!row.added.length) continue
    const doc = await ServiceCategory.findOne({ slug: row.slug })
    doc.services.push(...row.added)
    await doc.save()
  }
  return { seed, plan }
}

export function printCatalogSeedSummary(result) {
  const created = result.plan.filter((row) => row.action === 'create').length
  const added = result.plan.reduce((sum, row) => sum + row.added.length, 0)
  const preserved = result.plan.reduce((sum, row) => sum + row.preserved.length, 0)
  console.log('Catalog snapshot seed')
  console.log(`Snapshot: ${result.seed.categoryCount} categories, ${result.seed.itemCount} items`)
  console.log(`Created ${created} missing categor${created === 1 ? 'y' : 'ies'}. Added ${added} missing item(s). Left ${preserved} existing item(s) unchanged.`)
  for (const row of result.plan) {
    if (row.action === 'unchanged') continue
    console.log(`  ${row.name} (${row.slug}): ${row.action}${row.added.length ? `, +${row.added.length}` : ''}`)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  connectDB(process.env.MONGODB_URI)
    .then(() => applyCatalogSnapshot())
    .then((result) => {
      printCatalogSeedSummary(result)
      return mongoose.disconnect()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
