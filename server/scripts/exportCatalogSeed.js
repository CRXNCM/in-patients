import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { pathToFileURL } from 'url'
import { connectDB } from '../config/db.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { catalogSeedPath, serializeCatalogCategories } from '../utils/catalogSnapshot.js'

export async function exportCatalogSeed(path = catalogSeedPath()) {
  const docs = await ServiceCategory.find().sort({ name: 1 }).lean()
  const categories = serializeCatalogCategories(docs)
  const payload = {
    exportedAt: new Date().toISOString(),
    categoryCount: categories.length,
    itemCount: categories.reduce((sum, category) => sum + category.services.length, 0),
    categories,
  }
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`)
  return payload
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  connectDB(process.env.MONGODB_URI)
    .then(() => exportCatalogSeed())
    .then((payload) => {
      console.log(`Wrote ${payload.categoryCount} categories and ${payload.itemCount} items to ${catalogSeedPath()}`)
      return mongoose.disconnect()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
