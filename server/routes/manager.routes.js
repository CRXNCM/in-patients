import { Router } from 'express'
import { Deposit } from '../models/Deposit.js'
import { Bed } from '../models/Bed.js'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { roleHasPermission } from '../utils/permissions.js'
import { todayStr } from '../utils/dates.js'
import {
  MANAGER_DASHBOARD_PERMISSION,
  buildManagerDashboard,
  buildManagerReportSnapshot,
  monthPrefix,
} from '../services/managerDashboard.js'
import { MANAGER_DEPOSITS_PERMISSIONS, buildManagerDepositsReport } from '../services/managerDeposits.js'
import {
  MANAGER_CHARGES_PERMISSIONS,
  MANAGER_OUTSTANDING_PERMISSIONS,
  MANAGER_CREDIT_PERMISSIONS,
  buildManagerChargesReport,
  buildManagerOutstandingReport,
  buildManagerCreditReport,
} from '../services/managerFinance.js'
import { MANAGER_DISCHARGED_PERMISSIONS, buildManagerDischargedReport } from '../services/managerDischarged.js'
import { MANAGER_PHARMACY_PERMISSIONS, buildManagerPharmacyReport } from '../services/managerPharmacy.js'

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

router.get(
  '/deposits',
  authRequired,
  requirePermission(...MANAGER_DEPOSITS_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerDepositsReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load deposits' })
    }
  }
)

router.get(
  '/charges',
  authRequired,
  requirePermission(...MANAGER_CHARGES_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerChargesReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load charges' })
    }
  }
)

router.get(
  '/outstanding',
  authRequired,
  requirePermission(...MANAGER_OUTSTANDING_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerOutstandingReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load outstanding balances' })
    }
  }
)

router.get(
  '/credit-patients',
  authRequired,
  requirePermission(...MANAGER_CREDIT_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerCreditReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load credit patients' })
    }
  }
)

router.get(
  '/pharmacy-usage',
  authRequired,
  requirePermission(...MANAGER_PHARMACY_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerPharmacyReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load pharmacy usage' })
    }
  }
)

router.get(
  '/discharged-patients',
  authRequired,
  requirePermission(...MANAGER_DISCHARGED_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildManagerDischargedReport(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load discharged patients' })
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
    let extras = {}

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
      case 'credit-patients':
        title = 'Credit Patients'
        {
          if (!roleHasPermission(req.auth?.role, 'credit.view')) {
            return res.status(403).json({ error: 'Forbidden' })
          }
          const credit = await buildManagerCreditReport(req.auth, req.query)
          summary = {
            patients: credit.summary.patients,
            creditOutstanding: credit.summary.creditOutstanding,
            billingOutstanding: credit.summary.billingOutstanding,
          }
          rows = credit.rows.map((row) => ({
            patientName: row.patientName,
            patientId: row.patientId,
            admissionId: row.admissionId,
            admissionDate: row.admissionDate,
            status: row.status,
            creditCompanyName: row.creditCompanyName,
            creditCompanyCode: row.creditCompanyCode,
            creditOutstanding: row.creditOutstanding,
            depositStatus: row.depositStatus,
          }))
          extras = { byCompany: credit.byCompany }
        }
        break
      case 'pharmacy':
        title = 'Pharmacy usage'
        {
          const pharmacy = await buildManagerPharmacyReport(req.auth, {
            view: req.query.view || 'month',
            date: req.query.date,
          })
          title = `Pharmacy usage — ${pharmacy.startDate} to ${pharmacy.endDate}`
          summary = {
            medicines: pharmacy.summary.medicines,
            patients: pharmacy.summary.patients,
            issuedQuantity: pharmacy.summary.issuedQuantity,
            returnedQuantity: pharmacy.summary.returnedQuantity,
            netQuantity: pharmacy.summary.netQuantity,
            issuedValue: pharmacy.summary.issuedValue,
          }
          rows = pharmacy.topMedicines.map((row) => ({
            name: row.name,
            unit: row.unit,
            issuedQuantity: row.issuedQuantity,
            returnedQuantity: row.returnedQuantity,
            netQuantity: row.netQuantity,
            patientCount: row.patientCount,
            issuedValue: row.issuedValue,
          }))
          extras = { kind: 'pharmacy', topPatients: pharmacy.topPatients, startDate: pharmacy.startDate, endDate: pharmacy.endDate }
        }
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

    res.json({ title, summary, rows, generatedAt: new Date().toISOString(), hospitalName: data.hospitalName, ...extras })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

export default router
