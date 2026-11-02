import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import { corsOriginDelegate } from './utils/corsOrigin.js'
import { listenUrls } from './utils/lanUrls.js'
import authRoutes from './routes/auth.routes.js'
import patientRoutes from './routes/patients.routes.js'
import bedRoutes from './routes/beds.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import recordRoutes from './routes/records.routes.js'
import managerRoutes from './routes/manager.routes.js'
import adminRoutes from './routes/admin.routes.js'
import nurseRoutes from './routes/nurse.routes.js'
import receptionRoutes from './routes/reception.routes.js'
import doctorRoutes from './routes/doctors.routes.js'
import chargeRoutes from './routes/charges.routes.js'
import userRoutes from './routes/users.routes.js'
import roleRoutes from './routes/roles.routes.js'
import auditRoutes from './routes/audit.routes.js'
import departmentRoutes from './routes/departments.routes.js'
import wardRoutes from './routes/wards.routes.js'
import roomRoutes from './routes/rooms.routes.js'
import searchRoutes from './routes/search.routes.js'
import clinicalNotesRoutes from './routes/clinicalNotes.routes.js'
import pharmacyRoutes from './routes/pharmacy.routes.js'
import laboratoryRoutes from './routes/laboratory.routes.js'
import wardServicesRoutes from './routes/wardServices.routes.js'
import serviceHistoryRoutes from './routes/serviceHistory.routes.js'
import creditCompanyRoutes from './routes/creditCompanies.routes.js'
import conversionRoutes from './routes/conversion.routes.js'
import { ensureDefaultRoles, ensureWorkflowStaff } from './services/roles.js'

const app = express()
const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || '0.0.0.0'

app.use(cors({ origin: corsOriginDelegate, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'medbill-api', time: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/beds', bedRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/manager', managerRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/nurse', nurseRoutes)
app.use('/api/reception', receptionRoutes)
app.use('/api/doctors', doctorRoutes)
app.use('/api/charges', chargeRoutes)
app.use('/api/users', userRoutes)
app.use('/api/roles', roleRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/wards', wardRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/search', searchRoutes)
app.use('/api', clinicalNotesRoutes)
app.use('/api/pharmacy', pharmacyRoutes)
app.use('/api/laboratory', laboratoryRoutes)
app.use('/api', wardServicesRoutes)
app.use('/api/service-history', serviceHistoryRoutes)
app.use('/api/credit-companies', creditCompanyRoutes)
app.use('/api', conversionRoutes)

async function start() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  await connectDB(uri)
  await ensureDefaultRoles()
  await ensureWorkflowStaff()
  app.listen(PORT, HOST, () => {
    const urls = listenUrls(PORT, HOST)
    console.log(`API listening on ${HOST}:${PORT}`)
    for (const url of urls) console.log(`  ${url}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
