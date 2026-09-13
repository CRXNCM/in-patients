import { Router } from 'express'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { RECEPTION_DASHBOARD_PERMISSION, buildReceptionDashboard } from '../services/receptionDashboard.js'

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

export default router
