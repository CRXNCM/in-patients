import { Router } from 'express'
import { Deposit } from '../models/Deposit.js'
import { Bed } from '../models/Bed.js'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { todayStr } from '../utils/dates.js'
import {
  MANAGER_DASHBOARD_PERMISSION,
  buildManagerDashboard,
  buildManagerReportSnapshot,
  monthPrefix,
} from '../services/managerDashboard.js'

const router = Router()

router.get(
  '/dashboard',
  authRequired,
  requirePermission(MANAGER_DASHBOARD_PERMISSION),
  async (req, res) => {
    try {
      res.json(await buildManagerDashboard(req.auth))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to load dashboard' })
    }
  }
)

router.get('/reports/:type', authRequired, requirePermission(MANAGER_DASHBOARD_PERMISSION), async (req, res) => {
  try {
    const data = await buildManagerReportSnapshot(req.auth)
    const { type } = req.params
    const today = todayStr()
    const month = monthPrefix(today)

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
