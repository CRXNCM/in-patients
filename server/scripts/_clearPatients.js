import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'

await connectDB(process.env.MONGODB_URI)
const names = ['patients', 'servicerecords', 'deposits', 'pharmacyorders', 'laboratoryorders', 'servicecategories', 'users', 'doctors', 'beds']
const counts = {}
for (const name of names) counts[name] = await mongoose.connection.db.collection(name).countDocuments()
console.log(JSON.stringify(counts))
await mongoose.disconnect()
