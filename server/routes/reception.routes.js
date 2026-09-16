import { Router } from 'express'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { RECEPTION_DASHBOARD_PERMISSION, buildReceptionDashboard } from '../services/receptionDashboard.js'
import {
  RECEPTION_CRITICAL_BALANCES_PERMISSIONS,
  buildReceptionCriticalBalances,
} from '../services/receptionCriticalBalances.js'
import {
  RECEPTION_RECENTLY_APPROVED_PERMISSION,
  buildReceptionRecentlyApproved,
} from '../services/receptionRecentlyApproved.js'

const router = Router()

router.get(
  '/dashboard',
  authRequired,
  requirePermission(RECEPTION_DASHBOARD_PERMISSION),
  async (req, res) => {
    try {
      res.json(await buildReceptionDashboard(req.auth))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to load dashboard' })
    }
  }
)

router.get(
  '/critical-balances',
  authRequired,
  requirePermission(...RECEPTION_CRITICAL_BALANCES_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildReceptionCriticalBalances(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load critical balances' })
    }
  }
)

router.get(
  '/recently-approved',
  authRequired,
  requirePermission(RECEPTION_RECENTLY_APPROVED_PERMISSION),
  async (req, res) => {
    try {
      res.json(await buildReceptionRecentlyApproved(req.auth, req.query))
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load recently approved records' })
    }
  }
)

export default router
