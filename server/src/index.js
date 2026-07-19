import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.routes.js'
import patientRoutes from './routes/patients.routes.js'
import bedRoutes from './routes/beds.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import recordRoutes from './routes/records.routes.js'
import managerRoutes from './routes/manager.routes.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'medbill-api', time: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/beds', bedRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/manager', managerRoutes)

async function start() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }
  await connectDB(uri)
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
}

start().catch((err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
