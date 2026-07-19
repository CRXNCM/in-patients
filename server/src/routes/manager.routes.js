import { Router } from 'express'
import { Patient } from '../models/Patient.js'
import { Deposit } from '../models/Deposit.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Bed } from '../models/Bed.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { authRequired, requireRole } from '../middleware/auth.js'
import { calcPatientBalance } from '../services/autoCharges.js'

const router = Router()

function recordTotal(r) {
  if (r.recordType === 'return') {
    return -(r.returnItems?.reduce((s, i) => s + (i.total || 0), 0) || 0)
  }
  return r.services?.reduce((s, line) => s + (line.total || 0), 0) || 0
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthPrefix() {
  return todayStr().slice(0, 7)
}

async function buildDashboardData() {
  const settings = (await HospitalSettings.findOne({ key: 'default' })) || {}
  const threshold = settings.lowBalanceThreshold ?? 3000
  const today = todayStr()
  const month = monthPrefix()

  const [patients, deposits, records, beds] = await Promise.all([
    Patient.find({ status: { $ne: 'discharged' } }),
    Deposit.find().sort({ date: -1 }),
    ServiceRecord.find({ status: 'approved' }),
    Bed.find(),
  ])

  const patientBalances = await Promise.all(
    patients.map(async (p) => {
      const balance = await calcPatientBalance(p.patientId)
      return { patient: p, balance }
    })
  )

  const totalDeposits = patients.reduce((s, p) => s + (p.depositTotal || 0), 0)
  const outstandingBalance = patientBalances.reduce(
    (s, { balance }) => s + Math.max(0, balance.totalCharges - balance.depositTotal),
    0
  )
  const nearLowBalance = patientBalances.filter(
    ({ balance }) => balance.depositTotal - balance.totalCharges < threshold * 2
  ).length

  const todayDeposits = deposits.filter((d) => d.date === today).reduce((s, d) => s + d.amount, 0)
  const todayCharges = records.filter((r) => r.date === today).reduce((s, r) => s + recordTotal(r), 0)
  const todayRevenue = todayDeposits + todayCharges

  const monthlyDeposits = deposits
    .filter((d) => d.date?.startsWith(month))
    .reduce((s, d) => s + d.amount, 0)
  const monthlyCharges = records
    .filter((r) => r.date?.startsWith(month))
    .reduce((s, r) => s + recordTotal(r), 0)
  const monthlyRevenue = monthlyDeposits + monthlyCharges

  const deptMap = {}
  records.forEach((r) => {
    if (r.recordType === 'return') return
    r.services?.forEach((line) => {
      const cat = line.category || 'Other'
      deptMap[cat] = (deptMap[cat] || 0) + (line.total || 0)
    })
  })
  const revenueByDepartment = Object.entries(deptMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dailyRevenueTrend = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayDeposits = deposits.filter((dep) => dep.date === dateStr).reduce((s, dep) => s + dep.amount, 0)
    const dayCharges = records.filter((rec) => rec.date === dateStr).reduce((s, rec) => s + recordTotal(rec), 0)
    dailyRevenueTrend.push({
      day: dayNames[d.getDay()],
      date: dateStr,
      revenue: dayDeposits + dayCharges,
    })
  }

  const serviceMap = {}
  records.forEach((r) => {
    if (r.recordType === 'return') return
    r.services?.forEach((line) => {
      const key = line.serviceName
      if (!serviceMap[key]) serviceMap[key] = { name: key, count: 0, revenue: 0 }
      serviceMap[key].count += line.quantity || 1
      serviceMap[key].revenue += line.total || 0
    })
  })
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const medMap = {}
  records.forEach((r) => {
    r.services?.forEach((line) => {
      if (line.category !== 'Pharmacy') return
      const key = line.serviceName
      if (!medMap[key]) medMap[key] = { name: key, count: 0, revenue: 0 }
      medMap[key].count += line.quantity || 1
      medMap[key].revenue += line.total || 0
    })
  })
  const topMedicines = Object.values(medMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const recentPatients = patientBalances
    .sort((a, b) => b.patient.admissionDate.localeCompare(a.patient.admissionDate))
    .slice(0, 10)
    .map(({ patient, balance }) => ({
      id: patient.patientId,
      name: patient.name,
      deposit: balance.depositTotal,
      balance: balance.depositTotal - balance.totalCharges,
      admissionDate: patient.admissionDate,
      room: patient.room,
      bed: patient.bed,
    }))

  const occupiedBeds = beds.filter((b) => b.status === 'occupied').length
  const totalBeds = beds.length

  return {
    stats: {
      todayRevenue,
      monthlyRevenue,
      totalDeposits,
      outstandingBalance,
      inpatientCount: patients.length,
      nearLowBalance,
      todayDeposits,
      occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    },
    revenueByDepartment,
    dailyRevenueTrend,
    topServices,
    topMedicines,
    recentPatients,
    hospitalName: settings.name || 'Central City Hospital',
  }
}

router.get('/dashboard', authRequired, requireRole('Manager', 'Admin'), async (_req, res) => {
  try {
    res.json(await buildDashboardData())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
})

router.get('/reports/:type', authRequired, requireRole('Manager', 'Admin'), async (req, res) => {
  try {
    const data = await buildDashboardData()
    const { type } = req.params
    const today = todayStr()
    const month = monthPrefix()

    let title = 'Hospital Report'
    let rows = []
    let summary = {}

    switch (type) {
      case 'daily':
        title = `Daily Report — ${today}`
        summary = { revenue: data.stats.todayRevenue, deposits: data.stats.todayDeposits }
        rows = data.recentPatients
        break
      case 'weekly':
        title = 'Weekly Report'
        summary = { revenue: data.dailyRevenueTrend.reduce((s, d) => s + d.revenue, 0) }
        rows = data.dailyRevenueTrend
        break
      case 'monthly':
        title = `Monthly Report — ${month}`
        summary = { revenue: data.stats.monthlyRevenue }
        rows = data.revenueByDepartment
        break
      case 'annual':
        title = `Annual Report — ${new Date().getFullYear()}`
        summary = { revenue: data.stats.monthlyRevenue }
        rows = data.revenueByDepartment
        break
      case 'department':
        title = 'Department Revenue Report'
        rows = data.revenueByDepartment
        break
      case 'deposit':
        title = 'Deposit Report'
        {
          const deposits = await Deposit.find().sort({ date: -1 }).limit(50)
          rows = deposits.map((d) => ({
            date: d.date,
            amount: d.amount,
            method: d.method,
            patientId: d.patientId,
            receivedBy: d.receivedBy,
          }))
        }
        break
      case 'outstanding':
        title = 'Outstanding Balance Report'
        rows = data.recentPatients.filter((p) => p.balance < 0)
        break
      case 'billing':
        title = 'Patient Billing Summary'
        rows = data.recentPatients
        break
      case 'occupancy':
        title = 'Room Occupancy Report'
        {
          const beds = await Bed.find().sort({ roomType: 1, label: 1 })
          rows = beds.map((b) => ({
            label: b.label,
            roomType: b.roomType,
            status: b.status,
            patientId: b.patientId,
          }))
        }
        summary = { occupancyRate: data.stats.occupancyRate }
        break
      default:
        return res.status(400).json({ error: 'Unknown report type' })
    }

    res.json({ title, summary, rows, generatedAt: new Date().toISOString(), hospitalName: data.hospitalName })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

export default router
